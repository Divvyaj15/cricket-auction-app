// routes/auction.js - Auction Routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

async function isHost(pool, userId, tournamentId) {
    const result = await pool.query('SELECT host_id FROM tournaments WHERE id = $1', [tournamentId]);
    return result.rows.length > 0 && result.rows[0].host_id === userId;
}

// Ensure auxiliary tables exist (idempotent)
async function ensureGiveupsTable(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS auction_giveups (
            id SERIAL PRIMARY KEY,
            auction_round_id INTEGER NOT NULL REFERENCES auction_rounds(id) ON DELETE CASCADE,
            team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_giveups_round ON auction_giveups(auction_round_id);
        CREATE INDEX IF NOT EXISTS idx_giveups_team ON auction_giveups(team_id);
    `);
}

// Ensure tournaments has capacity column
async function ensureTournamentCapacity(pool) {
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='tournaments' AND column_name='max_players_per_team'
            ) THEN
                ALTER TABLE tournaments ADD COLUMN max_players_per_team INTEGER;
            END IF;
        END$$;
    `);
}

// Start auction for a player (Host only)
router.post('/start', authenticateToken, async (req, res) => {
    const { tournament_id, player_id } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');

    try {
        // Only the tournament host can start an auction
        const host = await isHost(pool, req.user.id, tournament_id);
        if (!host) {
            return res.status(403).json({ error: 'Only the tournament host can start an auction' });
        }

        // Check that all teams have an owner assigned
        const allTeams = await pool.query(
            'SELECT id, team_name FROM teams WHERE tournament_id = $1',
            [tournament_id]
        );

        if (allTeams.rows.length === 0) {
            return res.status(400).json({ error: 'No teams found in this tournament' });
        }

        // For each team, check if it has an owner
        const teamsWithOwners = await pool.query(
            `SELECT t.id, t.team_name, tm.user_id 
             FROM teams t 
             JOIN team_members tm ON t.id = tm.team_id 
             WHERE t.tournament_id = $1 AND tm.member_role = 'owner'`,
            [tournament_id]
        );

        const teamsWithOwnerIds = new Set(teamsWithOwners.rows.map(r => r.id));
        const teamsWithoutOwner = allTeams.rows.filter(t => !teamsWithOwnerIds.has(t.id));

        if (teamsWithoutOwner.length > 0) {
            const names = teamsWithoutOwner.map(t => t.team_name).join(', ');
            return res.status(400).json({ 
                error: `Cannot start auction. These teams have no owner yet: ${names}`,
                missing_teams: teamsWithoutOwner.map(t => ({ team_id: t.id, team_name: t.team_name }))
            });
        }

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
        // Ensure giveups table exists
        await ensureGiveupsTable(pool);

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

        // Check if team has given up on this auction
        const giveUpCheck = await pool.query(
            'SELECT * FROM auction_giveups WHERE auction_round_id = $1 AND team_id = $2',
            [auction_round_id, team_id]
        );

        if (giveUpCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Your team has given up on this player' });
        }

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

        // If there is an active countdown for this auction round, stop it on new bid
        try {
            const countdowns = req.app.get('auctionCountdowns') || new Map();
            const existing = countdowns.get(String(auction_round_id));
            if (existing && existing.timer) {
                clearInterval(existing.timer);
                countdowns.delete(String(auction_round_id));
                req.app.set('auctionCountdowns', countdowns);
                // Notify clients to clear any countdown UI
                io.to(`tournament_${auction.tournament_id}`).emit('countdown', { seconds_remaining: null });
            }
        } catch (_) {}

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
router.post('/finalize', authenticateToken, async (req, res) => {
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

        // Verify caller is host of this tournament
        const host = await isHost(pool, req.user.id, auction.tournament_id);
        if (!host) {
            throw new Error('Only the tournament host can finalize auctions');
        }

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

// Give up on current player (Team owners or captains)
router.post('/giveup', authenticateToken, async (req, res) => {
    const { auction_round_id, team_id } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');

    try {
        // Ensure giveups table exists
        await ensureGiveupsTable(pool);

        // Get auction round details
        const auctionResult = await pool.query(`
            SELECT ar.*, p.name as player_name 
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
            return res.status(403).json({ error: 'You do not have permission to give up for this team' });
        }

        // Check if team has already given up
        const existingGiveUp = await pool.query(
            'SELECT * FROM auction_giveups WHERE auction_round_id = $1 AND team_id = $2',
            [auction_round_id, team_id]
        );

        if (existingGiveUp.rows.length > 0) {
            return res.status(400).json({ error: 'Your team has already given up on this player' });
        }

        // Record the give up
        await pool.query(
            'INSERT INTO auction_giveups (auction_round_id, team_id, user_id) VALUES ($1, $2, $3)',
            [auction_round_id, team_id, req.user.id]
        );

        // Get team details
        const teamResult = await pool.query(
            'SELECT team_name FROM teams WHERE id = $1',
            [team_id]
        );

        const team = teamResult.rows[0];

        // Emit give up notification to all clients
        io.to(`tournament_${auction.tournament_id}`).emit('team_gave_up', {
            auction_round_id,
            team_id: team_id,
            team_name: team.team_name,
            player_name: auction.player_name
        });

        res.json({ message: 'Successfully gave up on this player' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get teams that have given up on current auction
router.get('/giveups/:auctionRoundId', authenticateToken, async (req, res) => {
    const pool = req.app.get('db');

    try {
        // Ensure giveups table exists
        await ensureGiveupsTable(pool);

        const result = await pool.query(`
            SELECT ag.*, t.team_name 
            FROM auction_giveups ag 
            JOIN teams t ON ag.team_id = t.id 
            WHERE ag.auction_round_id = $1 
            ORDER BY ag.created_at DESC
        `, [req.params.auctionRoundId]);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set or update max players per team (host only)
router.post('/capacity', authenticateToken, async (req, res) => {
    const { tournament_id, max_players_per_team } = req.body;
    const pool = req.app.get('db');
    try {
        await ensureTournamentCapacity(pool);
        const host = await isHost(pool, req.user.id, tournament_id);
        if (!host) return res.status(403).json({ error: 'Only host can set capacity' });
        await pool.query('UPDATE tournaments SET max_players_per_team = $1 WHERE id = $2', [max_players_per_team, tournament_id]);
        res.json({ updated: true, max_players_per_team });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Randomly distribute remaining players to teams with capacity and budget
router.post('/distribute', authenticateToken, async (req, res) => {
    const { tournament_id } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');
    const client = await pool.connect();
    try {
        await ensureTournamentCapacity(pool);
        const host = await isHost(pool, req.user.id, tournament_id);
        if (!host) return res.status(403).json({ error: 'Only host can distribute players' });

        await client.query('BEGIN');
        const tRes = await client.query('SELECT max_players_per_team FROM tournaments WHERE id = $1', [tournament_id]);
        const maxPerTeam = tRes.rows[0]?.max_players_per_team || null;
        if (!maxPerTeam) throw new Error('Set max players per team first');

        const teamsRes = await client.query('SELECT id, remaining_budget FROM teams WHERE tournament_id = $1', [tournament_id]);
        const teams = teamsRes.rows;

        // Current roster sizes
        const rosterRes = await client.query(`
            SELECT team_id, COUNT(*) as count
            FROM purchases WHERE tournament_id = $1
            GROUP BY team_id
        `, [tournament_id]);
        const teamCount = new Map(rosterRes.rows.map(r => [r.team_id, parseInt(r.count, 10)]));

        // Available players ordered randomly
        const playersRes = await client.query('SELECT * FROM players WHERE tournament_id = $1 AND status = $2 ORDER BY RANDOM()', [tournament_id, 'available']);
        const players = playersRes.rows;

        const assignments = [];
        for (const player of players) {
            // candidates: teams with capacity and budget
            const candidates = teams.filter(team => (teamCount.get(team.id) || 0) < maxPerTeam && team.remaining_budget >= player.base_price);
            if (candidates.length === 0) continue;
            const pick = candidates[Math.floor(Math.random() * candidates.length)];

            // assign: create purchase at base price
            await client.query('INSERT INTO purchases (tournament_id, player_id, team_id, purchase_price) VALUES ($1, $2, $3, $4)', [tournament_id, player.id, pick.id, player.base_price]);
            await client.query('UPDATE teams SET remaining_budget = remaining_budget - $1 WHERE id = $2', [player.base_price, pick.id]);
            await client.query('UPDATE players SET status = $1 WHERE id = $2', ['sold', player.id]);
            teamCount.set(pick.id, (teamCount.get(pick.id) || 0) + 1);
            assignments.push({ player_id: player.id, team_id: pick.id, price: player.base_price });
        }
        await client.query('COMMIT');

        // notify
        io.to(`tournament_${tournament_id}`).emit('distribution_complete', { assignments });
        res.json({ assigned: assignments.length, assignments });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});

// End auction and provide summary
router.post('/end', authenticateToken, async (req, res) => {
    const { tournament_id } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');
    try {
        const host = await isHost(pool, req.user.id, tournament_id);
        if (!host) return res.status(403).json({ error: 'Only host can end the auction' });
        await ensureTournamentCapacity(pool);

        // Condition 1: all players sold (no available players)
        const availableRes = await pool.query('SELECT COUNT(*)::int AS remaining FROM players WHERE tournament_id = $1 AND status = $2', [tournament_id, 'available']);
        const remainingPlayers = availableRes.rows[0]?.remaining || 0;

        // Condition 2: all teams at capacity (if capacity set)
        const capRes = await pool.query('SELECT max_players_per_team FROM tournaments WHERE id = $1', [tournament_id]);
        const maxPerTeam = capRes.rows[0]?.max_players_per_team || null;
        let allTeamsFull = false;
        if (maxPerTeam) {
            const roster = await pool.query(`
                SELECT t.id, COALESCE(COUNT(pur.id),0) AS count
                FROM teams t
                LEFT JOIN purchases pur ON pur.team_id = t.id AND pur.tournament_id = $1
                WHERE t.tournament_id = $1
                GROUP BY t.id
            `, [tournament_id]);
            allTeamsFull = roster.rows.every(r => parseInt(r.count, 10) >= maxPerTeam);
        }

        if (!(remainingPlayers === 0 || allTeamsFull)) {
            return res.status(400).json({ error: 'Cannot end auction: players remaining and not all teams at capacity' });
        }

        // Update tournament status to completed
        await pool.query('UPDATE tournaments SET status = $1 WHERE id = $2', ['completed', tournament_id]);

        // Summary data
        const teams = (await pool.query('SELECT id, team_name, remaining_budget FROM teams WHERE tournament_id = $1', [tournament_id])).rows;
        const purchases = (await pool.query(`
            SELECT pur.*, p.name, p.role, t.team_name
            FROM purchases pur
            JOIN players p ON p.id = pur.player_id
            JOIN teams t ON t.id = pur.team_id
            WHERE pur.tournament_id = $1
            ORDER BY t.team_name, pur.purchased_at DESC
        `, [tournament_id])).rows;
        const unsold = (await pool.query('SELECT * FROM players WHERE tournament_id = $1 AND status = $2', [tournament_id, 'available'])).rows;
        // Emit to all clients so live rooms can close gracefully
        io.to(`tournament_${tournament_id}`).emit('auction_ended', { tournament_id });

        res.json({ teams, purchases, unsold });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
module.exports = router;

// Host-triggered countdown warning that auto-finalizes when it reaches zero
router.post('/warn', authenticateToken, async (req, res) => {
    const { auction_round_id, seconds } = req.body;
    const pool = req.app.get('db');
    const io = req.app.get('io');

    // Helper to emit countdown to the tournament room
    const emitCountdown = (tournamentId, secs) => {
        io.to(`tournament_${tournamentId}`).emit('countdown', { seconds_remaining: secs });
    };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const auctionResult = await client.query(`
            SELECT ar.*, p.id as player_id, p.name as player_name, t.host_id
            FROM auction_rounds ar
            JOIN players p ON ar.player_id = p.id
            JOIN tournaments t ON t.id = ar.tournament_id
            WHERE ar.id = $1 AND ar.status = 'active'
        `, [auction_round_id]);

        if (auctionResult.rows.length === 0) {
            throw new Error('Active auction round not found');
        }

        const auction = auctionResult.rows[0];

        // Only host can warn
        if (auction.host_id !== req.user.id) {
            throw new Error('Only the tournament host can warn/finalize');
        }

        await client.query('COMMIT');

        const totalSeconds = Math.max(5, Math.min(60, parseInt(seconds || 10))); // clamp 5..60s
        let remaining = totalSeconds;
        emitCountdown(auction.tournament_id, remaining);

        const timer = setInterval(async () => {
            remaining -= 1;
            emitCountdown(auction.tournament_id, remaining);

            if (remaining <= 0) {
                clearInterval(timer);

                const c = await pool.connect();
                try {
                    await c.query('BEGIN');
                    const arRes = await c.query('SELECT * FROM auction_rounds WHERE id = $1 FOR UPDATE', [auction_round_id]);
                    if (arRes.rows.length === 0) {
                        await c.query('ROLLBACK');
                        return;
                    }
                    const current = arRes.rows[0];

                    // If already completed, skip
                    if (current.status !== 'active') {
                        await c.query('ROLLBACK');
                        return;
                    }

                    if (current.current_bidder_team_id) {
                        // Winner exists → create purchase, update budgets and player status
                        await c.query(
                            'INSERT INTO purchases (tournament_id, player_id, team_id, purchase_price) VALUES ($1, $2, $3, $4)',
                            [current.tournament_id, current.player_id, current.current_bidder_team_id, current.current_bid]
                        );
                        await c.query(
                            'UPDATE teams SET remaining_budget = remaining_budget - $1 WHERE id = $2',
                            [current.current_bid, current.current_bidder_team_id]
                        );
                        await c.query('UPDATE players SET status = $1 WHERE id = $2', ['sold', current.player_id]);

                        // Emit finalization
                        const teamNameRes = await c.query('SELECT team_name FROM teams WHERE id = $1', [current.current_bidder_team_id]);
                        io.to(`tournament_${current.tournament_id}`).emit('auction_finalized', {
                            auction_round_id,
                            player_id: current.player_id,
                            player_name: auction.player_name,
                            winning_team_id: current.current_bidder_team_id,
                            winning_team_name: teamNameRes.rows[0].team_name,
                            final_price: current.current_bid,
                            status: 'sold'
                        });
                    } else {
                        // No bids → mark unsold
                        await c.query('UPDATE players SET status = $1 WHERE id = $2', ['unsold', current.player_id]);
                        io.to(`tournament_${current.tournament_id}`).emit('auction_finalized', {
                            auction_round_id,
                            player_id: current.player_id,
                            player_name: auction.player_name,
                            status: 'unsold'
                        });
                    }

                    await c.query('UPDATE auction_rounds SET status = $1, ended_at = NOW() WHERE id = $2', ['completed', auction_round_id]);
                    await c.query('COMMIT');
                } catch (err) {
                    await c.query('ROLLBACK');
                } finally {
                    c.release();
                }
            }
        }, 1000);

        // Save timer in app context so it can be cleared when a new bid arrives
        const countdowns = req.app.get('auctionCountdowns') || new Map();
        countdowns.set(String(auction_round_id), { timer, tournament_id: auction.tournament_id });
        req.app.set('auctionCountdowns', countdowns);

        res.json({ started: true, seconds: totalSeconds });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});
