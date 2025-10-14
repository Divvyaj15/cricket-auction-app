const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// Create team (Owner creates and joins as owner)
router.post('/create', authenticateToken, async (req, res) => {
    const { tournament_id, team_name, is_owner_also_captain } = req.body;
    const pool = req.app.get('db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get tournament budget
        const tournamentResult = await client.query(
            'SELECT team_budget, max_teams, status FROM tournaments WHERE id = $1',
            [tournament_id]
        );

        if (tournamentResult.rows.length === 0) {
            throw new Error('Tournament not found');
        }

        const tournament = tournamentResult.rows[0];

        if (tournament.status !== 'draft' && tournament.status !== 'registration') {
            throw new Error('Tournament registration is closed');
        }

        // Check team limit
        const teamCountResult = await client.query(
            'SELECT COUNT(*) as count FROM teams WHERE tournament_id = $1',
            [tournament_id]
        );

        if (parseInt(teamCountResult.rows[0].count) >= tournament.max_teams) {
            throw new Error('Tournament is full');
        }

        // Create team
        const teamResult = await client.query(
            'INSERT INTO teams (tournament_id, team_name, remaining_budget) VALUES ($1, $2, $3) RETURNING *',
            [tournament_id, team_name, tournament.team_budget]
        );

        const team = teamResult.rows[0];

        // Add creator as owner
        await client.query(
            'INSERT INTO team_members (team_id, user_id, member_role, can_bid) VALUES ($1, $2, $3, $4)',
            [team.id, req.user.id, 'owner', true]
        );

        // If owner is also captain, add captain role
        if (is_owner_also_captain) {
            await client.query(
                'INSERT INTO team_members (team_id, user_id, member_role, can_bid) VALUES ($1, $2, $3, $4)',
                [team.id, req.user.id, 'captain', true]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            team,
            role: is_owner_also_captain ? 'owner_and_captain' : 'owner'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Invite captain (Owner only)
router.post('/invite-captain', authenticateToken, async (req, res) => {
    const { team_id, captain_email } = req.body;
    const pool = req.app.get('db');

    try {
        // Verify user is the team owner
        const ownerCheck = await pool.query(
            'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND member_role = $3',
            [team_id, req.user.id, 'owner']
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Only team owner can invite captain' });
        }

        // Check if captain already exists
        const captainCheck = await pool.query(
            'SELECT * FROM team_members WHERE team_id = $1 AND member_role = $2',
            [team_id, 'captain']
        );

        if (captainCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Team already has a captain' });
        }

        // Find user by email
        const userResult = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [captain_email]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        const captain = userResult.rows[0];

        // Add captain to team
        await pool.query(
            'INSERT INTO team_members (team_id, user_id, member_role, can_bid) VALUES ($1, $2, $3, $4)',
            [team_id, captain.id, 'captain', true]
        );

        res.json({ message: 'Captain added successfully', captain: { id: captain.id, name: captain.name, email: captain.email } });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get teams in a tournament
router.get('/tournament/:tournamentId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT t.*,
                   json_agg(
                       json_build_object(
                           'user_id', u.id,
                           'name', u.name,
                           'email', u.email,
                           'role', tm.member_role,
                           'can_bid', tm.can_bid
                       )
                   ) as members
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN users u ON tm.user_id = u.id
            WHERE t.tournament_id = $1
            GROUP BY t.id
            ORDER BY t.created_at
        `, [req.params.tournamentId]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get my teams in a tournament
router.get('/my-teams/:tournamentId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT t.*, tm.member_role, tm.can_bid
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            WHERE t.tournament_id = $1 AND tm.user_id = $2
        `, [req.params.tournamentId, req.user.id]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check if user can bid for a team
router.get('/can-bid/:teamId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(
            'SELECT can_bid FROM team_members WHERE team_id = $1 AND user_id = $2',
            [req.params.teamId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.json({ can_bid: false, message: 'Not a member of this team' });
        }

        res.json({ can_bid: result.rows[0].can_bid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;