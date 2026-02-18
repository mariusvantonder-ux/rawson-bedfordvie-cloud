require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./database');
const { authMiddleware, adminOnly, logActivity } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    message: 'Too many login attempts, please try again later.'
});

// ===== AUTHENTICATION ENDPOINTS =====

// Login
app.post('/api/auth/login', loginLimiter, (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user info
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = db.prepare('SELECT id, username, email, full_name, role FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
});

// ===== USER MANAGEMENT (Admin/Manager only) =====

// Create user
app.post('/api/users', authMiddleware, adminOnly, (req, res) => {
    try {
        const { username, email, password, full_name, role } = req.body;
        
        const passwordHash = bcrypt.hashSync(password, 10);
        
        const insert = db.prepare(`
            INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const result = insert.run(username, email, passwordHash, full_name, role || 'agent');
        
        res.json({ id: result.lastInsertRowid, message: 'User created successfully' });
    } catch (error) {
        console.error('Create user error:', error);
        if (error.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Username or email already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});

// List users (for admin/manager)
app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
    const users = db.prepare(`
        SELECT id, username, email, full_name, role, is_active, created_at
        FROM users
        ORDER BY full_name
    `).all();
    res.json(users);
});

// Update user
app.put('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
    try {
        const { email, full_name, is_active } = req.body;
        
        db.prepare(`
            UPDATE users 
            SET email = ?, full_name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(email, full_name, is_active, req.params.id);
        
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Change password
app.put('/api/users/:id/password', authMiddleware, (req, res) => {
    try {
        // Users can change their own password, admins can change anyone's
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { password } = req.body;
        const passwordHash = bcrypt.hashSync(password, 10);
        
        db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(passwordHash, req.params.id);
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// ===== ACTIVITIES ENDPOINTS =====

// Get all activities
app.get('/api/activities', authMiddleware, (req, res) => {
    const activities = db.prepare('SELECT * FROM activities_master WHERE is_active = 1 ORDER BY category, name').all();
    res.json(activities);
});

// Add activity (admin only)
app.post('/api/activities', authMiddleware, adminOnly, (req, res) => {
    try {
        const { name, category } = req.body;
        const result = db.prepare('INSERT INTO activities_master (name, category) VALUES (?, ?)').run(name, category);
        res.json({ id: result.lastInsertRowid, message: 'Activity added' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add activity' });
    }
});

// ===== MONTHLY GOALS ENDPOINTS =====

// Get goals for user
app.get('/api/goals/:year/:month', authMiddleware, (req, res) => {
    const userId = req.user.role === 'agent' ? req.user.id : req.query.userId || req.user.id;
    
    const goals = db.prepare(`
        SELECT mg.*, am.name as activity_name, am.category
        FROM monthly_goals mg
        JOIN activities_master am ON mg.activity_id = am.id
        WHERE mg.user_id = ? AND mg.year = ? AND mg.month = ?
    `).all(userId, req.params.year, req.params.month);
    
    res.json(goals);
});

// Set/Update monthly goal
app.post('/api/goals', authMiddleware, (req, res) => {
    try {
        const { activity_id, year, month, goal_value } = req.body;
        const userId = req.user.role === 'agent' ? req.user.id : req.body.user_id || req.user.id;
        
        db.prepare(`
            INSERT INTO monthly_goals (user_id, activity_id, year, month, goal_value)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, activity_id, year, month) 
            DO UPDATE SET goal_value = ?, updated_at = CURRENT_TIMESTAMP
        `).run(userId, activity_id, year, month, goal_value, goal_value);
        
        res.json({ message: 'Goal saved' });
    } catch (error) {
        console.error('Goal save error:', error);
        res.status(500).json({ error: 'Failed to save goal' });
    }
});

// ===== GROSS COMMISSION GOALS =====

// Get gross commission goal
app.get('/api/commission-goals/:year', authMiddleware, (req, res) => {
    const userId = req.user.role === 'agent' ? req.user.id : req.query.userId || req.user.id;
    
    const goal = db.prepare('SELECT * FROM gross_commission_goals WHERE user_id = ? AND year = ?')
        .get(userId, req.params.year);
    
    res.json(goal || { user_id: userId, year: req.params.year, annual_target: 0 });
});

// Set gross commission goal
app.post('/api/commission-goals', authMiddleware, (req, res) => {
    try {
        const { year, annual_target } = req.body;
        const userId = req.user.role === 'agent' ? req.user.id : req.body.user_id || req.user.id;
        
        db.prepare(`
            INSERT INTO gross_commission_goals (user_id, year, annual_target)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, year)
            DO UPDATE SET annual_target = ?, updated_at = CURRENT_TIMESTAMP
        `).run(userId, year, annual_target, annual_target);
        
        res.json({ message: 'Commission goal saved' });
    } catch (error) {
        console.error('Commission goal error:', error);
        res.status(500).json({ error: 'Failed to save commission goal' });
    }
});

// ===== WEEKLY ACTIVITIES =====

// Get weekly activities
app.get('/api/activities/weekly/:weekStart', authMiddleware, (req, res) => {
    const userId = req.user.role === 'agent' ? req.user.id : req.query.userId || req.user.id;
    
    const activities = db.prepare(`
        SELECT wa.*, am.name as activity_name, am.category
        FROM weekly_activities wa
        JOIN activities_master am ON wa.activity_id = am.id
        WHERE wa.user_id = ? AND wa.week_start_date = ?
    `).all(userId, req.params.weekStart);
    
    res.json(activities);
});

// Submit weekly activities (once per week)
app.post('/api/activities/weekly', authMiddleware, (req, res) => {
    try {
        const { activity_id, week_start_date, week_end_date, count_value } = req.body;
        const userId = req.user.role === 'agent' ? req.user.id : req.body.user_id || req.user.id;
        
        db.prepare(`
            INSERT INTO weekly_activities (user_id, activity_id, week_start_date, week_end_date, count_value)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, activity_id, week_start_date)
            DO UPDATE SET count_value = ?, entry_date = CURRENT_TIMESTAMP
        `).run(userId, activity_id, week_start_date, week_end_date, count_value, count_value);
        
        res.json({ message: 'Activity recorded' });
    } catch (error) {
        console.error('Weekly activity error:', error);
        res.status(500).json({ error: 'Failed to record activity' });
    }
});

// ===== COMMISSION TRANSACTIONS =====

// Get commission transactions
app.get('/api/commissions/:year/:month?', authMiddleware, (req, res) => {
    const userId = req.user.role === 'agent' ? req.user.id : req.query.userId || req.user.id;
    
    let query = 'SELECT * FROM commission_transactions WHERE user_id = ? AND transaction_year = ?';
    let params = [userId, req.params.year];
    
    if (req.params.month) {
        query += ' AND transaction_month = ?';
        params.push(req.params.month);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
});

// Add commission transaction
app.post('/api/commissions', authMiddleware, (req, res) => {
    try {
        const { amount, transaction_type, transaction_reference, transaction_month, transaction_year, property_address, notes } = req.body;
        const userId = req.user.role === 'agent' ? req.user.id : req.body.user_id || req.user.id;
        
        const result = db.prepare(`
            INSERT INTO commission_transactions (user_id, amount, transaction_type, transaction_reference, transaction_month, transaction_year, property_address, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, amount, transaction_type, transaction_reference, transaction_month, transaction_year, property_address, notes);
        
        res.json({ id: result.lastInsertRowid, message: 'Commission added' });
    } catch (error) {
        console.error('Commission error:', error);
        res.status(500).json({ error: 'Failed to add commission' });
    }
});

// ===== REPORTS =====

// Get dashboard data
app.get('/api/dashboard', authMiddleware, (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        if (req.user.role === 'agent') {
            // Agent sees only their own data
            const data = {
                goals: db.prepare('SELECT * FROM monthly_goals WHERE user_id = ? AND year = ? AND month = ?').all(req.user.id, currentYear, currentMonth),
                commissionGoal: db.prepare('SELECT * FROM gross_commission_goals WHERE user_id = ? AND year = ?').get(req.user.id, currentYear),
                totalCommission: db.prepare('SELECT SUM(amount) as total FROM commission_transactions WHERE user_id = ? AND transaction_year = ?').get(req.user.id, currentYear)
            };
            res.json(data);
        } else {
            // Admin/Manager sees office overview
            const agents = db.prepare('SELECT id, full_name, username FROM users WHERE role = "agent" AND is_active = 1').all();
            const officeData = agents.map(agent => ({
                agent,
                totalCommission: db.prepare('SELECT SUM(amount) as total FROM commission_transactions WHERE user_id = ? AND transaction_year = ?').get(agent.id, currentYear)
            }));
            res.json({ agents, officeData });
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Rawson Tracker Cloud Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔒 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : '⚠️  NOT SET'}`);
});

module.exports = app;
