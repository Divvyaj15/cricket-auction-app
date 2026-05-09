// src/pages/AuctionRoom.js
// ============================================
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
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
    onTeamGaveUp,
    onAuctionEnded,
    onOwnerPresenceUpdate,
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
    const [secondsRemaining, setSecondsRemaining] = useState(null);
    const [finalizeModal, setFinalizeModal] = useState(null);
    const [hasGivenUp, setHasGivenUp] = useState(false);
    const [giveUpTeams, setGiveUpTeams] = useState([]);
    // Hover Squad Panel state (no blocking modal)
    const [hoveredTeamId, setHoveredTeamId] = useState(null);
    const [teamPurchasesMap, setTeamPurchasesMap] = useState({}); // teamId -> players[]
    const [hoverLoadingTeamId, setHoverLoadingTeamId] = useState(null);
    const hoverCloseTimerRef = useRef(null);
    const [connectedOwners, setConnectedOwners] = useState([]);

    const isHost = !!(tournament && user && tournament.host_id === user.id);
    const allOwnersReady = allTeams.length > 0 && allTeams.every(team => {
        const hasOwner = team.members && team.members.some(m => m.role === 'owner');
        if (!hasOwner) return true; // Skip teams without owners
        return team.members.some(m => m.role === 'owner' && connectedOwners.some(o => o.team_id === team.id));
    });



    const fetchTournamentData = useCallback(async () => {
        // Fetch all teams
        const teamsData = await teamAPI.getTeamsByTournament(tournamentId);
        setAllTeams(teamsData);

        // Fetch available players and sort by role then name
        const roleOrder = { 'batsman': 0, 'bowler': 1, 'all-rounder': 2, 'wicket-keeper': 3 };
        const playersData = await playerAPI.getByTournament(tournamentId, 'available');
        const sortedPlayers = (playersData || []).slice().sort((a,b) => {
            const ra = roleOrder[(a.role || '').toLowerCase()] ?? 99;
            const rb = roleOrder[(b.role || '').toLowerCase()] ?? 99;
            if (ra !== rb) return ra - rb;
            return (a.name || '').localeCompare(b.name || '');
        });
        setAvailablePlayers(sortedPlayers);

        // Always fetch my teams; bidding controls will only show for non-hosts
        const myTeamsData = await teamAPI.getMyTeams(tournamentId);
        setMyTeams(myTeamsData || []);
        if (myTeamsData && myTeamsData.length > 0) {
            setSelectedTeam(myTeamsData[0]);
            const bidPermission = await teamAPI.canBid(myTeamsData[0].id);
            setCanBid(!!bidPermission?.can_bid);
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

            // Check if current user's team has given up
            if (myTeamsData && myTeamsData.length > 0) {
                const giveUps = await auctionAPI.getGiveUps(activeAuction.id);
                const giveUpsArray = Array.isArray(giveUps) ? giveUps : [];
                setGiveUpTeams(giveUpsArray);
                const userTeamGivenUp = giveUpsArray.some(giveUp => 
                    myTeamsData.some(team => team.id === giveUp.team_id)
                );
                setHasGivenUp(userTeamGivenUp || false);
            }
        }
    }, [tournamentId]);

    const initializeAuctionRoom = useCallback(async () => {
        // Fetch tournament data
        const tournamentData = await tournamentAPI.getById(tournamentId);
        setTournament(tournamentData);

        // Initial data fetch
        await fetchTournamentData();

        // Setup Socket.io
        connectSocket(token);
        joinTournament(tournamentId);

        // Listen for real-time events
        onAuctionStarted((data) => {
            setCurrentAuction(data.auction_round);
            setCurrentPlayer(data.player);
            setBidAmount(data.player.base_price + 50000);
            setBidHistory([]);
            setMessage(`Auction started for ${data.player.name}`);
            setHasGivenUp(false);
            setGiveUpTeams([]);
            
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
            
            setMessage(`${data.team_name} bid ₹${(data.bid_amount / 100000).toFixed(2)} L`);
            
            // Auto-refresh teams budget
            teamAPI.getTeamsByTournament(tournamentId).then(setAllTeams);

            // Stop local countdown if running (backend also notifies with null)
            setSecondsRemaining(null);
        });

        onAuctionFinalized((data) => {
            if (data.status === 'sold') {
                setMessage(`${data.player_name} sold to ${data.winning_team_name} for ₹${(data.final_price / 100000).toFixed(2)} L`);
                setFinalizeModal({
                    status: 'sold',
                    player_name: data.player_name,
                    team_name: data.winning_team_name,
                    price_lakhs: (data.final_price / 100000).toFixed(2)
                });
            } else {
                setMessage(`${data.player_name} went unsold`);
                setFinalizeModal({
                    status: 'unsold',
                    player_name: data.player_name
                });
            }
            
            // Auto-refresh everything after 2 seconds
            setTimeout(() => {
                setCurrentAuction(null);
                setCurrentPlayer(null);
                setBidHistory([]);
                setMessage('');
                setSecondsRemaining(null);
                setFinalizeModal(null);
                
                // Refresh all data
                fetchTournamentData();
            }, 2000);
        });

        // Countdown updates
        getSocket()?.on('countdown', (payload) => {
            setSecondsRemaining(payload?.seconds_remaining ?? null);
        });

        // Team gave up updates
        onTeamGaveUp((data) => {
            setGiveUpTeams(prev => [...prev, {
                team_id: data.team_id,
                team_name: data.team_name,
                created_at: new Date()
            }]);
            setMessage(`${data.team_name} gave up on ${data.player_name}`);
        });

        // Auction ended globally
        onAuctionEnded(() => {
            setMessage('Auction has ended');
            // brief delay then redirect to summary
            setTimeout(() => navigate(`/tournament/${tournamentId}/summary`), 1000);
        });

        // Owner presence updates
        onOwnerPresenceUpdate((data) => {
            setConnectedOwners(data.connected_owners || []);
        });
    }, [tournamentId, token, fetchTournamentData, navigate]);

    useEffect(() => {
        initializeAuctionRoom();
        
        return () => {
            disconnectSocket();
        };
    }, [initializeAuctionRoom]);

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

    const handleStartRandom = async () => {
        if (!availablePlayers || availablePlayers.length === 0) {
            alert('No available players to start');
            return;
        }
        const idx = Math.floor(Math.random() * availablePlayers.length);
        const randomPlayer = availablePlayers[idx];
        await handleStartAuction(randomPlayer);
    };

    const handlePlaceBid = async () => {
        if (!selectedTeam || !canBid) {
            alert('You do not have permission to bid');
            return;
        }

        const minAllowedNow = Math.round((currentAuction?.current_bid || 0) + MIN_INCREMENT);
        if (bidAmount < minAllowedNow) {
            const minLakhs = (minAllowedNow / 100000).toFixed(2);
            alert(`You must bid at least ₹${minLakhs} L`);
            setBidAmount(minAllowedNow);
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

    // Helper to adjust bid in rupees while clamping to minimum allowed (current bid + 0.5L)
    const MIN_INCREMENT = 50000;
    const adjustBid = (delta) => {
        setBidAmount((prev) => {
            const current = Number.isFinite(prev) ? prev : 0;
            const minAllowed = currentAuction ? Math.round((currentAuction.current_bid || 0) + MIN_INCREMENT) : 0;
            const next = Math.round(current + delta);
            return Math.max(next, minAllowed);
        });
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

    const handleDistributeRemaining = async () => {
        if (!isHost) return;
        const ok = window.confirm('Randomly distribute remaining players to teams with capacity and budget?');
        if (!ok) return;
        try {
            const res = await auctionAPI.distributeRemaining(tournamentId);
            if (res.error) {
                alert(res.error);
            } else {
                alert(`Assigned ${res.assigned || 0} players`);
                // Refresh teams and available players
                fetchTournamentData();
            }
        } catch (e) {
            alert('Failed to distribute players');
        }
    };

    const handleEndAuction = async () => {
        if (!isHost) return;
        const ok = window.confirm('End the auction and view summary?');
        if (!ok) return;
        try {
            const res = await auctionAPI.endAuction(tournamentId);
            if (res.error) {
                alert(res.error);
            } else {
                navigate(`/tournament/${tournamentId}/summary`);
            }
        } catch (e) {
            alert('Failed to end auction');
        }
    };

    const handleGiveUp = async () => {
        if (!currentAuction || !selectedTeam) return;
        
        const confirm = window.confirm('Are you sure you want to give up on this player? You won\'t be able to bid again.');
        if (!confirm) return;

        try {
            const data = await auctionAPI.giveUp(currentAuction.id, selectedTeam.id);
            if (data.error) {
                alert(data.error);
            } else {
                setHasGivenUp(true);
                setMessage(`${selectedTeam.team_name} gave up on ${currentPlayer.name}`);
            }
        } catch (error) {
            alert('Failed to give up on player');
        }
    };

    const openTeamHoverPanel = async (team) => {
        if (hoverCloseTimerRef.current) {
            clearTimeout(hoverCloseTimerRef.current);
            hoverCloseTimerRef.current = null;
        }
        setHoveredTeamId(team.id);
        if (teamPurchasesMap[team.id]) return; // already cached
        try {
            setHoverLoadingTeamId(team.id);
            const purchases = await auctionAPI.getPurchases(team.id);
            setTeamPurchasesMap(prev => ({ ...prev, [team.id]: Array.isArray(purchases) ? purchases : [] }));
        } finally {
            setHoverLoadingTeamId(null);
        }
    };

    const scheduleCloseHoverPanel = () => {
        if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = setTimeout(() => {
            setHoveredTeamId(null);
        }, 150);
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
                        <div className="flex items-center gap-3 text-sm">
                            <button
                                onClick={() => navigate(`/tournament/${tournamentId}/history`)}
                                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                            >
                                Auction History
                            </button>
                            {!isHost && selectedTeam && (
                                <>
                                    <div className="text-right mr-2 hidden sm:block">
                                        <p className="font-semibold">{selectedTeam.team_name}</p>
                                        <p className="text-green-400">₹{(selectedTeam.remaining_budget / 100000).toFixed(2)} Cr</p>
                                    </div>
                                    <button
                                        onClick={() => navigate(`/team/${selectedTeam.id}/squad?tournamentId=${tournamentId}`)}
                                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500"
                                    >
                                        My Squad
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {isHost && (
                    <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
                        <div className="flex flex-wrap gap-3 items-center justify-between">
                            <div className="text-sm text-gray-300">Host Controls</div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDistributeRemaining}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                                >
                                    Distribute Remaining Players
                                </button>
                                <button
                                    onClick={handleEndAuction}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                                >
                                    End Auction
                                </button>
                            </div>
                        </div>
                        {/* Team Owner Presence Panel */}
                        <div className={`rounded-lg p-3 ${allOwnersReady ? 'bg-green-900 bg-opacity-40' : 'bg-yellow-900 bg-opacity-40'}`}>
                            <p className={`text-sm font-semibold mb-2 ${allOwnersReady ? 'text-green-300' : 'text-yellow-300'}`}>
                                {allOwnersReady ? '✅ All team owners are connected' : '⏳ Waiting for team owners to join...'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {allTeams.map(team => {
                                    const ownerConnected = connectedOwners.some(o => o.team_id === team.id);
                                    return (
                                        <span key={team.id} className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            ownerConnected 
                                                ? 'bg-green-600 text-white' 
                                                : 'bg-gray-600 text-gray-300'
                                        }`}>
                                            {ownerConnected ? '🟢' : '🔴'} {team.team_name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {/* Finalize Modal */}
                {finalizeModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white text-gray-900 rounded-lg p-6 w-full max-w-md shadow-2xl">
                            <h3 className="text-2xl font-bold mb-4">{finalizeModal.status === 'sold' ? 'Player Sold' : 'Player Unsold'}</h3>
                            <div className="space-y-2 mb-6">
                                <p className="text-lg"><span className="font-semibold">Player:</span> {finalizeModal.player_name}</p>
                                {finalizeModal.status === 'sold' && (
                                    <>
                                        <p><span className="font-semibold">Team:</span> {finalizeModal.team_name}</p>
                                        <p><span className="font-semibold">Price:</span> ₹{finalizeModal.price_lakhs} L</p>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setFinalizeModal(null)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Close</button>
                                <button onClick={() => { setFinalizeModal(null); navigate(`/tournament/${tournamentId}/history`); }} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">View History</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* No blocking modal here; hover cards are rendered inline near each team */}
                {/* Status Message */}
                {message && (
                    <div className="bg-blue-600 text-white px-6 py-3 rounded-lg mb-6 text-center text-lg font-semibold">
                        {message}
                    </div>
                )}
                {giveUpTeams && giveUpTeams.length > 0 && (
                    <div className="bg-red-900 bg-opacity-40 text-red-200 px-6 py-3 rounded-lg mb-6 text-center text-sm">
                        {giveUpTeams[giveUpTeams.length - 1]?.team_name} gave up on {currentPlayer?.name}
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
                                        Base Price: ₹{(currentPlayer.base_price / 100000).toFixed(2)} L
                                    </p>
                                </div>

                                <div className="bg-white bg-opacity-20 rounded-lg p-6 mb-6">
                                    <div className="text-center">
                                        <p className="text-sm text-purple-200 mb-2">Current Bid</p>
                                        <p className="text-5xl font-bold">
                                            ₹{(currentAuction.current_bid / 100000).toFixed(2)} L
                                        </p>
                                        {currentAuction.current_bidder_name && (
                                            <p className="text-lg mt-2 text-purple-200">
                                                by {currentAuction.current_bidder_name}
                                            </p>
                                        )}
                                        {Number.isFinite(secondsRemaining) && secondsRemaining !== null && (
                                            <p className="mt-3 text-yellow-300 font-semibold">
                                                Finalizing in {secondsRemaining}s …
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Bidding Controls */}
                                {!isHost && canBid && !hasGivenUp && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Your Bid Amount</label>
                                            <div className="flex space-x-2">
                                                <input
                                                    type="number"
                                                    value={Number((bidAmount / 100000).toFixed(2))}
                                                    onChange={(e) => {
                                                        const lakhs = parseFloat(e.target.value || '0');
                                                        if (isNaN(lakhs)) return;
                                                        // Store as integer rupees, rounded to the nearest rupee to avoid FP artifacts
                                                        setBidAmount(Math.round(lakhs * 100000));
                                                    }}
                                                    step="0.5"
                                                    className="flex-1 px-4 py-3 bg-white bg-opacity-20 rounded-lg text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-white"
                                                />
                                                <span className="flex items-center text-xl font-semibold">L</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-8 gap-2">
                                            <button
                                                onClick={() => adjustBid(-500000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                -₹5L
                                            </button>
                                            <button
                                                onClick={() => adjustBid(-100000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                -₹1L
                                            </button>
                                            <button
                                                onClick={() => adjustBid(-50000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                -₹0.5L
                                            </button>
                                            <button
                                                onClick={() => adjustBid(0)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                Reset
                                            </button>
                                            <button
                                                onClick={() => adjustBid(50000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹0.5L
                                            </button>
                                            <button
                                                onClick={() => adjustBid(100000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹1L
                                            </button>
                                            <button
                                                onClick={() => adjustBid(500000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹5L
                                            </button>
                                            <button
                                                onClick={() => adjustBid(1000000)}
                                                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded text-sm"
                                            >
                                                +₹10L
                                            </button>
                                        </div>

                                        <div className="flex gap-3">
                                        <button
                                            onClick={handlePlaceBid}
                                            disabled={bidAmount < Math.round((currentAuction?.current_bid || 0) + MIN_INCREMENT)}
                                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-gray-900 font-bold py-4 rounded-lg text-xl transition"
                                        >
                                            PLACE BID
                                        </button>
                                            <button
                                                onClick={handleGiveUp}
                                                className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-xl transition"
                                            >
                                                GIVE UP
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Give Up Status */}
                                {!isHost && hasGivenUp && (
                                    <div className="text-center p-6 bg-red-500 bg-opacity-20 rounded-lg">
                                        <p className="text-xl font-bold text-red-300">You have given up on this player</p>
                                        <p className="text-sm text-red-200 mt-2">You cannot bid on {currentPlayer.name}</p>
                                    </div>
                                )}

                                {/* Host Controls */}
                                {isHost && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {secondsRemaining && secondsRemaining > 0 ? (
                                            <button
                                                disabled
                                                className="w-full bg-yellow-500 text-gray-900 font-bold py-4 rounded-lg text-xl opacity-80"
                                            >
                                                Finalizing in {secondsRemaining}s
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    if (!currentAuction) return;
                                                    await auctionAPI.warn(currentAuction.id, 10);
                                                }}
                                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-4 rounded-lg text-xl transition"
                                            >
                                                WARN (10s)
                                            </button>
                                        )}
                                        <button
                                            onClick={handleFinalizeAuction}
                                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg text-xl transition"
                                        >
                                            FINALIZE NOW
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-gray-800 rounded-lg p-12">
                                <h2 className="text-3xl font-bold text-gray-200 mb-6">Next Player</h2>
                                {isHost ? (
                                    <>
                                        {availablePlayers.length > 0 ? (
                                            <div className="flex items-center justify-between bg-gray-700 rounded-lg p-4 mb-6">
                                                <div>
                                                    <p className="text-xl font-semibold">{availablePlayers[0].name}</p>
                                                    <p className="text-sm text-gray-300">{availablePlayers[0].role}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-300">Base Price</p>
                                                    <p className="text-2xl font-bold text-green-400">₹{(availablePlayers[0].base_price / 100000).toFixed(2)} L</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 mb-6">No players available</p>
                                        )}
                                        {!allOwnersReady && (
                                            <p className="text-yellow-400 text-sm mb-2 text-center">⏳ Waiting for all team owners to join before starting...</p>
                                        )}
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => availablePlayers[0] && handleStartAuction(availablePlayers[0])}
                                                disabled={availablePlayers.length === 0 || !allOwnersReady}
                                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg"
                                            >
                                                Start Next Player
                                            </button>
                                            <button
                                                onClick={handleStartRandom}
                                                disabled={availablePlayers.length === 0 || !allOwnersReady}
                                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg"
                                            >
                                                Start Random
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-gray-400">Waiting for host to announce the next player…</p>
                                )}
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
                                                ₹{(bid.bid_amount / 100000).toFixed(2)} L
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
                        {/* Available Players (visible to all; grouped by role; Start button only for host) */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Available Players ({availablePlayers.length})</h3>
                            {(() => {
                                const order = ['batsman','bowler','all-rounder','wicket-keeper'];
                                const label = {
                                    'batsman': 'Batsmen',
                                    'bowler': 'Bowlers',
                                    'all-rounder': 'All-Rounders',
                                    'wicket-keeper': 'Wicket-Keepers'
                                };
                                const groups = order.map(r => ({
                                    role: r,
                                    items: availablePlayers.filter(p => (p.role || '').toLowerCase() === r)
                                })).filter(g => g.items.length > 0);
                                if (groups.length === 0) return <p className="text-gray-500 text-center py-4">No players available</p>;
                                return (
                                    <div className="space-y-5 max-h-96 overflow-y-auto pr-1">
                                        {groups.map(group => (
                                            <div key={group.role}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-sm tracking-wide uppercase text-gray-300 font-semibold">{label[group.role]} <span className="ml-1 text-xs text-gray-400">({group.items.length})</span></p>
                                                    <span className="h-px flex-1 bg-gray-700 ml-3" />
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {group.items.map(player => (
                                                        <div key={player.id} className="bg-gray-700/70 hover:bg-gray-700 transition border border-gray-700 rounded px-4 py-3">
                                                            <div className="flex justify-between items-center">
                                                                <div>
                                                                    <p className="font-semibold">{player.name}</p>
                                                                    <p className="text-xs text-gray-400">Base ₹{(player.base_price / 100000).toFixed(2)} L</p>
                                                                </div>
                                                                {isHost && (
                                                                    <button
                                                                        onClick={() => handleStartAuction(player)}
                                                                        disabled={currentAuction !== null}
                                                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
                                                                    >
                                                                        Start
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Teams Budget Summary */}
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Teams Budget</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {allTeams.map((team) => {
                                    const hasGivenUp = Array.isArray(giveUpTeams) && giveUpTeams.some(giveUp => giveUp.team_id === team.id);
                                    return (
                                        <div key={team.id} className={`px-4 py-3 rounded ${hasGivenUp ? 'bg-red-900 bg-opacity-50' : 'bg-gray-700'}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="relative">
                                                    <button
                                                        onMouseEnter={() => openTeamHoverPanel(team)}
                                                        onMouseLeave={scheduleCloseHoverPanel}
                                                        className={`font-semibold text-left hover:underline ${hasGivenUp ? 'text-red-300' : ''}`}
                                                    >
                                                        {team.team_name}
                                                        {hasGivenUp && <span className="text-xs ml-2 text-red-400">(GAVE UP)</span>}
                                                    </button>
                                                    {hoveredTeamId === team.id && (
                                                        <div
                                                            onMouseEnter={() => { if (hoverCloseTimerRef.current) { clearTimeout(hoverCloseTimerRef.current); hoverCloseTimerRef.current = null; } }}
                                                            onMouseLeave={scheduleCloseHoverPanel}
                                                            className="absolute left-0 mt-2 z-50 w-72 bg-white text-gray-900 rounded-lg shadow-lg border p-3"
                                                        >
                                                            <p className="text-sm font-semibold mb-2">Squad</p>
                                                            {hoverLoadingTeamId === team.id ? (
                                                                <p className="text-xs text-gray-600 py-2">Loading…</p>
                                                            ) : (
                                                                <div className="max-h-64 overflow-y-auto space-y-2">
                                                                    {(teamPurchasesMap[team.id] || []).length > 0 ? (
                                                                        (teamPurchasesMap[team.id] || []).map((p) => (
                                                                            <div key={p.id} className="flex items-center justify-between border rounded px-2 py-1">
                                                                                <div>
                                                                                    <p className="text-sm font-medium">{p.name}</p>
                                                                                    <p className="text-[11px] text-gray-600">{p.role}</p>
                                                                                </div>
                                                                                <p className="text-[12px] font-bold text-green-600">₹{((p.purchase_price || 0) / 100000).toFixed(2)} L</p>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <p className="text-xs text-gray-500 py-2">No players yet</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className={`font-bold ${
                                                    hasGivenUp ? 'text-red-400' :
                                                    team.remaining_budget > 5000000 ? 'text-green-400' :
                                                    team.remaining_budget > 2000000 ? 'text-yellow-400' :
                                                    'text-red-400'
                                                }`}>
                                                    ₹{(team.remaining_budget / 100000).toFixed(2)} L
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
                                    );
                                })}
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