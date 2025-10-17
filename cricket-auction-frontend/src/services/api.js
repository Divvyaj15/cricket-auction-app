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
    register: async (email, password, name) => {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
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
    create: async (name, max_teams, team_budget, team_names) => {
        const response = await fetch(`${API_BASE_URL}/tournaments/create`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, max_teams, team_budget, team_names })
        });
        return response.json();
    },

    joinByCode: async (tournament_code) => {
        const response = await fetch(`${API_BASE_URL}/tournaments/join`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_code })
        });
        return response.json();
    },

    // Get tournaments where current user is host
    getMyTournaments: async () => {
        const response = await fetch(`${API_BASE_URL}/tournaments/my-tournaments`, {
            headers: getHeaders()
        });
        return response.json();
    },

    // Get tournaments where current user participates in a team
    getMyParticipations: async () => {
        const response = await fetch(`${API_BASE_URL}/tournaments/my-participations`, {
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
    joinByCode: async (team_code, role) => {
        const response = await fetch(`${API_BASE_URL}/teams/join`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ team_code, role })
        });
        return response.json();
    },

    verifyTeamCode: async (team_code) => {
        const response = await fetch(`${API_BASE_URL}/teams/verify/${team_code}`, {
            headers: getHeaders()
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
    add: async (tournament_id, name, role, base_price_lakhs) => {
        const response = await fetch(`${API_BASE_URL}/players/add`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id, name, role, base_price: base_price_lakhs })
        });
        return response.json();
    },

    uploadCSV: async (tournament_id, file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tournament_id', tournament_id);

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/players/upload-csv`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        return response.json();
    },

    // No bulk endpoint on backend; use uploadCSV or call add() per player

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

    warn: async (auction_round_id, seconds = 10) => {
        const response = await fetch(`${API_BASE_URL}/auction/warn`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ auction_round_id, seconds })
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
    },

    giveUp: async (auction_round_id, team_id) => {
        const response = await fetch(`${API_BASE_URL}/auction/giveup`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ auction_round_id, team_id })
        });
        return response.json();
    },

    getGiveUps: async (auctionRoundId) => {
        const response = await fetch(`${API_BASE_URL}/auction/giveups/${auctionRoundId}`, {
            headers: getHeaders()
        });
        return response.json();
    },

    setCapacity: async (tournament_id, max_players_per_team) => {
        const response = await fetch(`${API_BASE_URL}/auction/capacity`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id, max_players_per_team })
        });
        return response.json();
    },

    distributeRemaining: async (tournament_id) => {
        const response = await fetch(`${API_BASE_URL}/auction/distribute`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id })
        });
        return response.json();
    },

    endAuction: async (tournament_id) => {
        const response = await fetch(`${API_BASE_URL}/auction/end`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ tournament_id })
        });
        return response.json();
    }
};