const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'rawson-tracker.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'agent')),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Activities master list
    CREATE TABLE IF NOT EXISTS activities_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Monthly goals (only monthly goals are set, weekly/annual calculated)
    CREATE TABLE IF NOT EXISTS monthly_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        goal_value INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (activity_id) REFERENCES activities_master(id) ON DELETE CASCADE,
        UNIQUE(user_id, activity_id, year, month)
    );

    -- Gross commission goals (annual only, quarterly/monthly calculated)
    CREATE TABLE IF NOT EXISTS gross_commission_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        annual_target DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, year)
    );

    -- Weekly activity entries (once per week with date stamp)
    CREATE TABLE IF NOT EXISTS weekly_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        week_start_date DATE NOT NULL,
        week_end_date DATE NOT NULL,
        count_value INTEGER NOT NULL DEFAULT 0,
        entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (activity_id) REFERENCES activities_master(id) ON DELETE CASCADE,
        UNIQUE(user_id, activity_id, week_start_date)
    );

    -- Commission transactions
    CREATE TABLE IF NOT EXISTS commission_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('sale', 'rental')),
        transaction_reference TEXT,
        transaction_month INTEGER NOT NULL,
        transaction_year INTEGER NOT NULL,
        property_address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_monthly_goals_user ON monthly_goals(user_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_weekly_activities_user ON weekly_activities(user_id, week_start_date);
    CREATE INDEX IF NOT EXISTS idx_commission_user ON commission_transactions(user_id, transaction_year, transaction_month);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
`);

// Insert default activities
const defaultActivities = [
    // Cold calling activities
    { name: 'Tele-canvassing', category: 'Cold Calling' },
    { name: 'Door Knocks', category: 'Cold Calling' },
    { name: '360 Activity Drops', category: 'Cold Calling' },
    
    // Branding activities
    { name: 'Neighbourhood Drops', category: 'Branding' },
    { name: 'Promotional Items Distributed', category: 'Branding' },
    { name: 'Robot Blitz', category: 'Branding' },
    { name: 'Community Events', category: 'Branding' },
    { name: 'Rally Participation', category: 'Branding' },
    { name: 'Social Media Postings', category: 'Branding' },
    
    // CRM activities
    { name: 'Contacts Loaded', category: 'CRM' },
    { name: 'Ongoing Touchpoints', category: 'CRM' },
    
    // Sales & Rental activities
    { name: 'Valuations', category: 'Sales & Rental' },
    { name: 'Sole Mandates', category: 'Sales & Rental' },
    { name: 'Other Mandates', category: 'Sales & Rental' },
    { name: 'Show House', category: 'Sales & Rental' },
    { name: 'Buyers Loaded', category: 'Sales & Rental' },
    { name: 'Referral Sent', category: 'Sales & Rental' },
    { name: 'Referral Received', category: 'Sales & Rental' },
    { name: 'Viewings', category: 'Sales & Rental' },
    { name: 'OTP / Lease Applications', category: 'Sales & Rental' },
    { name: 'Agreement of Sale & Lease Agreement', category: 'Sales & Rental' },
    { name: 'AOS Submitted to Bond Originator', category: 'Sales & Rental' },
    { name: 'Training Session', category: 'Sales & Rental' }
];

const insertActivity = db.prepare(`
    INSERT OR IGNORE INTO activities_master (name, category) VALUES (?, ?)
`);

defaultActivities.forEach(activity => {
    insertActivity.run(activity.name, activity.category);
});

console.log('✅ Database schema created successfully');
console.log('✅ Default activities inserted');

module.exports = db;
