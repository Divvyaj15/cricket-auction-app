const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Create tournament (Host only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    const { name, max_teams, team_budget } = req.body;
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            'INSERT INTO tournaments (name, host_id, max_teams, team_budget) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, req.user.id, max_teams || 8, team_budget || 100000]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all tournaments
router.get('/', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT t.*, u.name as host_name 
            FROM tournaments t 
            JOIN users u ON t.host_id = u.id 
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single tournament
router.get('/:id', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT t.*, u.name as host_name 
            FROM tournaments t 
            JOIN users u ON t.host_id = u.id 
            WHERE t.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;