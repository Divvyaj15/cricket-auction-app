// routes/auction.js - Auction Routes
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Start auction for a player (Admin only)
router.post('/start', authenticateToken, requireAdmin, async (req, res) => {
    const { tournament_id, player_id } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');

    try {
        // Check if player exists and is available
        const playerResult = await pool.query(
            'SELECT * FROM players WHERE id = $1 AND tournament_id = $2 AND status = $3',
            [player_id, tournament_id, 'available']
        );

        if (playerResult.rows.length === 0) {
            return res.status(400).json({ error: 'Player not available for auction' });
        }

        const player = playerResult.rows[0];

        // Create auction round
        const auctionResult = await pool.query(
            'INSERT INTO auction_rounds (tournament_id, player_id, current_bid, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [tournament_id, player_id, player.base_price, 'active']
        );

        // Update player status
        await pool.query(
            'UPDATE players SET status = $1 WHERE id = $2',
            ['in_auction', player_id]
        );

        const auctionRound = auctionResult.rows[0];

        // Emit to all clients in tournament room
        io.to(`tournament_${tournament_id}`).emit('auction_started', {
            auction_round: auctionRound,
            player: player
        });

        res.status(201).json({ auction_round: auctionRound, player });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Place a bid (Team owners or captains)
router.post('/bid', authenticateToken, async (req, res) => {
    const { auction_round_id, team_id, bid_amount } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');

    try {
        // Get auction round details
        const auctionResult = await pool.query(`
            SELECT ar.*, p.base_price, p.name as player_name 
            FROM auction_rounds ar 
            JOIN players p ON ar.player_id = p.id 
            WHERE ar.id = $1 AND ar.status = 'active'
        `, [auction_round_id]);

        if (auctionResult.rows.length === 0) {
            return res.status(400).json({ error: 'Auction round not active' });
        }

        const auction = auctionResult.rows[0];

        // Verify user is a member of the team and can bid
        const memberCheck = await pool.query(
            'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND can_bid = true',
            [team_id, req.user.id]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'You do not have permission to bid for this team' });
        }

        const member = memberCheck.rows[0];

        // Get team details
        const teamResult = await pool.query(
            'SELECT * FROM teams WHERE id = $1 AND tournament_id = $2',
            [team_id, auction.tournament_id]
        );

        if (teamResult.rows.length === 0) {
            return res.status(403).json({ error: 'Team not found in this tournament' });
        }

        const team = teamResult.rows[0];

        // Validate bid amount
        if (bid_amount <= auction.current_bid) {
            return res.status(400).json({ error: 'Bid must be higher than current bid' });
        }

        if (bid_amount > team.remaining_budget) {
            return res.status(400).json({ error: 'Insufficient budget' });
        }

        // Minimum increment check (optional - e.g., ₹50,000)
        const MIN_INCREMENT = 50000;
        if (auction.current_bid && (bid_amount - auction.current_bid) < MIN_INCREMENT) {
            return res.status(400).json({ error: `Minimum bid increment is ₹${MIN_INCREMENT}` });
        }

        // Record the bid
        const bidResult = await pool.query(
            'INSERT INTO bids (auction_round_id, team_id, user_id, bid_amount) VALUES ($1, $2, $3, $4) RETURNING *',
            [auction_round_id, team_id, req.user.id, bid_amount]
        );

        // Update auction round
        await pool.query(
            'UPDATE auction_rounds SET current_bid = $1, current_bidder_team_id = $2, current_bidder_user_id = $3 WHERE id = $4',
            [bid_amount, team_id, req.user.id, auction_round_id]
        );

        const bid = bidResult.rows[0];

        // Get bidder name
        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
        const bidder_name = userResult.rows[0].name;

        // Emit bid update to all clients
        io.to(`tournament_${auction.tournament_id}`).emit('new_bid', {
            auction_round_id,
            bid_amount,
            team_name: team.team_name,
            team_id: team.id,
            bidder_name,
            bidder_role: member.member_role,
            player_name: auction.player_name
        });

        res.status(201).json(bid);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Finalize auction (Host only)
router.post('/finalize', authenticateToken, requireAdmin, async (req, res) => {
    const { auction_round_id } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get auction details
        const auctionResult = await client.query(`
            SELECT ar.*, p.id as player_id, p.name as player_name 
            FROM auction_rounds ar 
            JOIN players p ON ar.player_id = p.id 
            WHERE ar.id = $1
        `, [auction_round_id]);

        if (auctionResult.rows.length === 0) {
            throw new Error('Auction round not found');
        }

        const auction = auctionResult.rows[0];

        if (auction.current_bidder_team_id) {
            // Create purchase record
            await client.query(
                'INSERT INTO purchases (tournament_id, player_id, team_id, purchase_price) VALUES ($1, $2, $3, $4)',
                [auction.tournament_id, auction.player_id, auction.current_bidder_team_id, auction.current_bid]
            );

            // Update team budget
            await client.query(
                'UPDATE teams SET remaining_budget = remaining_budget - $1 WHERE id = $2',
                [auction.current_bid, auction.current_bidder_team_id]
            );

            // Update player status
            await client.query(
                'UPDATE players SET status = $1 WHERE id = $2',
                ['sold', auction.player_id]
            );

            // Get winning team name
            const teamResult = await client.query(
                'SELECT team_name FROM teams WHERE id = $1',
                [auction.current_bidder_team_id]
            );

            await client.query('COMMIT');

            // Emit finalization to all clients
            io.to(`tournament_${auction.tournament_id}`).emit('auction_finalized', {
                auction_round_id,
                player_id: auction.player_id,
                player_name: auction.player_name,
                winning_team_id: auction.current_bidder_team_id,
                winning_team_name: teamResult.rows[0].team_name,
                final_price: auction.current_bid,
                status: 'sold'
            });

            res.json({ 
                message: 'Auction finalized successfully',
                winner: teamResult.rows[0].team_name,
                price: auction.current_bid
            });
        } else {
            // No bids - mark as unsold
            await client.query(
                'UPDATE players SET status = $1 WHERE id = $2',
                ['unsold', auction.player_id]
            );

            await client.query('COMMIT');

            // Emit finalization to all clients
            io.to(`tournament_${auction.tournament_id}`).emit('auction_finalized', {
                auction_round_id,
                player_id: auction.player_id,
                player_name: auction.player_name,
                status: 'unsold'
            });

            res.json({ message: 'Player went unsold' });
        }

        // Update auction round
        await pool.query(
            'UPDATE auction_rounds SET status = $1, ended_at = NOW() WHERE id = $2',
            ['completed', auction_round_id]
        );

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get current active auction for a tournament
router.get('/active/:tournamentId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT ar.*, p.name as player_name, p.role, p.base_price,
                   t.team_name as current_bidder_name
            FROM auction_rounds ar
            JOIN players p ON ar.player_id = p.id
            LEFT JOIN teams t ON ar.current_bidder_team_id = t.id
            WHERE ar.tournament_id = $1 AND ar.status = 'active'
            ORDER BY ar.started_at DESC
            LIMIT 1
        `, [req.params.tournamentId]);

        res.json(result.rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get bid history for an auction round
router.get('/bids/:auctionRoundId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT b.*, t.team_name 
            FROM bids b 
            JOIN teams t ON b.team_id = t.id 
            WHERE b.auction_round_id = $1 
            ORDER BY b.created_at DESC
        `, [req.params.auctionRoundId]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get purchased players for a team
router.get('/purchases/team/:teamId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        const result = await pool.query(`
            SELECT p.*, pur.purchase_price 
            FROM purchases pur 
            JOIN players p ON pur.player_id = p.id 
            WHERE pur.team_id = $1 
            ORDER BY pur.purchased_at DESC
        `, [req.params.teamId]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
