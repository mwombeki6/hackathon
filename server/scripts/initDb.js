const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    const schemaPath = path.join(__dirname, '../../database/schema_sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = schema.split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    // Execute each statement sequentially
    for (const statement of statements) {
      try {
        await db.query(statement);
        console.log('✓ Executed:', statement.substring(0, 50) + '...');
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('no such table')) {
          console.error('Error executing statement:', statement.substring(0, 100));
          console.error('Error:', err.message);
        }
      }
    }
    
    console.log('Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();
