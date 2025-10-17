const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Register - No role selection
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    const pool = req.app.get('db');

    try {
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Insert user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, passwordHash, name]
        );

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ 
            token, 
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const pool = req.app.get('db');

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            token, 
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;