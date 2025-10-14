// src/pages/TournamentDetail.js
// ============================================
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { tournamentAPI, teamAPI, playerAPI } from '../services/api';
import BulkPlayerImport from '../components/BulkPlayerImport';

const TournamentDetail = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [tournament, setTournament] = useState(null);
    const [teams, setTeams] = useState([]);
    const [myTeams, setMyTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [playerStats, setPlayerStats] = useState({
        total: 0,
        available: 0,
        sold: 0,
        unsold: 0,
        in_auction: 0
    });
    
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
    const [showInviteCaptainModal, setShowInviteCaptainModal] = useState(false);
    
    const [teamName, setTeamName] = useState('');
    const [isOwnerAlsoCaptain, setIsOwnerAlsoCaptain] = useState(true);
    const [captainEmail, setCaptainEmail] = useState('');
    const [selectedTeamForCaptain, setSelectedTeamForCaptain] = useState(null);
    
    const [newPlayer, setNewPlayer] = useState({
        name: '',
        role: 'batsman',
        base_price: 50000
    });

    useEffect(() => {
        fetchTournamentData();
    }, [id]);

    const fetchTournamentData = async () => {
        const tournamentData = await tournamentAPI.getById(id);
        setTournament(tournamentData);

        const teamsData = await teamAPI.getTeamsByTournament(id);
        setTeams(teamsData);

        if (user.role === 'team_member') {
            const myTeamsData = await teamAPI.getMyTeams(id);
            setMyTeams(myTeamsData);
        }

        const playersData = await playerAPI.getByTournament(id);
        setPlayers(playersData);
    };

    const handleJoinTournament = async (e) => {
        e.preventDefault();
        const data = await teamAPI.create(id, teamName, isOwnerAlsoCaptain);
        
        if (!data.error) {
            setShowJoinModal(false);
            setTeamName('');
            fetchTournamentData();
        }
    };

    const handleAddPlayer = async (e) => {
        e.preventDefault();
        const data = await playerAPI.add(id, newPlayer.name, newPlayer.role, newPlayer.base_price);
        
        if (!data.error) {
            setShowAddPlayerModal(false);
            setNewPlayer({ name: '', role: 'batsman', base_price: 50000 });
            fetchTournamentData();
        }
    };

    const handleInviteCaptain = async (e) => {
        e.preventDefault();
        const data = await teamAPI.inviteCaptain(selectedTeamForCaptain, captainEmail);
        
        if (!data.error) {
            alert('Captain invited successfully!');
            setShowInviteCaptainModal(false);
            setCaptainEmail('');
            setSelectedTeamForCaptain(null);
            fetchTournamentData();
        } else {
            alert(data.error);
        }
    };

    const isHost = user?.role === 'host' && tournament?.host_id === user?.id;
    const hasJoined = myTeams.length > 0;

    if (!tournament) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            ← Back to Dashboard
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800">{tournament.name}</h1>
                        <div className="w-32"></div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Tournament Info Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Host</p>
                            <p className="text-lg font-semibold">{tournament.host_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Teams</p>
                            <p className="text-lg font-semibold">{teams.length} / {tournament.max_teams}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Budget per Team</p>
                            <p className="text-lg font-semibold">₹{(tournament.team_budget / 100000).toFixed(1)} Cr</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Status</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                                tournament.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                tournament.status === 'auction' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                                {tournament.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 mb-6">
                    {isHost && (
                        <>
                            <button
                                onClick={() => setShowAddPlayerModal(true)}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Add Player
                            </button>
                            <button
                                onClick={() => navigate(`/auction/${id}`)}
                                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                            >
                                Go to Auction Room
                            </button>
                        </>
                    )}
                    {!isHost && !hasJoined && (
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                        >
                            Join Tournament
                        </button>
                    )}
                    {!isHost && hasJoined && (
                        <button
                            onClick={() => navigate(`/auction/${id}`)}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                        >
                            Enter Auction Room
                        </button>
                    )}
                </div>

                {/* My Teams Section */}
                {myTeams.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h3 className="text-xl font-bold mb-4">My Teams</h3>
                        {myTeams.map((team) => (
                            <div key={team.id} className="border-b pb-4 mb-4 last:border-b-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-lg">{team.team_name}</p>
                                        <p className="text-sm text-gray-600">
                                            Role: {team.member_role} | Budget: ₹{(team.remaining_budget / 100000).toFixed(2)} Cr
                                        </p>
                                    </div>
                                    {team.member_role === 'owner' && (
                                        <button
                                            onClick={() => {
                                                setSelectedTeamForCaptain(team.id);
                                                setShowInviteCaptainModal(true);
                                            }}
                                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                                        >
                                            Invite Captain
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Teams List */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-bold mb-4">Registered Teams</h3>
                        <div className="space-y-4">
                            {teams.map((team) => (
                                <div key={team.id} className="border-b pb-4 last:border-b-0">
                                    <p className="font-semibold">{team.team_name}</p>
                                    <p className="text-sm text-gray-600">
                                        Budget: ₹{(team.remaining_budget / 100000).toFixed(2)} Cr
                                    </p>
                                    {team.members && (
                                        <div className="mt-2 text-sm">
                                            {team.members.map((member, idx) => (
                                                member.user_id && (
                                                    <span key={idx} className="inline-block bg-gray-100 px-2 py-1 rounded mr-2 mb-1">
                                                        {member.name} ({member.role})
                                                    </span>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {teams.length === 0 && (
                                <p className="text-gray-500 text-center">No teams registered yet</p>
                            )}
                        </div>
                    </div>

                    {/* Players List */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-bold mb-4">Players ({players.length})</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {players.map((player) => (
                                <div key={player.id} className="border-b pb-3 last:border-b-0">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{player.name}</p>
                                            <p className="text-sm text-gray-600">{player.role}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">₹{(player.base_price / 100000).toFixed(2)} Cr</p>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                player.status === 'available' ? 'bg-green-100 text-green-800' :
                                                player.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                                                player.status === 'in_auction' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {player.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {players.length === 0 && (
                                <p className="text-gray-500 text-center">No players added yet</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Join Tournament Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-4">Join Tournament</h3>
                        <form onSubmit={handleJoinTournament} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Team Name
                                </label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    placeholder="e.g., Mumbai Riders"
                                    required
                                />
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="is-captain"
                                    checked={isOwnerAlsoCaptain}
                                    onChange={(e) => setIsOwnerAlsoCaptain(e.target.checked)}
                                    className="mr-2"
                                />
                                <label htmlFor="is-captain" className="text-sm text-gray-700">
                                    I am also the team captain
                                </label>
                            </div>

                            <div className="flex space-x-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Join
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowJoinModal(false)}
                                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Player Modal */}
            {showAddPlayerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-4">Add Player</h3>
                        <form onSubmit={handleAddPlayer} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Player Name
                                </label>
                                <input
                                    type="text"
                                    value={newPlayer.name}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Role
                                </label>
                                <select
                                    value={newPlayer.role}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="batsman">Batsman</option>
                                    <option value="bowler">Bowler</option>
                                    <option value="all-rounder">All-rounder</option>
                                    <option value="wicket-keeper">Wicket-keeper</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Base Price (₹ in Lakhs)
                                </label>
                                <input
                                    type="number"
                                    value={newPlayer.base_price / 100000}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, base_price: parseFloat(e.target.value) * 100000 })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    step="0.1"
                                    min="0.1"
                                    required
                                />
                            </div>

                            <div className="flex space-x-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddPlayerModal(false)}
                                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invite Captain Modal */}
            {showInviteCaptainModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-4">Invite Captain</h3>
                        <form onSubmit={handleInviteCaptain} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Captain's Email
                                </label>
                                <input
                                    type="email"
                                    value={captainEmail}
                                    onChange={(e) => setCaptainEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                    placeholder="captain@example.com"
                                    required
                                />
                            </div>

                            <div className="flex space-x-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
                                >
                                    Invite
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowInviteCaptainModal(false);
                                        setCaptainEmail('');
                                        setSelectedTeamForCaptain(null);
                                    }}
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

export default TournamentDetail;