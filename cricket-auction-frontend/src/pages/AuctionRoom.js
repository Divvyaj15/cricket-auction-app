// src/pages/AuctionRoom.js
// ============================================
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { tournamentAPI, teamAPI, playerAPI, auctionAPI } from '../services/api';
import {
    connectSocket,
    disconnectSocket,
    joinTournament,
    onAuctionStarted,
    onNewBid,
    onAuctionFinalized,
    getSocket
} from '../services/socket';

const AuctionRoom = () => {
    const { tournamentId } = useParams();
    const { user, token } = useContext(AuthContext);
    const navigate = useNavigate();

    const [tournament, setTournament] = useState(null);
    const [myTeams, setMyTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [allTeams, setAllTeams] = useState([]);
    
    const [availablePlayers, setAvailablePlayers] = useState([]);
    const [currentAuction, setCurrentAuction] = useState(null);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [bidHistory, setBidHistory] = useState([]);
    
    const [bidAmount, setBidAmount] = useState(0);
    const [canBid, setCanBid] = useState(false);
    const [message, setMessage] = useState('');

    const isHost = user?.role === 'host';

    useEffect(() => {
        initializeAuctionRoom();
        
        return () => {
            disconnectSocket();
        };
    }, []);

    const initializeAuctionRoom = async () => {
        // Fetch tournament data
        const tournamentData = await tournamentAPI.getById(tournamentId);
        setTournament(tournamentData);

        // Fetch all teams
        const teamsData = await teamAPI.getTeamsByTournament(tournamentId);
        setAllTeams(teamsData);

        // Fetch available players
        const playersData = await playerAPI.getByTournament(tournamentId, 'available');
        setAvailablePlayers(playersData);

        // If team member, fetch their teams
        if (!isHost) {
            const myTeamsData = await teamAPI.getMyTeams(tournamentId);
            setMyTeams(myTeamsData);
            
            if (myTeamsData.length > 0) {
                setSelectedTeam(myTeamsData[0]);
                const bidPermission = await teamAPI.canBid(myTeamsData[0].id);
                setCanBid(bidPermission.can_bid);
            }
        }

        // Check for active auction
        const activeAuction = await auctionAPI.getActiveAuction(tournamentId);
        if (activeAuction) {
            setCurrentAuction(activeAuction);
            setCurrentPlayer({
                id: activeAuction.player_id,
                name: activeAuction.player_name,
                role: activeAuction.role,
                base_price: activeAuction.base_price
            });
            setBidAmount(activeAuction.current_bid + 50000);
            
            // Fetch bid history
            const history = await auctionAPI.getBidHistory(activeAuction.id);
            setBidHistory(history);
        }

        // Setup Socket.io
        const socket = connectSocket(token);
        joinTournament(tournamentId);

        // Listen for real-time events
        onAuctionStarted((data) => {
            setCurrentAuction(data.auction_round);
            setCurrentPlayer(data.player);
            setBidAmount(data.player.base_price + 50000);
            setBidHistory([]);
            setMessage(`Auction started for ${data.player.name}`);
            
            // Remove player from available list
            setAvailablePlayers(prev => prev.filter(p => p.id !== data.player.id));
        });

        onNewBid((data) => {
            setCurrentAuction(prev => ({
                ...prev,
                current_bid: data.bid_amount,
                current_bidder_name: data.team_name
            }));
            setBidAmount(data.bid_amount + 50000);
            
            // Add to bid history
            setBidHistory(prev => [{
                team_name: data.team_name,
                bidder_name: data.bidder_name,
                bid_amount: data.bid_amount,
                created_at: new Date()
            }, ...prev]);
            
            setMessage(`${data.team_name} bid ₹${(data.bid_amount / 100000).toFixed(2)} Cr`);
        });

        onAuctionFinalized((data) => {
            if (data.status === 'sold') {
                setMessage(`${data.player_name} sold to ${data.winning_team_name} for ₹${(data.final_price / 100000).toFixed(2)} Cr`);
            } else {
                setMessage(`${data.player_name} went unsold`);
            }
            
            // Clear current auction after 3 seconds
            setTimeout(() => {
                setCurrentAuction(null);
                setCurrentPlayer(null);
                setBidHistory([]);
                setMessage('');
                
                // Refresh teams budget
                teamAPI.getTeamsByTournament(tournamentId).then(setAllTeams);
            }, 3000);
        });
    };

    const handleStartAuction = async (player) => {
        try {
            const data = await auctionAPI.start(tournamentId, player.id);
            if (data.error) {
                alert(data.error);
            }
        } catch (error) {
            alert('Failed to start auction');
        }
    };

    const handlePlaceBid = async () => {
        if (!selectedTeam || !canBid) {
            alert('You do not have permission to bid');
            return;
        }

        if (bidAmount <= currentAuction.current_bid) {
            alert('Bid amount must be higher than current bid');
            return;
        }

        if (bidAmount > selectedTeam.remaining_budget) {
            alert('Insufficient budget');
            return;
        }

        try {
            const data = await auctionAPI.placeBid(currentAuction.id, selectedTeam.id, bidAmount);
            if (data.error) {
                alert(data.error);
            }
        } catch (error) {
            alert('Failed to place bid');
        }
    };

    const handleFinalizeAuction = async () => {
        if (!currentAuction) return;
        
        const confirm = window.confirm('Finalize this auction?');
        if (!confirm) return;

        try {
            const data = await auctionAPI.finalize(currentAuction.id);
            if (data.error) {
                alert(data.error);
            }
        } catch (error) {
            alert('Failed to finalize auction');
        }
    };

    if (!tournament) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <nav className="bg-gray-800 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <button
                            onClick={() => navigate(`/tournament/${tournamentId}`)}
                            className="text-blue-400 hover:text-blue-300"
                        >
                            ← Back to Tournament
                        </button>
                        <h1 className="text-2xl font-bold">{tournament.name} - Auction Room</h1>
                        <div className="text-sm">
                            {!isHost && selectedTeam && (
                                <div className="text-right">
                                    <p className="font-semibold">{selectedTeam.team_name}</p>
                                    <p className="text-green-400">₹{(selectedTeam.remaining_budget / 100000).toFixed(2)} Cr</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Status Message */}
                {message && (
                    <div className="bg-blue-600 text-white px-6 py-3 rounded-lg mb-6 text-center text-lg font-semibold">
                        {message}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Auction Area */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Current Auction */}
                        {currentAuction && currentPlayer ? (
                            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg p-8 shadow-2xl">
                                <div className="text-center mb-6">
                                    <h2 className="text-4xl font-bold mb-2">{currentPlayer.name}</h2>
                                    <p className="text-xl text-purple-200">{currentPlayer.role}</p>
                                    <p className="text-sm text-purple-200 mt-2">
                                        Base Price: ₹{(currentPlayer.base_price / 100000).toFixed(2)} Cr
                                    </p>
                                </div>

                                <div className="bg-white bg-opacity-20 rounded-lg p-6 mb-6">
                                    <div className="text-center">
                                        <p className="text-sm text-purple-200 mb-2">Current Bid</p>
                                        <p className="text-5xl font-bold">
                                            ₹{(currentAuction.current_bid / 100000).toFixed(2)} Cr
                                        </p>
                                        {currentAuction.current_bidder_name && (
                                            <p className="text-lg mt-2 text-purple-200">
                                                by {currentAuction.current_bidder_name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bidding Controls */}
                                {!isHost && canBid && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Your Bid Amount</label>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="number"
                                                    value={bidAmount / 100000}
                                                    onChange={(e) => setBidAmount(parseFloat(e.target.value) * 100000)}
                                                    step="0.5"
                                                    className="flex-1 px-4 py-3 bg-white bg-opacity-20 rounded-lg text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-white"
                                                />
                                                <span className="flex items-center text-xl font-semibold">Cr</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2">
                                            <button
                                                onClick={() => setBidAmount(currentAuction.current_bid + 50000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹0.5L
                                            </button>
                                            <button
                                                onClick={() => setBidAmount(currentAuction.current_bid + 100000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹1L
                                            </button>
                                            <button
                                                onClick={() => setBidAmount(currentAuction.current_bid + 500000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹5L
                                            </button>
                                            <button
                                                onClick={() => setBidAmount(currentAuction.current_bid + 1000000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹10L
                                            </button>
                                        </div>

                                        <button
                                            onClick={handlePlaceBid}
                                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 rounded-lg text-xl transition"
                                        >
                                            PLACE BID
                                        </button>
                                    </div>
                                )}

                                {/* Host Controls */}
                                {isHost && (
                                    <button
                                        onClick={handleFinalizeAuction}
                                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg text-xl transition"
                                    >
                                        FINALIZE AUCTION
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-lg p-12 text-center">
                                <h2 className="text-3xl font-bold text-gray-400 mb-4">No Active Auction</h2>
                                <p className="text-gray-500">
                                    {isHost ? 'Select a player to start the auction' : 'Waiting for host to start the auction...'}
                                </p>
                            </div>
                        )}

                        {/* Bid History */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Bid History</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {bidHistory.length > 0 ? (
                                    bidHistory.map((bid, index) => (
                                        <div key={index} className="bg-gray-700 px-4 py-3 rounded flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{bid.team_name}</p>
                                                <p className="text-sm text-gray-400">{bid.bidder_name}</p>
                                            </div>
                                            <p className="text-lg font-bold text-green-400">
                                                ₹{(bid.bid_amount / 100000).toFixed(2)} Cr
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-4">No bids yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Available Players */}
                        {isHost && (
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-4">Available Players ({availablePlayers.length})</h3>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {availablePlayers.map((player) => (
                                        <div key={player.id} className="bg-gray-700 px-4 py-3 rounded">
                                            <div className="flex justify-between items-center mb-2">
                                                <div>
                                                    <p className="font-semibold">{player.name}</p>
                                                    <p className="text-sm text-gray-400">{player.role}</p>
                                                </div>
                                                <p className="text-sm font-semibold">
                                                    ₹{(player.base_price / 100000).toFixed(2)} Cr
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleStartAuction(player)}
                                                disabled={currentAuction !== null}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 rounded text-sm transition"
                                            >
                                                Start Auction
                                            </button>
                                        </div>
                                    ))}
                                    {availablePlayers.length === 0 && (
                                        <p className="text-gray-500 text-center py-4">No players available</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Teams Budget Summary */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Teams Budget</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {allTeams.map((team) => (
                                    <div key={team.id} className="bg-gray-700 px-4 py-3 rounded">
                                        <div className="flex justify-between items-center">
                                            <p className="font-semibold">{team.team_name}</p>
                                            <p className={`font-bold ${
                                                team.remaining_budget > 5000000 ? 'text-green-400' :
                                                team.remaining_budget > 2000000 ? 'text-yellow-400' :
                                                'text-red-400'
                                            }`}>
                                                ₹{(team.remaining_budget / 100000).toFixed(2)} Cr
                                            </p>
                                        </div>
                                        {team.members && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {team.members.map((member, idx) => (
                                                    member.user_id && (
                                                        <span key={idx} className="text-xs bg-gray-600 px-2 py-1 rounded">
                                                            {member.name}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Team Selector (for team members with multiple teams) */}
                        {!isHost && myTeams.length > 1 && (
                            <div className="bg-gray-800 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-4">Select Team</h3>
                                <select
                                    value={selectedTeam?.id || ''}
                                    onChange={(e) => {
                                        const team = myTeams.find(t => t.id === parseInt(e.target.value));
                                        setSelectedTeam(team);
                                        teamAPI.canBid(team.id).then(data => setCanBid(data.can_bid));
                                    }}
                                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
                                >
                                    {myTeams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.team_name} - {team.member_role}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuctionRoom;