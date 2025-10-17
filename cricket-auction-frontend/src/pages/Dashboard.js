import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { tournamentAPI } from '../services/api';

const Dashboard = () => {
    const [hostedTournaments, setHostedTournaments] = useState([]);
    const [participatingTournaments, setParticipatingTournaments] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tournamentCode, setTournamentCode] = useState('');
    const [newTournament, setNewTournament] = useState({
        name: '',
        max_teams: '',
        team_budget: '',
        team_names: ['']
    });
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTournaments();
    }, []);

    const fetchTournaments = async () => {
        setLoading(true);
        try {
            const [hosted, participating] = await Promise.all([
                tournamentAPI.getMyTournaments(),
                tournamentAPI.getMyParticipations()
            ]);
            setHostedTournaments(hosted || []);
            setParticipatingTournaments(participating || []);
        } catch (error) {
            console.error('Error fetching tournaments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTeamName = () => {
        // disabled; number of team inputs is controlled by max_teams
    };

    const handleRemoveTeamName = () => {};

    const handleTeamNameChange = (index, value) => {
        setNewTournament(prev => ({
            ...prev,
            team_names: prev.team_names.map((name, i) => i === index ? value : name)
        }));
    };

    // Keep team_names length exactly equal to max_teams
    useEffect(() => {
        const count = parseInt(newTournament.max_teams);
        if (!count || count < 0) return;
        setNewTournament(prev => {
            const current = prev.team_names || [];
            let next = current;
            if (current.length < count) {
                next = [...current, ...Array(count - current.length).fill('')];
            } else if (current.length > count) {
                next = current.slice(0, count);
            }
            return { ...prev, team_names: next };
        });
    }, [newTournament.max_teams]);

    const handleCreateTournament = async (e) => {
        e.preventDefault();
        
        const count = parseInt(newTournament.max_teams);
        const filteredNames = newTournament.team_names.map(n => n.trim()).filter(Boolean);

        if (!count || filteredNames.length !== count) {
            alert(`Please provide exactly ${count || 0} team name(s)`);
            return;
        }

        try {
            const data = await tournamentAPI.create(
                newTournament.name,
                parseInt(newTournament.max_teams),
                parseFloat(newTournament.team_budget),
                filteredNames
            );

            if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert('Tournament created successfully!');
                setShowCreateModal(false);
                setNewTournament({ name: '', max_teams: '', team_budget: '', team_names: [''] });
                fetchTournaments();
            }
        } catch (error) {
            alert('Error creating tournament. Please check console.');
            console.error(error);
        }
    };

    const handleJoinTournament = async (e) => {
        e.preventDefault();
        
        try {
            const data = await tournamentAPI.joinByCode(tournamentCode);
            
            if (data.error) {
                alert('Error: ' + data.error);
            } else if (data.id) {
                navigate(`/tournament/${data.id}`);
            }
        } catch (error) {
            alert('Error joining tournament');
            console.error(error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="text-6xl mb-4">🏏</div>
                    <p className="text-xl font-semibold">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-xl">🏏</span>
                            </div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                Cricket Auction
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                                <p className="text-xs text-gray-500">{user?.email}</p>
                            </div>
                            <button
                                onClick={logout}
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Hero */}
                <div className="mb-8">
                    <h2 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
                    <p className="text-gray-600">Create tournaments, join teams, and participate in live auctions</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                        ➕ Create Tournament
                    </button>
                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                        🎫 Join Tournament
                    </button>
                </div>

                {/* Hosted Tournaments */}
                {hostedTournaments.length > 0 && (
                    <div className="mb-12">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">My Tournaments (Host)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {hostedTournaments.map((tournament) => (
                                <div
                                    key={tournament.id}
                                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                                    className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all cursor-pointer border border-gray-100 overflow-hidden group"
                                >
                                    <div className="h-2 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                                    <div className="p-6">
                                        <h4 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-indigo-600 transition">
                                            {tournament.name}
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Code:</span>
                                                <code className="font-mono font-semibold text-indigo-600">{tournament.unique_code}</code>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Teams:</span>
                                                <span className="font-semibold">{tournament.max_teams}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Budget:</span>
                                                <span className="font-semibold">₹{(tournament.team_budget / 100000).toFixed(1)} L</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t">
                                            <div className="text-center text-sm font-semibold text-indigo-600">
                                                Manage →
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Participating Tournaments */}
                {participatingTournaments.length > 0 && (
                    <div className="mb-12">
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">My Teams (Participant)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {participatingTournaments.map((tournament) => (
                                <div
                                    key={tournament.id}
                                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                                    className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all cursor-pointer border border-gray-100 overflow-hidden group"
                                >
                                    <div className="h-2 bg-gradient-to-r from-green-600 to-teal-600"></div>
                                    <div className="p-6">
                                        <h4 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-green-600 transition">
                                            {tournament.name}
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Host:</span>
                                                <span className="font-semibold">{tournament.host_name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Budget:</span>
                                                <span className="font-semibold">₹{(tournament.team_budget / 100000).toFixed(1)} L</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t">
                                            <div className="text-center text-sm font-semibold text-green-600">
                                                View →
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {hostedTournaments.length === 0 && participatingTournaments.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="text-6xl mb-4">🏆</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No tournaments yet</h3>
                        <p className="text-gray-600 mb-6">Create a tournament or join a team to get started</p>
                    </div>
                )}
            </div>

            {/* Create Tournament Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold mb-6">Create Tournament</h3>
                        
                        <form onSubmit={handleCreateTournament} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Tournament Name</label>
                                <input
                                    type="text"
                                    value={newTournament.name}
                                    onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    placeholder="College Premier League 2025"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Max Teams</label>
                                    <input
                                        type="number"
                                        value={newTournament.max_teams}
                                        onChange={(e) => setNewTournament({...newTournament, max_teams: e.target.value})}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="8"
                                        min="2"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Budget (₹ Lakhs)</label>
                                    <input
                                        type="number"
                                        value={newTournament.team_budget}
                                        onChange={(e) => setNewTournament({...newTournament, team_budget: e.target.value})}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        placeholder="100"
                                        step="0.1"
                                        min="0.1"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="block text-sm font-semibold">Team Names</label>
                                    <button
                                        type="button"
                                        onClick={handleAddTeamName}
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                                    >
                                        + Add Team
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {newTournament.team_names.map((name, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => handleTeamNameChange(index, e.target.value)}
                                                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg"
                                                placeholder={`Team ${index + 1}`}
                                            />
                                            {newTournament.team_names.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTeamName(index)}
                                                    className="px-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
                                >
                                    Create
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Tournament Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-6">Join Tournament</h3>
                        
                        <form onSubmit={handleJoinTournament} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-2">Tournament Code</label>
                                <input
                                    type="text"
                                    value={tournamentCode}
                                    onChange={(e) => setTournamentCode(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-lg"
                                    placeholder="TOUR-XXXXXX"
                                    required
                                />
                                <p className="mt-2 text-sm text-gray-500">
                                    Enter the code shared by the tournament host
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
                                >
                                    Join
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowJoinModal(false);
                                        setTournamentCode('');
                                    }}
                                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg"
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
                