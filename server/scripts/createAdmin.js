const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function createAdmin() {
    try {
        // Check if admin already exists
        const existing = await query('SELECT id FROM users WHERE email = ?', ['admin@company.com']);
        
        if (existing.length > 0) {
            console.log('Admin user already exists');
            // Update password to ensure it works
            const hash = await bcrypt.hash('admin123', 10);
            await query('UPDATE users SET password_hash = ?, role = ? WHERE email = ?', [hash, 'admin', 'admin@company.com']);
            console.log('Updated admin password');
        } else {
            // Create new admin user
            const hash = await bcrypt.hash('admin123', 10);
            const result = await query(`
                INSERT INTO users (
                    email, username, password_hash, full_name, wallet_address, 
                    role, department, total_tokens, current_streak
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'admin@company.com',
                'admin',
                hash,
                'System Administrator',
                '0xADMIN1234567890123456789012345678901234',
                'admin',
                'IT',
                1000,
                0
            ]);
            console.log('Created new admin user');
        }
        
        console.log('\n=== ADMIN CREDENTIALS ===');
        console.log('Email: admin@company.com');
        console.log('Password: admin123');
        console.log('Role: admin');
        console.log('========================\n');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin();
