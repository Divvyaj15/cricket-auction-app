const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Force IPv4 first to fix Supabase ENETUNREACH on IPv6
dns.setDefaultResultOrder('ipv4first');

// Load environment variables
const result = dotenv.config({ path: path.join(__dirname, '.env') });
if (result.error) {
    console.error('Error loading .env file:', result.error);
} else {
    console.log('✅ .env file loaded successfully');
    console.log('Parsed result:', result.parsed);
    console.log('Email config check:', {
        EMAIL_SERVICE: process.env.EMAIL_SERVICE,
        EMAIL_USER: process.env.EMAIL_USER,
        EMAIL_PASS: process.env.EMAIL_PASS ? '***' : 'NOT SET'
    });
}

const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);
            if (origin.endsWith('.vercel.app') || origin.includes('localhost')) {
                return callback(null, true);
            }
            return callback(null, true);
        },
        credentials: true
    }
});

// Database connection
const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            user: process.env.PGUSER || 'postgres',
            host: process.env.PGHOST || 'localhost',
            database: process.env.PGDATABASE || 'cricket_auction',
            password: process.env.PGPASSWORD,
            port: Number(process.env.PGPORT) || 5432,
            ssl: process.env.PGHOST && process.env.PGHOST !== 'localhost'
                ? { rejectUnauthorized: false }
                : false,
        }
);

const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:3000']
    : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin.startsWith(allowed) || allowed === origin)) {
            return callback(null, true);
        }
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for OAuth form

// Make pool and io available to routes
app.set('db', pool);
app.set('io', io);

// Import routes
const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const teamRoutes = require('./routes/teams');
const playerRoutes = require('./routes/players');
const auctionRoutes = require('./routes/auction');
const oauthRoutes = require('./routes/oauth');          // ← added

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/oauth', oauthRoutes);                         // ← added

// Socket.io
require('./socket/auctionSocket')(io, pool);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));