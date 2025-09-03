const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Create SQLite database connection
const dbPath = path.join(__dirname, '../../blockengage.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Convert PostgreSQL queries to SQLite compatible format
const query = (text, params = []) => {
  return new Promise((resolve, reject) => {
    // Convert PostgreSQL $1, $2 syntax to SQLite ? syntax
    let sqliteQuery = text.replace(/\$(\d+)/g, '?');
    
    // Handle PostgreSQL specific syntax
    sqliteQuery = sqliteQuery.replace(/CURRENT_TIMESTAMP/g, "datetime('now')");
    sqliteQuery = sqliteQuery.replace(/CURRENT_DATE/g, "date('now')");
    sqliteQuery = sqliteQuery.replace(/NOW\(\)/g, "datetime('now')");
    
    if (sqliteQuery.toLowerCase().includes('select') || sqliteQuery.toLowerCase().includes('returning')) {
      db.all(sqliteQuery, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Return in PostgreSQL format for compatibility
          resolve({ rows: rows || [] });
        }
      });
    } else {
      db.run(sqliteQuery, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            rows: [], 
            rowCount: this.changes, 
            lastID: this.lastID 
          });
        }
      });
    }
  });
};

module.exports = {
  query,
  db
};
