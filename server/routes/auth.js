const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('password').isLength({ min: 6 }),
  body('fullName').isLength({ min: 2, max: 255 }).trim(),
  body('walletAddress').isLength({ min: 42, max: 42 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, fullName, walletAddress, department, role } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = ? OR username = ? OR wallet_address = ?',
      [email, username, walletAddress]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (email, username, password_hash, full_name, wallet_address, department, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, username, hashedPassword, fullName, walletAddress, department || 'General', role || 'team_member']
    );

    const user = {
      id: result.lastID,
      email,
      username,
      full_name: fullName,
      wallet_address: walletAddress,
      role: role || 'team_member'
    };

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, walletAddress: user.wallet_address },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        walletAddress: user.wallet_address,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last activity
    await db.query(
      "UPDATE users SET last_activity_date = date('now') WHERE id = ?",
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, walletAddress: user.wallet_address },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        walletAddress: user.wallet_address,
        role: user.role,
        totalTokens: user.total_tokens,
        currentStreak: user.current_streak,
        streakLevel: user.streak_level
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      walletAddress: user.wallet_address,
      role: user.role,
      department: user.department,
      totalTokens: user.total_tokens,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak,
      streakLevel: user.streak_level,
      badges: user.badges
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Verify JWT token
router.post('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
