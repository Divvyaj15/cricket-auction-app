import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
    if (socket) return socket;

    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
    socket = io(backendUrl, {
        auth: { token }
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export const joinTournament = (tournamentId) => {
    if (socket) {
        socket.emit('join_tournament', tournamentId);
    }
};

export const leaveTournament = (tournamentId) => {
    if (socket) {
        socket.emit('leave_tournament', tournamentId);
    }
};

export const onAuctionStarted = (callback) => {
    if (socket) {
        socket.on('auction_started', callback);
    }
};

export const onNewBid = (callback) => {
    if (socket) {
        socket.on('new_bid', callback);
    }
};

export const onAuctionFinalized = (callback) => {
    if (socket) {
        socket.on('auction_finalized', callback);
    }
};

export const onCountdown = (callback) => {
    if (socket) {
        socket.on('countdown', callback);
    }
};

export const onTeamGaveUp = (callback) => {
    if (socket) {
        socket.on('team_gave_up', callback);
    }
};

export const onAuctionEnded = (callback) => {
    if (socket) {
        socket.on('auction_ended', callback);
    }
};

export const getSocket = () => socket;