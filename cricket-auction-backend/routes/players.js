const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// Helper to check if user is tournament host
async function isHost(pool, userId, tournamentId) {
    const result = await pool.query(
        'SELECT host_id FROM tournaments WHERE id = $1',
        [tournamentId]
    );
    return result.rows.length > 0 && result.rows[0].host_id === userId;
}

// Add single player (Host only)
router.post('/add', authenticateToken, async (req, res) => {
    const { tournament_id, name, role, base_price } = req.body;
    const pool = req.app.get('db');

    try {
        const isHostUser = await isHost(pool, req.user.id, tournament_id);
        if (!isHostUser) {
            return res.status(403).json({ error: 'Only tournament host can add players' });
        }

        // Frontend sends price in Lakhs; store in rupees (Lakhs * 100000)
        const result = await pool.query(
            'INSERT INTO players (tournament_id, name, role, base_price) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournament_id, name, role, Math.round(parseFloat(base_price) * 100000)]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload CSV (Host only)
router.post('/upload-csv', authenticateToken, upload.single('file'), async (req, res) => {
    const { tournament_id } = req.body;
    const pool = req.app.get('db');

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const isHostUser = await isHost(pool, req.user.id, tournament_id);
        if (!isHostUser) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'Only tournament host can upload players' });
        }

        const players = [];
        const errors = [];

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csvParser())
                .on('data', (row) => {
                    const name = row.Name || row.name;
                    const role = (row.Role || row.role || '').toLowerCase().trim();
                    const basePrice = parseFloat(row.BasePrice || row.baseprice || row.base_price || 0) * 100000;

                    const validRoles = ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'];

                    if (!name || !validRoles.includes(role) || isNaN(basePrice) || basePrice <= 0) {
                        errors.push(`Invalid: ${JSON.stringify(row)}`);
                    } else {
                        players.push({ name, role, base_price: basePrice });
                    }
                })
                .on('end', resolve)
                .on('error', reject);
        });

        fs.unlinkSync(req.file.path);

        if (players.length === 0) {
            return res.status(400).json({ error: 'No valid players found', details: errors });
        }

        // Insert all players
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const player of players) {
                await client.query(
                    'INSERT INTO players (tournament_id, name, role, base_price) VALUES ($1, $2, $3, $4)',
                    [tournament_id, player.name, player.role, player.base_price]
                );
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ message: `${players.length} players imported`, errors: errors.length > 0 ? errors : null });
    } catch (error) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// Get players
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

// Get stats
router.get('/tournament/:tournamentId/stats', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            `SELECT status, COUNT(*) as count 
             FROM players 
             WHERE tournament_id = $1 
             GROUP BY status`,
            [req.params.tournamentId]
        );

        const stats = { total: 0, available: 0, in_auction: 0, sold: 0, unsold: 0 };
        result.rows.forEach(row => {
            stats[row.status] = parseInt(row.count);
            stats.total += parseInt(row.count);
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete player (Host only)
router.delete('/:id', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const playerResult = await pool.query(
            'SELECT tournament_id, status FROM players WHERE id = $1',
            [req.params.id]
        );

        if (playerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const player = playerResult.rows[0];
        const isHostUser = await isHost(pool, req.user.id, player.tournament_id);

        if (!isHostUser) {
            return res.status(403).json({ error: 'Only tournament host can delete players' });
        }

        if (player.status !== 'available') {
            return res.status(400).json({ error: 'Cannot delete player that is sold or in auction' });
        }

        await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
        res.json({ message: 'Player deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;