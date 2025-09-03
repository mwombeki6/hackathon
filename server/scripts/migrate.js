const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function runMigrations() {
  try {
    console.log('Starting database migration...');
    
    // Read SQLite schema file
    const schemaPath = path.join(__dirname, '../../database/schema_sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement + ';');
      }
    }
    
    console.log('Database migration completed successfully!');
    
    // Create initial lottery round
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    await db.query(`
      INSERT INTO lottery_rounds (round_name, start_date, end_date, perk_description)
      VALUES ('Round 1', CURRENT_TIMESTAMP, $1, 'Mystery Perk - Coffee Voucher or Parking Spot!')
    `, [endDate]);
    
    console.log('Initial lottery round created');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigrations();
