const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

module.exports = (io, pool) => {
    // Track connected team owners per tournament: { tournament_id: Map<socket_id, { user_id, team_id, team_name }> }
    const tournamentPresence = new Map();

    // Helper: get connected owners for a tournament and broadcast
    const broadcastPresence = (tournamentId) => {
        const presence = tournamentPresence.get(String(tournamentId));
        if (!presence) return;
        const connectedOwners = Array.from(presence.values());
        io.to(`tournament_${tournamentId}`).emit('owner_presence_update', {
            connected_owners: connectedOwners
        });
    };

    // Middleware to authenticate socket connections
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) return next(new Error('Authentication error'));
            socket.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.id}`);

        // Join tournament room
        socket.on('join_tournament', async (tournamentId) => {
            socket.join(`tournament_${tournamentId}`);
            socket.tournamentId = tournamentId;
            console.log(`User ${socket.user.id} joined tournament ${tournamentId}`);

            // Check if this user is a team owner in this tournament
            try {
                const result = await pool.query(
                    `SELECT t.id as team_id, t.team_name, tm.member_role 
                     FROM teams t
                     JOIN team_members tm ON t.id = tm.team_id
                     WHERE t.tournament_id = $1 AND tm.user_id = $2 AND tm.member_role = 'owner'`,
                    [tournamentId, socket.user.id]
                );

                if (result.rows.length > 0) {
                    const team = result.rows[0];
                    if (!tournamentPresence.has(String(tournamentId))) {
                        tournamentPresence.set(String(tournamentId), new Map());
                    }
                    tournamentPresence.get(String(tournamentId)).set(socket.id, {
                        user_id: socket.user.id,
                        team_id: team.team_id,
                        team_name: team.team_name
                    });
                    broadcastPresence(tournamentId);
                }
            } catch (err) {
                console.error('Error checking team ownership:', err);
            }
            
            socket.emit('joined_tournament', { tournamentId });
        });

        // Leave tournament room
        socket.on('leave_tournament', (tournamentId) => {
            socket.leave(`tournament_${tournamentId}`);
            // Remove from presence tracking
            const presence = tournamentPresence.get(String(tournamentId));
            if (presence) {
                presence.delete(socket.id);
                broadcastPresence(tournamentId);
            }
            console.log(`User ${socket.user.id} left tournament ${tournamentId}`);
        });

        // Real-time bid notification (optional - bids are also handled via REST)
        socket.on('place_bid', async (data) => {
            const { auction_round_id, bid_amount, tournament_id } = data;
            
            // Broadcast bid to tournament room
            io.to(`tournament_${tournament_id}`).emit('bid_placed', {
                auction_round_id,
                bid_amount,
                user_id: socket.user.id,
                timestamp: new Date()
            });
        });

        // Admin broadcasts countdown timer
        socket.on('countdown_update', (data) => {
            const { tournament_id, seconds_remaining } = data;
            
            io.to(`tournament_${tournament_id}`).emit('countdown', {
                seconds_remaining
            });
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.id}`);
            // Remove from all tournament presence maps
            if (socket.tournamentId) {
                const presence = tournamentPresence.get(String(socket.tournamentId));
                if (presence) {
                    presence.delete(socket.id);
                    broadcastPresence(socket.tournamentId);
                }
            }
        });
    });

    // Expose presence check for auction routes
    io.getConnectedOwners = (tournamentId) => {
        const presence = tournamentPresence.get(String(tournamentId));
        if (!presence) return [];
        return Array.from(presence.values());
    };
};