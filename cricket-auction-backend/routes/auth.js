const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { sendOTPEmail, sendWelcomeEmail } = require('../utils/emailService');

// Register - Send OTP for email verification
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    const pool = req.app.get('db');

    try {
        // Check if user already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (existingUser.rows.length > 0) {
            if (existingUser.rows[0].email_verified) {
                return res.status(400).json({ error: 'Email already exists and is verified' });
            } else {
                // User exists but not verified, update their info and send new OTP
                const passwordHash = await bcrypt.hash(password, 10);
                await pool.query(
                    'UPDATE users SET password_hash = $1, name = $2 WHERE email = $3',
                    [passwordHash, name, email]
                );
            }
        } else {
            // Create new user (not verified)
            const passwordHash = await bcrypt.hash(password, 10);
            await pool.query(
                'INSERT INTO users (email, password_hash, name, email_verified) VALUES ($1, $2, $3, $4)',
                [email, passwordHash, name, false]
            );
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Store OTP in database
        await pool.query(
            'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        // Send OTP email
        const emailResult = await sendOTPEmail(email, otp, name);
        
        if (!emailResult.success) {
            return res.status(500).json({ error: 'Failed to send verification email' });
        }

        res.status(201).json({ 
            message: 'Registration successful. Please check your email for verification code.',
            email: email
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
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

        // Check if email is verified
        if (!user.email_verified) {
            return res.status(401).json({ 
                error: 'Please verify your email before logging in. Check your email for verification code.',
                needsVerification: true,
                email: user.email
            });
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

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const pool = req.app.get('db');

    try {
        // Find valid OTP
        const otpResult = await pool.query(
            'SELECT * FROM email_otps WHERE email = $1 AND otp = $2 AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
            [email, otp]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Mark OTP as used
        await pool.query(
            'UPDATE email_otps SET used = TRUE WHERE id = $1',
            [otpResult.rows[0].id]
        );

        // Mark user as verified
        await pool.query(
            'UPDATE users SET email_verified = TRUE WHERE email = $1',
            [email]
        );

        // Get user details
        const userResult = await pool.query(
            'SELECT id, email, name FROM users WHERE email = $1',
            [email]
        );

        const user = userResult.rows[0];
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

        // Send welcome email
        await sendWelcomeEmail(email, user.name);

        res.json({
            message: 'Email verified successfully!',
            token,
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    const pool = req.app.get('db');

    try {
        // Check if user exists and is not verified
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND email_verified = FALSE',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'User not found or already verified' });
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Store new OTP
        await pool.query(
            'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
            [email, otp, expiresAt]
        );

        // Send OTP email
        const emailResult = await sendOTPEmail(email, otp, userResult.rows[0].name);
        
        if (!emailResult.success) {
            return res.status(500).json({ error: 'Failed to send verification email' });
        }

        res.json({ message: 'OTP sent successfully. Please check your email.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
    }
});

module.exports = router;