const fs = require('fs');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function populateUsersFromCSV() {
  const users = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream('/home/mwombeki/Documents/hackathon/sample_users.csv')
      .pipe(csv())
      .on('data', (row) => {
        users.push(row);
      })
      .on('end', async () => {
        try {
          for (const user of users) {
            const hashedPassword = await bcrypt.hash('user123', 10);
            
            db.run(`
              INSERT OR IGNORE INTO users (
                email, username, password_hash, full_name, wallet_address, 
                department, role, total_tokens, current_streak
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              user.email,
              user.username,
              hashedPassword,
              user.fullName,
              user.walletAddress,
              user.department,
              user.role,
              Math.floor(Math.random() * 500) + 100, // Random tokens 100-600
              Math.floor(Math.random() * 15) // Random streak 0-14
            ], function(err) {
              if (err) console.error('Error inserting user:', err);
            });
          }
          
          console.log(`Populated ${users.length} users from CSV`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
  });
}

// Create sample leagues
async function createSampleLeagues() {
  const leagues = [
    {
      name: 'Engineering Excellence League',
      description: 'Compete with fellow engineers on coding challenges and project deliveries',
      type: 'department',
      entry_fee: 50,
      prize_pool: 1000,
      current_season: 1,
      status: 'active'
    },
    {
      name: 'Marketing Mavericks',
      description: 'Creative campaigns and engagement metrics competition',
      type: 'department', 
      entry_fee: 30,
      prize_pool: 600,
      current_season: 1,
      status: 'active'
    },
    {
      name: 'Company Champions',
      description: 'Cross-department collaboration and innovation league',
      type: 'company',
      entry_fee: 100,
      prize_pool: 2000,
      current_season: 1,
      status: 'active'
    },
    {
      name: 'Rookie Rising Stars',
      description: 'League for interns and new hires to build engagement',
      type: 'team',
      entry_fee: 25,
      prize_pool: 500,
      current_season: 1,
      status: 'active'
    }
  ];

  for (const league of leagues) {
    db.run(`
      INSERT OR IGNORE INTO leagues (
        name, description, type, entry_fee, prize_pool, 
        current_season, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      league.name, league.description, league.type, 
      league.entry_fee, league.prize_pool, league.current_season, league.status
    ], function(err) {
      if (err) console.error('Error creating league:', err);
    });
  }
  
  console.log('Created sample leagues');
}

// Create sample polls
async function createSamplePolls() {
  const polls = [
    {
      title: 'Employee of the Month - December 2024',
      description: 'Vote for the most outstanding team member this month',
      type: 'employee_of_month',
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: 1,
      status: 'active'
    },
    {
      title: 'Best Team Collaboration Project',
      description: 'Which project showed the best cross-team collaboration?',
      type: 'general',
      end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: 1,
      status: 'active'
    }
  ];

  for (const poll of polls) {
    db.run(`
      INSERT INTO polls (title, description, type, end_date, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [poll.title, poll.description, poll.type, poll.end_date, poll.created_by, poll.status], function(err) {
      if (err) {
        console.error('Error creating poll:', err);
        return;
      }
      
      const pollId = this.lastID;
      
      // Add options for employee of the month
      if (poll.type === 'employee_of_month') {
        const options = ['John Doe', 'Sarah Wilson', 'Mike Chen', 'Lisa Garcia', 'Emma Taylor'];
        for (const option of options) {
          db.run(`
            INSERT INTO poll_options (poll_id, option_text)
            VALUES (?, ?)
          `, [pollId, option], function(err) {
            if (err) console.error('Error creating poll option:', err);
          });
        }
      } else {
        const options = ['Project Alpha', 'Project Beta', 'Project Gamma', 'Project Delta'];
        for (const option of options) {
          db.run(`
            INSERT INTO poll_options (poll_id, option_text)
            VALUES (?, ?)
          `, [pollId, option], function(err) {
            if (err) console.error('Error creating poll option:', err);
          });
        }
      }
    });
  }
  
  console.log('Created sample polls');
}

// Run all population scripts
async function populateAll() {
  try {
    await populateUsersFromCSV();
    await createSampleLeagues();
    await createSamplePolls();
    console.log('All sample data populated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating data:', error);
    process.exit(1);
  }
}

populateAll();
