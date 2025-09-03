const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function fixAllPasswords() {
    try {
        // Get all users
        const users = await db.query('SELECT id, email FROM users');
        
        // Hash the correct password
        const correctHash = await bcrypt.hash('user123', 10);
        
        // Update all users with the correct password hash
        for (const user of users) {
            await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [correctHash, user.id]);
            console.log(`Updated password for ${user.email}`);
        }
        
        console.log('All passwords fixed!');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing passwords:', error);
        process.exit(1);
    }
}

fixAllPasswords();
