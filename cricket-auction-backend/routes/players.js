const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Add single player (Host only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    const { tournament_id, name, role, base_price } = req.body;
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            'INSERT INTO players (tournament_id, name, role, base_price) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournament_id, name, role, base_price]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Bulk add players (Host only)
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
    const { tournament_id, players } = req.body;
    // players = [{ name, role, base_price }, { name, role, base_price }, ...]
    const pool = req.app.get('db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertedPlayers = [];
        for (const player of players) {
            const result = await client.query(
                'INSERT INTO players (tournament_id, name, role, base_price) VALUES ($1, $2, $3, $4) RETURNING *',
                [tournament_id, player.name, player.role, player.base_price]
            );
            insertedPlayers.push(result.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ 
            message: `${insertedPlayers.length} players added successfully`,
            players: insertedPlayers 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Delete player (Host only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    const pool = req.app.get('db');

    try {
        // Check if player is already sold or in auction
        const checkResult = await pool.query(
            'SELECT status FROM players WHERE id = $1',
            [req.params.id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        if (checkResult.rows[0].status !== 'available') {
            return res.status(400).json({ error: 'Cannot delete player that is already sold or in auction' });
        }

        await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
        res.json({ message: 'Player deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get players for a tournament
router.get('/tournament/:tournamentId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    const { status } = req.query;

    try {
        let query = 'SELECT * FROM players WHERE tournament_id = $1';
        const params = [req.params.tournamentId];

        if (status) {
            query += ' AND status = $2';
            params.push(status);
        }

        query += ' ORDER BY created_at';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get player count by status
router.get('/tournament/:tournamentId/stats', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM players 
            WHERE tournament_id = $1
            GROUP BY status
        `, [req.params.tournamentId]);

        const stats = {
            total: 0,
            available: 0,
            in_auction: 0,
            sold: 0,
            unsold: 0
        };

        result.rows.forEach(row => {
            stats[row.status] = parseInt(row.count);
            stats.total += parseInt(row.count);
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;