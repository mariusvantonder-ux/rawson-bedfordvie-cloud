require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline');
const db = require('./database');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
    console.log('\n🚀 Rawson Properties Tracker - Initial Setup\n');
    console.log('This will create the admin accounts for the system.\n');
    
    try {
        // Check if admin already exists
        const existingAdmin = db.prepare('SELECT * FROM users WHERE role = "admin"').get();
        
        if (existingAdmin) {
            const overwrite = await question('⚠️  Admin user already exists. Overwrite? (yes/no): ');
            if (overwrite.toLowerCase() !== 'yes') {
                console.log('Setup cancelled.');
                rl.close();
                return;
            }
        }
        
        console.log('\n--- Admin Office Account ---');
        const officeUsername = await question('Username for office account (default: marius-office): ') || 'marius-office';
        const officePassword = await question('Password for office account: ');
        const officeEmail = await question('Email (default: marius@rawsonproperties.com): ') || 'marius@rawsonproperties.com';
        const officeFullName = await question('Full name (default: Marius - Office): ') || 'Marius - Office';
        
        console.log('\n--- Admin Personal Account ---');
        const personalUsername = await question('Username for personal account (default: marius-personal): ') || 'marius-personal';
        const personalPassword = await question('Password for personal account: ');
        const personalEmail = await question('Email for personal (default: marius.personal@rawsonproperties.com): ') || 'marius.personal@rawsonproperties.com';
        
        // Create accounts
        const insert = db.prepare(`
            INSERT OR REPLACE INTO users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        // Office account (admin)
        const officeHash = bcrypt.hashSync(officePassword, 10);
        insert.run(officeUsername, officeEmail, officeHash, officeFullName, 'admin');
        console.log(`✅ Office admin account created: ${officeUsername}`);
        
        // Personal account (agent)
        const personalHash = bcrypt.hashSync(personalPassword, 10);
        insert.run(personalUsername, personalEmail, personalHash, 'Marius - Personal', 'agent');
        console.log(`✅ Personal agent account created: ${personalUsername}`);
        
        console.log('\n✅ Setup complete!\n');
        console.log('📝 Your credentials:');
        console.log(`   Office Account: ${officeUsername} / ${officePassword}`);
        console.log(`   Personal Account: ${personalUsername} / ${personalPassword}`);
        console.log('\n⚠️  IMPORTANT: Change these passwords after first login!\n');
        console.log('🚀 Start the server with: npm start');
        console.log('🌐 Default URL: http://localhost:3000\n');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    }
    
    rl.close();
}

setup();
