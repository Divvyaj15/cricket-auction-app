// src/services/api.js - API Service
// ============================================
const API_BASE_URL = 'http://localhost:5000/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

// Auth APIs
export const authAPI = {
    register: async (email, password, name, role) => {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, role })
        });
        return response.json();
    },

    login: async (email, password) => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return response.json();
    }
};

// Tournament APIs
export const tournamentAPI = {
    create: async (name, max_teams, team_budget) => {
        const response = await fetch(`${API_BASE_URL}/tournaments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, max_teams, team_budget })
        });
        return response.json();
    },

    getAll: async () => {
        const response = await fetch(`${API_BASE_URL}/tournaments`, {
            headers: getHeaders()
        });
        return response.json();
    },

    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/tournaments/${id}`, {
            headers: getHeaders()
        });
        return response.json();
    }
};

// Team APIs
export const teamAPI = {
    create: async (tournament_id, team_name, is_owner_also_captain) => {
        const response = await fetch(`${API_BASE_URL}/teams/create`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id, team_name, is_owner_also_captain })
        });
        return response.json();
    },

    inviteCaptain: async (team_id, captain_email) => {
        const response = await fetch(`${API_BASE_URL}/teams/invite-captain`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ team_id, captain_email })
        });
        return response.json();
    },

    getTeamsByTournament: async (tournamentId) => {
        const response = await fetch(`${API_BASE_URL}/teams/tournament/${tournamentId}`, {
            headers: getHeaders()
        });
        return response.json();
    },

    getMyTeams: async (tournamentId) => {
        const response = await fetch(`${API_BASE_URL}/teams/my-teams/${tournamentId}`, {
            headers: getHeaders()
        });
        return response.json();
    },

    canBid: async (teamId) => {
        const response = await fetch(`${API_BASE_URL}/teams/can-bid/${teamId}`, {
            headers: getHeaders()
        });
        return response.json();
    }
};

// Player APIs
export const playerAPI = {
    add: async (tournament_id, name, role, base_price) => {
        const response = await fetch(`${API_BASE_URL}/players`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id, name, role, base_price })
        });
        return response.json();
    },

    bulkAdd: async (tournament_id, players) => {
        const response = await fetch(`${API_BASE_URL}/players/bulk`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id, players })
        });
        return response.json();
    },

    delete: async (playerId) => {
        const response = await fetch(`${API_BASE_URL}/players/${playerId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return response.json();
    },

    getByTournament: async (tournamentId, status = null) => {
        const url = status 
            ? `${API_BASE_URL}/players/tournament/${tournamentId}?status=${status}`
            : `${API_BASE_URL}/players/tournament/${tournamentId}`;
        const response = await fetch(url, { headers: getHeaders() });
        return response.json();
    },

    getStats: async (tournamentId) => {
        const response = await fetch(`${API_BASE_URL}/players/tournament/${tournamentId}/stats`, {
            headers: getHeaders()
        });
        return response.json();
    }
};

// Auction APIs
export const auctionAPI = {
    start: async (tournament_id, player_id) => {
        const response = await fetch(`${API_BASE_URL}/auction/start`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id, player_id })
        });
        return response.json();
    },

    placeBid: async (auction_round_id, team_id, bid_amount) => {
        const response = await fetch(`${API_BASE_URL}/auction/bid`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ auction_round_id, team_id, bid_amount })
        });
        return response.json();
    },

    finalize: async (auction_round_id) => {
        const response = await fetch(`${API_BASE_URL}/auction/finalize`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ auction_round_id })
        });
        return response.json();
    },

    getActiveAuction: async (tournamentId) => {
        const response = await fetch(`${API_BASE_URL}/auction/active/${tournamentId}`, {
            headers: getHeaders()
        });
        return response.json();
    },

    getBidHistory: async (auctionRoundId) => {
        const response = await fetch(`${API_BASE_URL}/auction/bids/${auctionRoundId}`, {
            headers: getHeaders()
        });
        return response.json();
    },

    getPurchases: async (teamId) => {
        const response = await fetch(`${API_BASE_URL}/auction/purchases/team/${teamId}`, {
            headers: getHeaders()
        });
        return response.json();
    }
};

// Admin APIs removed per user request