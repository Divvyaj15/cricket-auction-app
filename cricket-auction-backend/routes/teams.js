const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Join team by code (User becomes team member)
router.post('/join', authenticateToken, async (req, res) => {
    const { team_code, role } = req.body; // role: 'owner' or 'captain'
    const pool = req.app.get('db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Find team
        const teamResult = await client.query(
            'SELECT * FROM teams WHERE unique_code = $1',
            [team_code]
        );

        if (teamResult.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found with this code' });
        }

        const team = teamResult.rows[0];

        // Check if user already in this team
        const existingMember = await client.query(
            'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
            [team.id, req.user.id]
        );

        if (existingMember.rows.length > 0) {
            return res.status(400).json({ error: 'You have already joined this team' });
        }

        // Check if role is taken
        const roleCheck = await client.query(
            'SELECT * FROM team_members WHERE team_id = $1 AND member_role = $2',
            [team.id, role]
        );

        if (roleCheck.rows.length > 0) {
            return res.status(400).json({ error: `This team already has a ${role}` });
        }

        // Add user to team
        await client.query(
            'INSERT INTO team_members (team_id, user_id, member_role) VALUES ($1, $2, $3)',
            [team.id, req.user.id, role]
        );

        await client.query('COMMIT');
        res.json({ message: `Successfully joined ${team.team_name} as ${role}`, team });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get teams for tournament
router.get('/tournament/:tournamentId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            `SELECT t.*,
                    json_agg(
                        json_build_object(
                            'user_id', u.id,
                            'name', u.name,
                            'role', tm.member_role
                        )
                    ) FILTER (WHERE u.id IS NOT NULL) as members
             FROM teams t
             LEFT JOIN team_members tm ON t.id = tm.team_id
             LEFT JOIN users u ON tm.user_id = u.id
             WHERE t.tournament_id = $1
             GROUP BY t.id
             ORDER BY t.created_at`,
            [req.params.tournamentId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get my teams in tournament
router.get('/my-teams/:tournamentId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            `SELECT t.*, tm.member_role 
             FROM teams t
             JOIN team_members tm ON t.id = tm.team_id
             WHERE t.tournament_id = $1 AND tm.user_id = $2`,
            [req.params.tournamentId, req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

// Can current user bid for this team (owner or captain)
router.get('/can-bid/:teamId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');
    try {
        const result = await pool.query(
            `SELECT 1 FROM team_members 
             WHERE team_id = $1 AND user_id = $2 AND member_role IN ('owner','captain')`,
            [req.params.teamId, req.user.id]
        );
        res.json({ can_bid: result.rows.length > 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});