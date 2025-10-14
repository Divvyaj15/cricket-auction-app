const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

module.exports = (io, pool) => {
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
        socket.on('join_tournament', (tournamentId) => {
            socket.join(`tournament_${tournamentId}`);
            console.log(`User ${socket.user.id} joined tournament ${tournamentId}`);
            
            socket.emit('joined_tournament', { tournamentId });
        });

        // Leave tournament room
        socket.on('leave_tournament', (tournamentId) => {
            socket.leave(`tournament_${tournamentId}`);
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
        });
    });
};