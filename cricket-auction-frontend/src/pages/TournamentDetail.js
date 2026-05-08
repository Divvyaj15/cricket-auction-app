// src/pages/TournamentDetail.js
// ============================================
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { tournamentAPI, teamAPI, playerAPI, auctionAPI } from '../services/api';
import {
    connectSocket,
    joinTournament as joinTournamentRoom,
    leaveTournament as leaveTournamentRoom,
    onAuctionStarted,
    onNewBid,
    onTeamGaveUp,
    onAuctionEnded
} from '../services/socket';
import BulkPlayerImport from '../components/BulkPlayerImport';

const TournamentDetail = () => {
    const { id } = useParams();
    const { user, token } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [tournament, setTournament] = useState(null);
    const [teams, setTeams] = useState([]);
    const [myTeams, setMyTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    /*
    const [playerStats, setPlayerStats] = useState({
        total: 0,
        available: 0,
        sold: 0,
        unsold: 0,
        in_auction: 0
    });
    */
    
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showJoinByCodeModal, setShowJoinByCodeModal] = useState(false);
    const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
    const [auctionEnded, setAuctionEnded] = useState(false);
    const [showInviteCaptainModal, setShowInviteCaptainModal] = useState(false);
    const [liveAuctionBanner, setLiveAuctionBanner] = useState(null);
    
    const [teamName, setTeamName] = useState('');
    const [maxPerTeamInput, setMaxPerTeamInput] = useState(0);
    const [isOwnerAlsoCaptain, setIsOwnerAlsoCaptain] = useState(true);
    const [captainEmail, setCaptainEmail] = useState('');
    const [selectedTeamForCaptain, setSelectedTeamForCaptain] = useState(null);
    const [joinCode, setJoinCode] = useState('');
    // Non-hosts join by code as Owner by default
    
    const [newPlayer, setNewPlayer] = useState({
        name: '',
        role: 'batsman',
        // Store in Lakhs on the client; backend will convert
        base_price: 2.5
    });

    useEffect(() => {
        fetchTournamentData();

        // Join socket room for live updates
        connectSocket(token);
        joinTournamentRoom(id);
        onAuctionStarted((data) => {
            setLiveAuctionBanner({ playerName: data.player.name });
        });

        onNewBid((data) => {
            // Show live bid updates in the banner if present
            setLiveAuctionBanner(prev => prev ? {
                ...prev,
                lastBidTeam: data.team_name,
                lastBidAmountL: (data.bid_amount / 100000).toFixed(2)
            } : prev);
        });

        onTeamGaveUp((data) => {
            setLiveAuctionBanner(prev => ({
                ...(prev || {}),
                playerName: data.player_name,
                lastBidTeam: undefined,
                lastBidAmountL: undefined,
                gaveUpTeam: data.team_name
            }));
        });

        // Listen for auction ended event
        onAuctionEnded(() => {
            setAuctionEnded(true);
            setLiveAuctionBanner(null);
        });

        return () => {
            leaveTournamentRoom(id);
        };
    }, [id, token, fetchTournamentData]);

    const fetchTournamentData = useCallback(async () => {
        const tournamentData = await tournamentAPI.getById(id);
        setTournament(tournamentData);

        // Check if auction has ended based on tournament status
        if (tournamentData.status === 'completed' || tournamentData.status === 'ended') {
            setAuctionEnded(true);
        }

        const teamsData = await teamAPI.getTeamsByTournament(id);
        setTeams(teamsData);

        // Always fetch my teams to determine if user has joined
        const myTeamsData = await teamAPI.getMyTeams(id);
        setMyTeams(myTeamsData || []);

        const playersData = await playerAPI.getByTournament(id);
        
        // For sold players, we need to get their purchase price
        const playersWithPurchaseInfo = await Promise.all(playersData.map(async (player) => {
            if (player.status === 'sold') {
                try {
                    // Get the team that purchased this player
                    const teams = await teamAPI.getTeamsByTournament(id);
                    for (const team of teams) {
                        const purchases = await auctionAPI.getPurchases(team.id);
                        const purchase = purchases.find(p => p.player_id === player.id);
                        if (purchase) {
                            return { ...player, purchase_price: purchase.purchase_price };
                        }
                    }
                } catch (error) {
                    console.error('Error fetching purchase info for player:', player.id, error);
                }
            }
            return player;
        }));
        
        setPlayers(playersWithPurchaseInfo);
    }, [id]);

    const handleJoinTournament = async (e) => {
        e.preventDefault();
        const data = await teamAPI.create(id, teamName, isOwnerAlsoCaptain);
        
        if (!data.error) {
            setShowJoinModal(false);
            setTeamName('');
            fetchTournamentData();
        }
    };

    const handleJoinByCode = async (e) => {
        e.preventDefault();
        const data = await teamAPI.joinByCode(joinCode.trim().toUpperCase(), 'owner');
        if (!data.error) {
            setShowJoinByCodeModal(false);
            setJoinCode('');
            fetchTournamentData();
            navigate(`/auction/${id}`);
        } else {
            alert(data.error);
        }
    };

    const handleAddPlayer = async (e) => {
        e.preventDefault();
        const data = await playerAPI.add(id, newPlayer.name, newPlayer.role, newPlayer.base_price);
        
        if (!data.error) {
            setShowAddPlayerModal(false);
            setNewPlayer({ name: '', role: 'batsman', base_price: 2.5 });
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

    const isHost = tournament?.host_id === user?.id;
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
                    {liveAuctionBanner && (
                        <div className="mb-4 bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded flex justify-between items-center">
                            <span>
                                Auction started for <strong>{liveAuctionBanner.playerName}</strong>
                                {liveAuctionBanner.lastBidAmountL && (
                                    <> — current bid ₹{liveAuctionBanner.lastBidAmountL} L by {liveAuctionBanner.lastBidTeam}</>
                                )}
                            </span>
                            <button
                                onClick={() => navigate(`/auction/${id}`)}
                                className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                Enter Auction Room
                            </button>
                        </div>
                    )}
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
                            <p className="text-lg font-semibold">₹{(tournament.team_budget / 10000000).toFixed(2)} Cr</p>
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
                <div className="flex flex-wrap gap-3 mb-6">
                    {isHost && !auctionEnded && (
                        <>
                            <button
                                onClick={() => setShowAddPlayerModal(true)}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Add Player
                            </button>
                            <BulkPlayerImport
                                tournamentId={id}
                                onImportComplete={fetchTournamentData}
                            />
                            <button
                                onClick={() => navigate(`/auction/${id}`)}
                                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700"
                            >
                                Start Auction
                            </button>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-700">Max players/team:</label>
                                <input
                                    type="number"
                                    min="1"
                                    onChange={(e) => setMaxPerTeamInput(parseInt(e.target.value || '0'))}
                                    className="w-24 px-2 py-1 border rounded"
                                    placeholder="e.g., 11"
                                />
                                <button
                                    onClick={async () => {
                                        if (!maxPerTeamInput || maxPerTeamInput <= 0) return alert('Enter a valid number');
                                        const res = await auctionAPI.setCapacity(id, maxPerTeamInput);
                                        if (res.error) alert(res.error); else alert('Capacity updated');
                                    }}
                                    className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
                                >
                                    Save Capacity
                                </button>
                            </div>
                        </>
                    )}
                    {isHost && auctionEnded && (
                        <button
                            onClick={() => navigate(`/tournament/${id}/history`)}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
                        >
                            View Auction History
                        </button>
                    )}
                    {isHost && auctionEnded && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <p className="text-red-700 font-medium">Auction has ended. You cannot add players or start a new auction.</p>
                            </div>
                        </div>
                    )}
                    {!isHost && !hasJoined && (
                        <>
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                            >
                                Join Tournament
                            </button>
                            <button
                                onClick={() => navigate(`/auction/${id}`)}
                                className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-800"
                            >
                                View Live Auction
                            </button>
                        </>
                    )}
                    {!isHost && !hasJoined && (
                        <button
                            onClick={() => setShowJoinByCodeModal(true)}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
                        >
                            Join Team by Code
                        </button>
                    )}
                    {!isHost && hasJoined && (
                        <>
                            <button
                                onClick={() => navigate(`/auction/${id}`)}
                                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                            >
                                Enter Auction Room
                            </button>
                            {myTeams[0] && (
                                <button
                                    onClick={() => navigate(`/team/${myTeams[0].id}/squad?tournamentId=${id}`)}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
                                >
                                    My Squad
                                </button>
                            )}
                            <button
                                onClick={() => navigate(`/tournament/${id}/history`)}
                                className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-800"
                            >
                                Auction History
                            </button>
                        </>
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
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => navigate(`/team/${team.id}/squad?tournamentId=${id}`)}
                                            className="font-semibold hover:underline text-left"
                                        >
                                            {team.team_name}
                                        </button>
                                        {isHost && (
                                            <div className="text-xs text-gray-600">
                                                Code: <code className="font-mono font-semibold">{team.unique_code}</code>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(team.unique_code)}
                                                    className="ml-2 px-2 py-0.5 border rounded hover:bg-gray-50"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Budget: ₹{(team.remaining_budget / 100000).toFixed(2)} L
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
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">Players ({players.length})</h3>
                            {isHost && (
                                <button
                                    onClick={() => navigate(`/tournament/${id}/history`)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
                                >
                                    View Auction History
                                </button>
                            )}
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {players.map((player) => (
                                <div key={player.id} className="border-b pb-3 last:border-b-0">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{player.name}</p>
                                            <p className="text-sm text-gray-600">{player.role}</p>
                                        </div>
                                        <div className="text-right">
                                            {player.status === 'sold' && player.purchase_price ? (
                                                <>
                                                    <p className="text-xs text-gray-500">Base: ₹{(player.base_price / 100000).toFixed(2)} L</p>
                                                    <p className="text-lg font-bold text-green-600">₹{(player.purchase_price / 100000).toFixed(2)} L</p>
                                                </>
                                            ) : (
                                                <p className="text-sm font-semibold">₹{(player.base_price / 100000).toFixed(2)} L</p>
                                            )}
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

            {/* Join by Team Code Modal (joins as Owner) */}
            {showJoinByCodeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-4">Join Team by Code</h3>
                        <form onSubmit={handleJoinByCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Team Code</label>
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono"
                                    placeholder="TEAM-XXXXXX"
                                    required
                                />
                            </div>
                            <p className="text-sm text-gray-600">You will join as <span className="font-semibold">Owner</span> of the team.</p>
                            <div className="flex space-x-4">
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">Join</button>
                                <button type="button" onClick={() => setShowJoinByCodeModal(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
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
                                    value={newPlayer.base_price}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, base_price: parseFloat(e.target.value) })}
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