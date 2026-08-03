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

    const isHost = !!(tournament && user && tournament.host_id === user.id);
    // Check if every team has at least one owner assigned
    const allOwnersReady = allTeams.length > 0 && allTeams.every(team => {
        return team.members && team.members.some(m => m.role === 'owner');
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
                    winning_team_id: data.winning_team_id,
                    price_lakhs: (data.final_price / 100000).toFixed(2)
                });
            } else {
                setMessage(`${data.player_name} went unsold`);
                setFinalizeModal({
                    status: 'unsold',
                    player_name: data.player_name
                });
            }
            
            // Auto-refresh everything after 4 seconds
            setTimeout(() => {
                setCurrentAuction(null);
                setCurrentPlayer(null);
                setBidHistory([]);
                setMessage('');
                setSecondsRemaining(null);
                setFinalizeModal(null);
                
                // Refresh all data
                fetchTournamentData();
            }, 4000);
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
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🏏</span>
                    </div>
                    <p className="font-semibold text-slate-200">Loading auction room…</p>
                </div>
            </div>
        );
    }

    const bidButtons = [
        { label: '-₹5L', delta: -500000 },
        { label: '-₹1L', delta: -100000 },
        { label: '-₹0.5L', delta: -50000 },
        { label: 'Reset', delta: 0 },
        { label: '+₹0.5L', delta: 50000 },
        { label: '+₹1L', delta: 100000 },
        { label: '+₹5L', delta: 500000 },
        { label: '+₹10L', delta: 1000000 },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <nav className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(`/tournament/${tournamentId}`)}
                            className="text-sm font-semibold text-slate-400 hover:text-emerald-400 transition shrink-0"
                        >
                            ← Tournament
                        </button>
                        <div className="min-w-0 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                </span>
                                <h1 className="text-sm sm:text-lg font-bold text-white truncate">
                                    {tournament.name}
                                </h1>
                            </div>
                            <p className="text-[11px] text-amber-400/90 font-semibold tracking-wide uppercase">Auction room</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm shrink-0">
                            <button
                                type="button"
                                onClick={() => navigate(`/tournament/${tournamentId}/history`)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition"
                            >
                                History
                            </button>
                            {!isHost && selectedTeam && (
                                <>
                                    <div className="text-right hidden md:block mr-1">
                                        <p className="font-semibold text-white text-xs leading-tight">{selectedTeam.team_name}</p>
                                        <p className="text-emerald-400 text-xs font-bold">₹{(selectedTeam.remaining_budget / 100000).toFixed(2)} L</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/team/${selectedTeam.id}/squad?tournamentId=${tournamentId}`)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition"
                                    >
                                        Squad
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
                {isHost && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 space-y-4 shadow-lg">
                        <div className="flex flex-wrap gap-3 items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Host controls</p>
                                <p className="text-sm text-slate-400 mt-0.5">Manage the floor and end the session</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={handleDistributeRemaining}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold rounded-xl transition"
                                >
                                    Distribute remaining
                                </button>
                                <button
                                    type="button"
                                    onClick={handleEndAuction}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition"
                                >
                                    End auction
                                </button>
                            </div>
                        </div>
                        <div className={`rounded-xl p-3.5 border ${allOwnersReady ? 'bg-emerald-950/50 border-emerald-800/60' : 'bg-amber-950/40 border-amber-800/50'}`}>
                            <div className="flex items-center justify-between gap-3 mb-2.5">
                                <p className={`text-sm font-semibold ${allOwnersReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                                    {allOwnersReady ? 'All teams have owners assigned' : 'Waiting for all teams to have owners…'}
                                </p>
                                <button
                                    type="button"
                                    onClick={fetchTournamentData}
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition border border-slate-700"
                                >
                                    Refresh
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {allTeams.map(team => {
                                    const hasOwner = team.members && team.members.some(m => m.role === 'owner');
                                    return (
                                        <span
                                            key={team.id}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                                hasOwner
                                                    ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/40'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}
                                        >
                                            {hasOwner ? '●' : '○'} {team.team_name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {finalizeModal && (() => {
                    const isMyTeamWinner = finalizeModal.status === 'sold' && selectedTeam && selectedTeam.id === finalizeModal.winning_team_id;
                    const isSold = finalizeModal.status === 'sold';
                    return (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                            <div
                                className={`rounded-2xl p-8 w-full max-w-md shadow-2xl text-center border ${
                                    isMyTeamWinner
                                        ? 'bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-400/30 text-white'
                                        : isSold
                                            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-amber-500/30 text-white'
                                            : 'bg-gradient-to-br from-red-700 to-red-900 border-red-400/30 text-white'
                                }`}
                                style={{ animation: 'scaleIn 0.3s ease-out' }}
                            >
                                <div className="text-5xl mb-4">
                                    {isMyTeamWinner ? '🎉' : isSold ? '🔨' : '😔'}
                                </div>
                                <h3 className="text-3xl font-black mb-2 tracking-tight">
                                    {isMyTeamWinner ? 'CONGRATULATIONS!' : isSold ? 'SOLD!' : 'UNSOLD'}
                                </h3>
                                {isMyTeamWinner && (
                                    <p className="text-base text-emerald-100 mb-4">Your team won this player</p>
                                )}
                                <div className="bg-white/15 rounded-xl p-4 mb-4 border border-white/10">
                                    <p className="text-2xl font-bold">{finalizeModal.player_name}</p>
                                </div>
                                {isSold && (
                                    <div className="space-y-2 mb-4">
                                        <p className="text-lg">
                                            <span className="opacity-80">Bought by</span>
                                            <br />
                                            <span className="font-bold text-2xl">{finalizeModal.team_name}</span>
                                        </p>
                                        <p className="text-3xl font-black text-amber-300">
                                            ₹{finalizeModal.price_lakhs} L
                                        </p>
                                    </div>
                                )}
                                {!isSold && (
                                    <p className="text-lg opacity-80 mb-4">No bids were placed for this player</p>
                                )}
                                <div className="flex gap-3 justify-center mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setFinalizeModal(null)}
                                        className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 transition font-semibold"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setFinalizeModal(null); navigate(`/tournament/${tournamentId}/history`); }}
                                        className="px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition font-semibold"
                                    >
                                        View history
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {message && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-100 px-5 py-3 text-center text-sm sm:text-base font-semibold">
                        {message}
                    </div>
                )}
                {giveUpTeams && giveUpTeams.length > 0 && (
                    <div className="rounded-xl border border-red-500/30 bg-red-950/40 text-red-200 px-5 py-3 text-center text-sm">
                        {giveUpTeams[giveUpTeams.length - 1]?.team_name} gave up on {currentPlayer?.name}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 space-y-5">
                        {currentAuction && currentPlayer ? (
                            <div className="relative overflow-hidden rounded-2xl border border-emerald-800/50 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-5">
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-red-300 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            Live
                                        </span>
                                        {Number.isFinite(secondsRemaining) && secondsRemaining !== null && (
                                            <span className="text-xs font-bold font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                                                ⏱ {secondsRemaining}s
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-center mb-6">
                                        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-400/80 mb-2">Player on the block</p>
                                        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-1 tracking-tight">{currentPlayer.name}</h2>
                                        <p className="text-base text-emerald-200/80 capitalize">{currentPlayer.role}</p>
                                        <p className="text-xs text-slate-400 mt-2">
                                            Base price ₹{(currentPlayer.base_price / 100000).toFixed(2)} L
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 mb-6">
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold tracking-widest uppercase text-amber-400/90 mb-1">Current bid</p>
                                            <p className="text-4xl sm:text-5xl font-black text-amber-300 tracking-tight">
                                                ₹{(currentAuction.current_bid / 100000).toFixed(2)}
                                                <span className="text-lg font-bold text-amber-400/80 ml-1">L</span>
                                            </p>
                                            {currentAuction.current_bidder_name && (
                                                <p className="text-sm mt-2 text-slate-300">
                                                    Leading: <span className="font-bold text-white">{currentAuction.current_bidder_name}</span>
                                                </p>
                                            )}
                                            {Number.isFinite(secondsRemaining) && secondsRemaining !== null && (
                                                <p className="mt-3 text-amber-200 font-semibold text-sm">
                                                    Finalizing in {secondsRemaining}s…
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {!isHost && canBid && !hasGivenUp && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Your bid amount</label>
                                                <div className="flex space-x-2">
                                                    <input
                                                        type="number"
                                                        value={Number((bidAmount / 100000).toFixed(2))}
                                                        onChange={(e) => {
                                                            const lakhs = parseFloat(e.target.value || '0');
                                                            if (isNaN(lakhs)) return;
                                                            setBidAmount(Math.round(lakhs * 100000));
                                                        }}
                                                        step="0.5"
                                                        className="flex-1 px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                                    />
                                                    <span className="flex items-center text-lg font-semibold text-slate-400 px-2">L</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                {bidButtons.map((b) => (
                                                    <button
                                                        key={b.label}
                                                        type="button"
                                                        onClick={() => adjustBid(b.delta)}
                                                        className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-2 py-2 rounded-lg text-xs font-semibold text-slate-200 transition"
                                                    >
                                                        {b.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handlePlaceBid}
                                                    disabled={bidAmount < Math.round((currentAuction?.current_bid || 0) + MIN_INCREMENT)}
                                                    className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-black py-4 rounded-xl text-lg transition shadow-lg shadow-amber-900/20"
                                                >
                                                    PLACE BID
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleGiveUp}
                                                    className="px-5 py-4 bg-red-600/90 hover:bg-red-500 text-white font-bold rounded-xl text-sm sm:text-base transition border border-red-500/50"
                                                >
                                                    GIVE UP
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!isHost && hasGivenUp && (
                                        <div className="text-center p-5 bg-red-950/50 border border-red-800/50 rounded-xl">
                                            <p className="text-lg font-bold text-red-300">You have given up on this player</p>
                                            <p className="text-sm text-red-200/80 mt-1">You cannot bid on {currentPlayer.name}</p>
                                        </div>
                                    )}

                                    {isHost && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {secondsRemaining && secondsRemaining > 0 ? (
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="w-full bg-amber-500 text-slate-900 font-bold py-4 rounded-xl text-lg opacity-90"
                                                >
                                                    Finalizing in {secondsRemaining}s
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (!currentAuction) return;
                                                        await auctionAPI.warn(currentAuction.id, 10);
                                                    }}
                                                    className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-xl text-lg transition"
                                                >
                                                    WARN (10s)
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleFinalizeAuction}
                                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-xl text-lg transition"
                                            >
                                                FINALIZE NOW
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 sm:p-10 shadow-lg">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Up next</p>
                                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Next player</h2>
                                {isHost ? (
                                    <>
                                        {availablePlayers.length > 0 ? (
                                            <div className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-6">
                                                <div>
                                                    <p className="text-xl font-semibold text-white">{availablePlayers[0].name}</p>
                                                    <p className="text-sm text-slate-400 capitalize">{availablePlayers[0].role}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Base</p>
                                                    <p className="text-2xl font-bold text-amber-300">₹{(availablePlayers[0].base_price / 100000).toFixed(2)} L</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-slate-500 mb-6">No players available</p>
                                        )}
                                        {!allOwnersReady && (
                                            <p className="text-amber-400 text-sm mb-3 text-center font-medium">
                                                Waiting for all team owners to join before starting…
                                            </p>
                                        )}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                type="button"
                                                onClick={() => availablePlayers[0] && handleStartAuction(availablePlayers[0])}
                                                disabled={availablePlayers.length === 0 || !allOwnersReady}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition"
                                            >
                                                Start next player
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleStartRandom}
                                                disabled={availablePlayers.length === 0 || !allOwnersReady}
                                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-semibold border border-slate-700 transition"
                                            >
                                                Start random
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-center text-slate-400 py-6">Waiting for host to announce the next player…</p>
                                )}
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-lg">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span className="text-amber-400">📋</span> Bid history
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {bidHistory.length > 0 ? (
                                    bidHistory.map((bid, index) => (
                                        <div
                                            key={index}
                                            className="bg-slate-950/60 border border-slate-800 px-4 py-3 rounded-xl flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-semibold text-white">{bid.team_name}</p>
                                                <p className="text-xs text-slate-500">{bid.bidder_name}</p>
                                            </div>
                                            <p className="text-base font-bold text-amber-300">
                                                ₹{(bid.bid_amount / 100000).toFixed(2)} L
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-500 text-center py-6 text-sm">No bids yet</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-lg">
                            <h3 className="text-lg font-bold text-white mb-4">
                                Available ({availablePlayers.length})
                            </h3>
                            {(() => {
                                const order = ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'];
                                const label = {
                                    'batsman': 'Batsmen',
                                    'bowler': 'Bowlers',
                                    'all-rounder': 'All-rounders',
                                    'wicket-keeper': 'Wicket-keepers'
                                };
                                const groups = order.map(r => ({
                                    role: r,
                                    items: availablePlayers.filter(p => (p.role || '').toLowerCase() === r)
                                })).filter(g => g.items.length > 0);
                                if (groups.length === 0) return <p className="text-slate-500 text-center py-4 text-sm">No players available</p>;
                                return (
                                    <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                                        {groups.map(group => (
                                            <div key={group.role}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <p className="text-[11px] tracking-wide uppercase text-slate-400 font-bold">
                                                        {label[group.role]} <span className="text-slate-600">({group.items.length})</span>
                                                    </p>
                                                    <span className="h-px flex-1 bg-slate-800" />
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {group.items.map(player => (
                                                        <div
                                                            key={player.id}
                                                            className="bg-slate-950/50 hover:bg-slate-950/80 transition border border-slate-800 rounded-xl px-3.5 py-2.5"
                                                        >
                                                            <div className="flex justify-between items-center gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-sm text-white truncate">{player.name}</p>
                                                                    <p className="text-[11px] text-slate-500">Base ₹{(player.base_price / 100000).toFixed(2)} L</p>
                                                                </div>
                                                                {isHost && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartAuction(player)}
                                                                        disabled={currentAuction !== null}
                                                                        className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition"
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

                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 shadow-lg">
                            <h3 className="text-lg font-bold text-white mb-4">Team purses</h3>
                            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                {allTeams.map((team) => {
                                    const teamGaveUp = Array.isArray(giveUpTeams) && giveUpTeams.some(giveUp => giveUp.team_id === team.id);
                                    return (
                                        <div
                                            key={team.id}
                                            className={`px-3.5 py-3 rounded-xl border ${
                                                teamGaveUp
                                                    ? 'bg-red-950/40 border-red-800/50'
                                                    : 'bg-slate-950/50 border-slate-800'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="relative min-w-0">
                                                    <button
                                                        type="button"
                                                        onMouseEnter={() => openTeamHoverPanel(team)}
                                                        onMouseLeave={scheduleCloseHoverPanel}
                                                        className={`font-semibold text-left text-sm hover:underline truncate ${teamGaveUp ? 'text-red-300' : 'text-white'}`}
                                                    >
                                                        {team.team_name}
                                                        {teamGaveUp && <span className="text-[10px] ml-1.5 text-red-400 font-bold">(GAVE UP)</span>}
                                                    </button>
                                                    {hoveredTeamId === team.id && (
                                                        <div
                                                            onMouseEnter={() => { if (hoverCloseTimerRef.current) { clearTimeout(hoverCloseTimerRef.current); hoverCloseTimerRef.current = null; } }}
                                                            onMouseLeave={scheduleCloseHoverPanel}
                                                            className="absolute left-0 mt-2 z-50 w-72 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 p-3"
                                                        >
                                                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Squad</p>
                                                            {hoverLoadingTeamId === team.id ? (
                                                                <p className="text-xs text-slate-500 py-2">Loading…</p>
                                                            ) : (
                                                                <div className="max-h-64 overflow-y-auto space-y-1.5">
                                                                    {(teamPurchasesMap[team.id] || []).length > 0 ? (
                                                                        (teamPurchasesMap[team.id] || []).map((p) => (
                                                                            <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-2 py-1.5 bg-slate-50">
                                                                                <div>
                                                                                    <p className="text-sm font-medium">{p.name}</p>
                                                                                    <p className="text-[11px] text-slate-500 capitalize">{p.role}</p>
                                                                                </div>
                                                                                <p className="text-[12px] font-bold text-emerald-600">₹{((p.purchase_price || 0) / 100000).toFixed(2)} L</p>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <p className="text-xs text-slate-400 py-2">No players yet</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className={`font-bold text-sm shrink-0 ${
                                                    teamGaveUp ? 'text-red-400' :
                                                    team.remaining_budget > 5000000 ? 'text-emerald-400' :
                                                    team.remaining_budget > 2000000 ? 'text-amber-300' :
                                                    'text-red-400'
                                                }`}>
                                                    ₹{(team.remaining_budget / 100000).toFixed(2)} L
                                                </p>
                                            </div>
                                            {team.members && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {team.members.map((member, idx) => (
                                                        member.user_id && (
                                                            <span key={idx} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
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

                        {!isHost && myTeams.length > 1 && (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
                                <h3 className="text-lg font-bold text-white mb-3">Select team</h3>
                                <select
                                    value={selectedTeam?.id || ''}
                                    onChange={(e) => {
                                        const team = myTeams.find(t => t.id === parseInt(e.target.value));
                                        setSelectedTeam(team);
                                        teamAPI.canBid(team.id).then(data => setCanBid(data.can_bid));
                                    }}
                                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
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
