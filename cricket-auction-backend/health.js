// Simple health check endpoint
const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        // Check database connection
        const pool = req.app.get('db');
        await pool.query('SELECT 1');
        
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;
