require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./database');
const { authMiddleware, adminOnly, logActivity } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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
        
        console.log('Dashboard request for user:', req.user.username, 'role:', req.user.role);
        
        if (req.user.role === 'agent') {
            // Agent sees only their own data
            console.log('Loading agent dashboard for user ID:', req.user.id);
            
            let goals = [];
            let commissionGoal = null;
            let totalCommission = { total: 0 };
            
            try {
                goals = db.prepare('SELECT * FROM monthly_goals WHERE user_id = ? AND year = ? AND month = ?').all(req.user.id, currentYear, currentMonth);
            } catch (err) {
                console.error('Error loading goals:', err.message);
            }
            
            try {
                commissionGoal = db.prepare('SELECT * FROM gross_commission_goals WHERE user_id = ? AND year = ?').get(req.user.id, currentYear);
            } catch (err) {
                console.error('Error loading commission goal:', err.message);
            }
            
            try {
                totalCommission = db.prepare('SELECT SUM(amount) as total FROM commission_transactions WHERE user_id = ? AND transaction_year = ?').get(req.user.id, currentYear) || { total: 0 };
            } catch (err) {
                console.error('Error loading total commission:', err.message);
            }
            
            const data = { goals, commissionGoal, totalCommission };
            console.log('Agent dashboard data:', JSON.stringify(data));
            res.json(data);
        } else {
            // Admin/Manager sees office overview
            console.log('Loading admin dashboard');
            const agents = db.prepare("SELECT id, full_name, username FROM users WHERE role = 'agent' AND is_active = 1").all();
            console.log('Found agents:', agents.length);
            
            const officeData = agents.map(agent => {
                let totalCommission = { total: 0 };
                try {
                    totalCommission = db.prepare('SELECT SUM(amount) as total FROM commission_transactions WHERE user_id = ? AND transaction_year = ?').get(agent.id, currentYear) || { total: 0 };
                } catch (err) {
                    console.error(`Error loading commission for agent ${agent.id}:`, err.message);
                }
                return { agent, totalCommission };
            });
            
            res.json({ agents, officeData });
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to load dashboard', details: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== ONE-TIME SETUP ENDPOINT =====
// Access at: https://rawson-tracker.onrender.com/setup-admin
app.get('/setup-admin', async (req, res) => {
    try {
        // Check if admin already exists
        const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('marius-office');
        
        if (existingAdmin) {
            return res.send(`
                <html>
                <head><title>Setup Complete</title></head>
                <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                    <h2>✅ Admin Account Already Exists</h2>
                    <p>Username: <strong>marius-office</strong></p>
                    <p>Your accounts are already set up!</p>
                    <p><a href="/" style="background:#000;color:#FFD700;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Go to Login</a></p>
                    <p><a href="/check-users" style="background:#666;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Check All Users</a></p>
                </body>
                </html>
            `);
        }

        // Create office admin account
        const officePasswordHash = bcrypt.hashSync('Rawson2024!', 10);
        db.prepare(`
            INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `).run('marius-office', 'marius@rawsonbedfordview.co.za', officePasswordHash, 'Marius van Tonder - Office', 'admin');

        // Create personal agent account
        const personalPasswordHash = bcrypt.hashSync('Marius2024!', 10);
        db.prepare(`
            INSERT INTO users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `).run('marius-personal', 'marius.personal@rawsonbedfordview.co.za', personalPasswordHash, 'Marius van Tonder - Personal', 'agent');

        res.send(`
            <html>
            <head>
                <title>Accounts Created</title>
                <style>
                    body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; background: #FFD700; }
                    .card { background: white; border-radius: 10px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h2 { color: #000; }
                    .cred { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0; }
                    .warning { background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; }
                    .btn { display: inline-block; background: #000; color: #FFD700; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
                </style>
            </head>
            <body>
                <h1>🎉 Accounts Created Successfully!</h1>
                
                <div class="card">
                    <h2>🏢 Office Account (Admin)</h2>
                    <div class="cred">
                        <strong>Username:</strong> marius-office<br>
                        <strong>Password:</strong> Rawson2024!<br>
                        <strong>Role:</strong> Admin
                    </div>
                    <p>Use this to view all agents, office reports, and manage the system.</p>
                </div>

                <div class="card">
                    <h2>👤 Personal Account (Agent)</h2>
                    <div class="cred">
                        <strong>Username:</strong> marius-personal<br>
                        <strong>Password:</strong> Marius2024!<br>
                        <strong>Role:</strong> Agent
                    </div>
                    <p>Use this for your personal activity tracking.</p>
                </div>

                <div class="warning">
                    <strong>⚠️ IMPORTANT:</strong> Change these passwords immediately after your first login!<br>
                    Go to "Manage Agents" → Click user → "Change Password"
                </div>

                <a href="/" class="btn">Go to Login Page</a>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).send(`
            <html>
            <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                <h2>❌ Setup Failed</h2>
                <p>Error: ${error.message}</p>
                <p><a href="/setup-admin">Try Again</a></p>
            </body>
            </html>
        `);
    }
});

// Debug endpoint to check users
app.get('/check-users', (req, res) => {
    try {
        const users = db.prepare('SELECT username, email, full_name, role, is_active FROM users').all();
        
        let userList = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.full_name}</td>
                <td>${u.role}</td>
                <td>${u.email}</td>
                <td>${u.is_active ? '✅' : '❌'}</td>
            </tr>
        `).join('');

        res.send(`
            <html>
            <head><title>User List</title></head>
            <body style="font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px;">
                <h2>👥 All Users in Database</h2>
                <table style="width:100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #000; color: #FFD700;">
                            <th style="padding: 10px; text-align: left;">Username</th>
                            <th style="padding: 10px; text-align: left;">Full Name</th>
                            <th style="padding: 10px; text-align: left;">Role</th>
                            <th style="padding: 10px; text-align: left;">Email</th>
                            <th style="padding: 10px; text-align: left;">Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userList || '<tr><td colspan="5" style="text-align:center;padding:20px;">No users found</td></tr>'}
                    </tbody>
                </table>
                <p style="margin-top: 20px;">
                    <a href="/" style="background:#000;color:#FFD700;padding:10px 20px;text-decoration:none;border-radius:5px;margin-right:10px;">Go to Login</a>
                    <a href="/init-activities" style="background:#28a745;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Initialize Activities</a>
                </p>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

// Initialize activities if missing
app.get('/init-activities', (req, res) => {
    try {
        // Check if activities already exist
        const count = db.prepare('SELECT COUNT(*) as count FROM activities_master').get();
        
        if (count.count > 0) {
            return res.send(`
                <html>
                <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                    <h2>✅ Activities Already Initialized</h2>
                    <p>Found ${count.count} activities in database.</p>
                    <p><a href="/" style="background:#000;color:#FFD700;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">Go to Login</a></p>
                </body>
                </html>
            `);
        }

        // Insert default activities
        const defaultActivities = [
            ['Cold Calling', 'Tele-canvassing'],
            ['Cold Calling', 'Door Knocks'],
            ['Cold Calling', '360 Activity Drops'],
            ['Branding', 'Neighbourhood Drops'],
            ['Branding', 'Promotional Items Distributed'],
            ['Branding', 'Robot Blitz'],
            ['Branding', 'Community Events'],
            ['Branding', 'Rally Participation'],
            ['Branding', 'Social Media Postings'],
            ['CRM', 'Contacts Loaded'],
            ['CRM', 'Ongoing Touchpoints'],
            ['Sales & Rental', 'Valuations'],
            ['Sales & Rental', 'Sole Mandates'],
            ['Sales & Rental', 'Other Mandates'],
            ['Sales & Rental', 'Show House'],
            ['Sales & Rental', 'Buyers Loaded'],
            ['Sales & Rental', 'Viewings'],
            ['Sales & Rental', 'OTP / Lease Applications'],
            ['Sales & Rental', 'Agreement of Sale & Lease'],
            ['Sales & Rental', 'AOS to Bond Originator'],
            ['Sales & Rental', 'Referral Sent'],
            ['Sales & Rental', 'Referral Received'],
            ['Sales & Rental', 'Training Session']
        ];

        const insertActivity = db.prepare('INSERT INTO activities_master (category, activity_name) VALUES (?, ?)');
        defaultActivities.forEach(([category, name]) => {
            insertActivity.run(category, name);
        });

        res.send(`
            <html>
            <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; background: #FFD700;">
                <div style="background: white; border-radius: 10px; padding: 30px;">
                    <h2>🎉 Activities Initialized!</h2>
                    <p>Successfully added ${defaultActivities.length} default activities to the database.</p>
                    <p><a href="/" style="background:#000;color:#FFD700;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:15px;font-weight:bold;">Go to Login</a></p>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

// Password reset page
app.get('/reset-password', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Reset Password</title>
            <style>
                body { font-family: Arial; max-width: 500px; margin: 50px auto; padding: 20px; background: #FFD700; }
                .card { background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                h2 { color: #000; margin-bottom: 20px; }
                .form-group { margin-bottom: 15px; }
                label { display: block; font-weight: 600; margin-bottom: 5px; color: #333; }
                input, select { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; }
                input:focus, select:focus { outline: none; border-color: #FFD700; }
                .btn { width: 100%; padding: 12px; background: #000; color: #FFD700; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 10px; }
                .btn:hover { background: #333; }
                .password-wrapper { position: relative; }
                .password-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; }
                .message { padding: 12px; border-radius: 6px; margin-bottom: 15px; display: none; }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>🔐 Reset Password</h2>
                <div id="message" class="message"></div>
                <form id="resetForm">
                    <div class="form-group">
                        <label>Select User</label>
                        <select id="username" required>
                            <option value="">-- Choose User --</option>
                            <option value="marius-office">Marius Office (Admin)</option>
                            <option value="marius-personal">Marius Personal (Agent)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <div class="password-wrapper">
                            <input type="password" id="newPassword" required minlength="6" style="padding-right: 40px;">
                            <button type="button" class="password-toggle" onclick="togglePassword()">👁️</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" id="confirmPassword" required minlength="6">
                    </div>
                    <button type="submit" class="btn">Reset Password</button>
                </form>
                <p style="text-align: center; margin-top: 20px;">
                    <a href="/" style="color: #000;">← Back to Login</a>
                </p>
            </div>

            <script>
                function togglePassword() {
                    const input = document.getElementById('newPassword');
                    const btn = event.target;
                    if (input.type === 'password') {
                        input.type = 'text';
                        btn.textContent = '🙈';
                    } else {
                        input.type = 'password';
                        btn.textContent = '👁️';
                    }
                }

                document.getElementById('resetForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const username = document.getElementById('username').value;
                    const newPassword = document.getElementById('newPassword').value;
                    const confirmPassword = document.getElementById('confirmPassword').value;
                    const messageDiv = document.getElementById('message');

                    if (newPassword !== confirmPassword) {
                        messageDiv.className = 'message error';
                        messageDiv.textContent = 'Passwords do not match!';
                        messageDiv.style.display = 'block';
                        return;
                    }

                    try {
                        const response = await fetch('/do-reset-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, newPassword })
                        });

                        const data = await response.json();

                        if (response.ok) {
                            messageDiv.className = 'message success';
                            messageDiv.textContent = '✅ Password reset successfully! You can now login.';
                            messageDiv.style.display = 'block';
                            document.getElementById('resetForm').reset();
                            setTimeout(() => {
                                window.location.href = '/';
                            }, 2000);
                        } else {
                            messageDiv.className = 'message error';
                            messageDiv.textContent = '❌ ' + (data.error || 'Reset failed');
                            messageDiv.style.display = 'block';
                        }
                    } catch (error) {
                        messageDiv.className = 'message error';
                        messageDiv.textContent = '❌ Error: ' + error.message;
                        messageDiv.style.display = 'block';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Process password reset
app.post('/do-reset-password', express.json(), (req, res) => {
    try {
        const { username, newPassword } = req.body;

        console.log('Password reset attempt for:', username);

        if (!username || !newPassword) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Check if user exists
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Hash new password
        const passwordHash = bcrypt.hashSync(newPassword, 10);
        console.log('New password hash created');

        // Update password
        const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(passwordHash, username);
        console.log('Update result:', result);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Reset failed: ' + error.message });
    }
});

// Emergency password reset - sets default passwords
app.get('/emergency-reset', (req, res) => {
    try {
        // Reset both accounts to known passwords
        const officeHash = bcrypt.hashSync('Office2024!', 10);
        const personalHash = bcrypt.hashSync('Personal2024!', 10);

        db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(officeHash, 'marius-office');
        db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(personalHash, 'marius-personal');

        res.send(`
            <html>
            <head><title>Emergency Reset Complete</title></head>
            <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; background: #FFD700;">
                <div style="background: white; border-radius: 10px; padding: 30px;">
                    <h2>🔐 Passwords Reset Successfully!</h2>
                    
                    <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>🏢 Office Account</h3>
                        <p><strong>Username:</strong> marius-office</p>
                        <p><strong>Password:</strong> Office2024!</p>
                    </div>

                    <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3>👤 Personal Account</h3>
                        <p><strong>Username:</strong> marius-personal</p>
                        <p><strong>Password:</strong> Personal2024!</p>
                    </div>

                    <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <strong>⚠️ IMPORTANT:</strong> Write these down! Change them after logging in.
                    </div>

                    <a href="/" style="display: inline-block; background: #000; color: #FFD700; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px;">Go to Login</a>
                    <a href="/test-login" style="display: inline-block; background: #666; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; margin-left: 10px;">Test Login</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

// Test login page with detailed debugging
app.get('/test-login', (req, res) => {
    res.send(`
        <html>
        <head><title>Test Login</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h2>🔍 Test Login</h2>
            <form id="testForm">
                <div style="margin-bottom: 15px;">
                    <label>Username:</label><br>
                    <input type="text" id="username" value="marius-office" style="width: 100%; padding: 8px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label>Password:</label><br>
                    <input type="text" id="password" value="Office2024!" style="width: 100%; padding: 8px;">
                </div>
                <button type="submit" style="padding: 10px 20px; background: #000; color: #FFD700; border: none; border-radius: 5px; cursor: pointer;">Test Login</button>
            </form>
            <div id="result" style="margin-top: 20px; padding: 15px; border-radius: 5px; display: none;"></div>
            
            <script>
                document.getElementById('testForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const resultDiv = document.getElementById('result');
                    const username = document.getElementById('username').value;
                    const password = document.getElementById('password').value;
                    
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = 'Testing...';
                    
                    try {
                        const response = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password })
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            resultDiv.style.background = '#d4edda';
                            resultDiv.style.color = '#155724';
                            resultDiv.innerHTML = '✅ LOGIN SUCCESSFUL!<br>' + JSON.stringify(data, null, 2);
                        } else {
                            resultDiv.style.background = '#f8d7da';
                            resultDiv.style.color = '#721c24';
                            resultDiv.innerHTML = '❌ LOGIN FAILED<br>Status: ' + response.status + '<br>Error: ' + JSON.stringify(data, null, 2);
                        }
                    } catch (error) {
                        resultDiv.style.background = '#f8d7da';
                        resultDiv.style.color = '#721c24';
                        resultDiv.innerHTML = '❌ ERROR: ' + error.message;
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Debug endpoint to verify password
app.get('/verify-password', (req, res) => {
    const testPassword = 'Office2024!';
    const user = db.prepare('SELECT username, password_hash FROM users WHERE username = ?').get('marius-office');
    
    if (!user) {
        return res.send('User not found');
    }
    
    const isValid = bcrypt.compareSync(testPassword, user.password_hash);
    
    res.send(`
        <html>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h2>Password Verification</h2>
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>Test Password:</strong> Office2024!</p>
            <p><strong>Hash in DB:</strong> ${user.password_hash.substring(0, 30)}...</p>
            <p><strong>Valid:</strong> ${isValid ? '✅ YES' : '❌ NO'}</p>
            ${!isValid ? '<p style="color: red;">The password in the database does not match!</p>' : '<p style="color: green;">Password is correct in database.</p>'}
        </body>
        </html>
    `);
});

// Debug all API endpoints
app.get('/debug-api', authMiddleware, (req, res) => {
    try {
        const results = {};
        
        // Test 1: Get user info
        results.currentUser = req.user;
        
        // Test 2: Get activities
        try {
            const activities = db.prepare('SELECT * FROM activities_master LIMIT 5').all();
            results.activities = {
                success: true,
                count: activities.length,
                sample: activities
            };
        } catch (err) {
            results.activities = {
                success: false,
                error: err.message
            };
        }
        
        // Test 3: Get users
        try {
            const users = db.prepare('SELECT username, full_name, role FROM users').all();
            results.users = {
                success: true,
                count: users.length,
                list: users
            };
        } catch (err) {
            results.users = {
                success: false,
                error: err.message
            };
        }
        
        // Test 4: Database tables
        try {
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            results.tables = tables.map(t => t.name);
        } catch (err) {
            results.tables = { error: err.message };
        }
        
        // Test 5: Activities columns
        try {
            const columns = db.prepare("PRAGMA table_info(activities_master)").all();
            results.activityColumns = columns.map(c => c.name);
        } catch (err) {
            results.activityColumns = { error: err.message };
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Rawson Tracker Cloud Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔒 JWT Secret: ${process.env.JWT_SECRET ? 'Configured' : '⚠️  NOT SET'}`);
});

module.exports = app;
