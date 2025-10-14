// server.js - Main server file
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: 'http://localhost:3000', credentials: true }
});

// Database connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'cricket_auction',
    password: 'Parasmal@601',
    port: 5432,
});

app.use(cors());
app.use(express.json());

// Make pool and io available to routes
app.set('db', pool);
app.set('io', io);

// Routes
const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const playerRoutes = require('./routes/players');
const teamRoutes = require('./routes/teams');
const auctionRoutes = require('./routes/auction');

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/auction', auctionRoutes);
// Admin routes removed per user request

// Socket.io connection
require('./socket/auctionSocket')(io, pool);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
