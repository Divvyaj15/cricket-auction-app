// src/pages/Dashboard.js
// ============================================
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { tournamentAPI } from '../services/api';

const Dashboard = () => {
    const [tournaments, setTournaments] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTournament, setNewTournament] = useState({
        name: '',
        max_teams: '',
        team_budget: ''
    });
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTournaments();
    }, []);

    const fetchTournaments = async () => {
        const data = await tournamentAPI.getAll();
        setTournaments(data);
    };

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        const data = await tournamentAPI.create(
            newTournament.name,
            newTournament.max_teams,
            newTournament.team_budget
        );

        if (!data.error) {
            setShowCreateModal(false);
            setNewTournament({ name: '', max_teams: 8, team_budget: 100000 });
            fetchTournaments();
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-2xl font-bold text-gray-800">Cricket Auction Platform</h1>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-600">Welcome, {user?.name}</span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                {user?.role === 'host' ? 'Host' : 'Team Member'}
                            </span>
                            <button
                                onClick={logout}
                                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-gray-800">Tournaments</h2>
                    {user?.role === 'host' && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                        >
                            Create Tournament
                        </button>
                    )}
                </div>

                {/* Tournaments Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournaments.map((tournament) => (
                        <div
                            key={tournament.id}
                            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
                            onClick={() => navigate(`/tournament/${tournament.id}`)}
                        >
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{tournament.name}</h3>
                            <div className="space-y-2 text-sm text-gray-600">
                                <p>Host: {tournament.host_name}</p>
                                <p>Max Teams: {tournament.max_teams}</p>
                                <p>Budget: ₹{(tournament.team_budget / 100000).toFixed(1)} Cr</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                                    tournament.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                    tournament.status === 'auction' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {tournament.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {tournaments.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No tournaments available yet.
                    </div>
                )}
            </div>

            {/* Create Tournament Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-4">Create Tournament</h3>
                        <form onSubmit={handleCreateTournament} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tournament Name
                                </label>
                                <input
                                    type="text"
                                    value={newTournament.name}
                                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Max Teams
                                </label>
                                <input
                                    type="number"
                                    value={newTournament.max_teams}
                                    onChange={(e) => setNewTournament({ ...newTournament, max_teams: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    min="2"
                                    max="16"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Team Budget (₹ in Lakhs)
                                </label>
                                <input
                                    type="number"
                                    value={newTournament.team_budget / 100000}
                                    onChange={(e) => setNewTournament({ ...newTournament, team_budget: parseFloat(e.target.value) * 100000 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    step="0.1"
                                    required
                                />
                            </div>

                            <div className="flex space-x-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Create
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;