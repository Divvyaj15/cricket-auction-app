const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Helper to generate unique code
function generateCode(prefix) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix + '-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create tournament (User becomes host)
router.post('/create', authenticateToken, async (req, res) => {
    const { name, max_teams, team_budget, team_names } = req.body;
    const pool = req.app.get('db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Validate team_names count
        const maxTeamsInt = parseInt(max_teams);
        if (!Array.isArray(team_names) || team_names.length !== maxTeamsInt) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `team_names must contain exactly ${maxTeamsInt} entries` });
        }

        // Generate unique tournament code
        let tournamentCode = generateCode('TOUR');
        let exists = await client.query('SELECT id FROM tournaments WHERE unique_code = $1', [tournamentCode]);
        while (exists.rows.length > 0) {
            tournamentCode = generateCode('TOUR');
            exists = await client.query('SELECT id FROM tournaments WHERE unique_code = $1', [tournamentCode]);
        }

        // Create tournament (user becomes host)
        const tournamentResult = await client.query(
            `INSERT INTO tournaments (unique_code, name, host_id, max_teams, team_budget) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [tournamentCode, name, req.user.id, max_teams, team_budget * 100000]
        );
        const tournament = tournamentResult.rows[0];

        // Create teams
        const teams = [];
        for (const teamName of team_names) {
            let teamCode = generateCode('TEAM');
            let teamExists = await client.query('SELECT id FROM teams WHERE unique_code = $1', [teamCode]);
            while (teamExists.rows.length > 0) {
                teamCode = generateCode('TEAM');
                teamExists = await client.query('SELECT id FROM teams WHERE unique_code = $1', [teamCode]);
            }

            const teamResult = await client.query(
                `INSERT INTO teams (unique_code, tournament_id, team_name, remaining_budget) 
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [teamCode, tournament.id, teamName, team_budget * 100000]
            );
            teams.push(teamResult.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ tournament, teams });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get tournaments where user is HOST
router.get('/my-tournaments', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    
    try {
        const result = await pool.query(
            `SELECT t.*, u.name as host_name 
             FROM tournaments t 
             JOIN users u ON t.host_id = u.id 
             WHERE t.host_id = $1 
             ORDER BY t.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tournaments where user is TEAM MEMBER
router.get('/my-participations', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    
    try {
        const result = await pool.query(
            `SELECT DISTINCT t.*, u.name as host_name
             FROM tournaments t
             JOIN users u ON t.host_id = u.id
             JOIN teams tm ON tm.tournament_id = t.id
             JOIN team_members tmem ON tmem.team_id = tm.id
             WHERE tmem.user_id = $1
             ORDER BY t.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Join tournament by code (just to view, not join team yet)
router.post('/join', authenticateToken, async (req, res) => {
    const { tournament_code } = req.body;
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            'SELECT * FROM tournaments WHERE unique_code = $1',
            [tournament_code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found with this code' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single tournament
router.get('/:id', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            `SELECT t.*, u.name as host_name 
             FROM tournaments t 
             JOIN users u ON t.host_id = u.id 
             WHERE t.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete tournament (only host can delete)
router.delete('/:id', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // First check if tournament exists and user is the host
        const tournamentResult = await client.query(
            'SELECT * FROM tournaments WHERE id = $1 AND host_id = $2',
            [req.params.id, req.user.id]
        );

        if (tournamentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Tournament not found or you are not the host' });
        }

        const tournament = tournamentResult.rows[0];

        // Check if tournament has any active auctions
        const activeAuctionResult = await client.query(
            'SELECT COUNT(*) as count FROM auction_rounds WHERE tournament_id = $1 AND status = $2',
            [req.params.id, 'active']
        );

        if (parseInt(activeAuctionResult.rows[0].count) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cannot delete tournament with active auctions' });
        }

        // Delete in order to respect foreign key constraints
        // 1. Delete auction rounds
        await client.query('DELETE FROM auction_rounds WHERE tournament_id = $1', [req.params.id]);
        
        // 2. Delete team members
        await client.query(
            'DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE tournament_id = $1)',
            [req.params.id]
        );
        
        // 3. Delete teams
        await client.query('DELETE FROM teams WHERE tournament_id = $1', [req.params.id]);
        
        // 4. Delete players
        await client.query('DELETE FROM players WHERE tournament_id = $1', [req.params.id]);
        
        // 5. Finally delete the tournament
        await client.query('DELETE FROM tournaments WHERE id = $1', [req.params.id]);

        await client.query('COMMIT');
        res.json({ message: 'Tournament deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Delete tournament error:', error);
        res.status(500).json({ error: 'Failed to delete tournament' });
    } finally {
        client.release();
    }
});

module.exports = router;
