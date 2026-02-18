const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Access denied. Admin/Manager only.' });
    }
    next();
};

const logActivity = (db) => {
    return (req, res, next) => {
        const log = db.prepare(`
            INSERT INTO audit_log (user_id, action, table_name, details, ip_address)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        res.on('finish', () => {
            if (req.method !== 'GET' && req.user) {
                const details = JSON.stringify({
                    method: req.method,
                    path: req.path,
                    body: req.body
                });
                log.run(
                    req.user.id,
                    `${req.method} ${req.path}`,
                    req.path.split('/')[1],
                    details,
                    req.ip
                );
            }
        });
        
        next();
    };
};

module.exports = { authMiddleware, adminOnly, logActivity };
