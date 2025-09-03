const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Read the SQLite schema
const schemaPath = path.join(__dirname, '../../database/schema_sqlite.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// Remove the database file if it exists
const dbPath = path.join(__dirname, '../../blockengage.db');
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Removed existing database');
}

// Create new database
const db = new sqlite3.Database(dbPath);

// Split schema into individual statements
const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

console.log('Creating database with', statements.length, 'statements');

// Execute statements sequentially to avoid dependency issues
async function executeStatements() {
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement.startsWith('--') || statement.length === 0) continue;
        
        await new Promise((resolve, reject) => {
            db.run(statement, function(err) {
                if (err) {
                    console.error(`Error executing statement ${i + 1}:`, err.message);
                    console.error('Statement:', statement.substring(0, 100) + '...');
                } else {
                    console.log(`Executed statement ${i + 1}`);
                }
                resolve();
            });
        });
    }
    console.log('Database created successfully!');
    db.close();
}

executeStatements();
