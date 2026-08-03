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

const playerStatusStyles = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    sold: 'bg-sky-50 text-sky-700 border-sky-100',
    in_auction: 'bg-amber-50 text-amber-700 border-amber-100',
    unsold: 'bg-slate-100 text-slate-600 border-slate-200'
};

const roleLabel = (role = '') => {
    const map = {
        batsman: 'Batsman',
        bowler: 'Bowler',
        'all-rounder': 'All-rounder',
        'wicket-keeper': 'Wicket-keeper'
    };
    return map[role.toLowerCase()] || role;
};

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

    const fetchTournamentData = useCallback(async () => {
        try {
            const tournamentData = await tournamentAPI.getById(id);
            if (tournamentData.error) {
                console.error('Tournament fetch error:', tournamentData.error);
                return;
            }
            setTournament(tournamentData);

            // Check if auction has ended based on tournament status
            if (tournamentData.status === 'completed' || tournamentData.status === 'ended') {
                setAuctionEnded(true);
            }

            const teamsData = await teamAPI.getTeamsByTournament(id);
            setTeams(Array.isArray(teamsData) ? teamsData : []);

            // Always fetch my teams to determine if user has joined
            const myTeamsData = await teamAPI.getMyTeams(id);
            setMyTeams(Array.isArray(myTeamsData) ? myTeamsData : []);

            const playersData = await playerAPI.getByTournament(id);
            if (!Array.isArray(playersData)) {
                setPlayers([]);
                return;
            }

            // For sold players, we need to get their purchase price
            // Fetch all purchases once to avoid redundant API calls
            const allTeams = Array.isArray(teamsData) ? teamsData : [];
            const allPurchases = [];
            for (const team of allTeams) {
                try {
                    const purchases = await auctionAPI.getPurchases(team.id);
                    if (Array.isArray(purchases)) {
                        allPurchases.push(...purchases);
                    }
                } catch (err) {
                    console.error('Error fetching purchases for team:', team.id, err);
                }
            }

            const playersWithPurchaseInfo = playersData.map(player => {
                if (player.status === 'sold') {
                    const purchase = allPurchases.find(p => p.player_id === player.id);
                    if (purchase) {
                        return { ...player, purchase_price: purchase.purchase_price };
                    }
                }
                return player;
            });

            setPlayers(playersWithPurchaseInfo);
        } catch (error) {
            console.error('Error loading tournament data:', error);
        }
    }, [id]);

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

    const soldCount = players.filter(p => p.status === 'sold').length;
    const availableCount = players.filter(p => p.status === 'available').length;

    if (!tournament) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🏏</span>
                    </div>
                    <p className="font-semibold text-slate-700">Loading tournament…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Header */}
            <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16 gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-emerald-700 transition"
                        >
                            <span aria-hidden>←</span>
                            Dashboard
                        </button>
                        <div className="min-w-0 text-center">
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{tournament.name}</h1>
                            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Tournament detail</p>
                        </div>
                        <div className="w-20 sm:w-28 flex justify-end">
                            {isHost && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                                    Host
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Live auction banner */}
                {liveAuctionBanner && (
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                            </span>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-0.5">Live auction</p>
                                <p className="text-sm text-slate-800">
                                    Auction started for <strong>{liveAuctionBanner.playerName}</strong>
                                    {liveAuctionBanner.lastBidAmountL && (
                                        <> — current bid ₹{liveAuctionBanner.lastBidAmountL} L by {liveAuctionBanner.lastBidTeam}</>
                                    )}
                                    {liveAuctionBanner.gaveUpTeam && (
                                        <> — {liveAuctionBanner.gaveUpTeam} gave up</>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(`/auction/${id}`)}
                            className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
                        >
                            Enter auction room
                        </button>
                    </div>
                )}

                {/* Tournament hero / stats */}
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white shadow-xl">
                    <div
                        className="absolute inset-0 opacity-30"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 15% 40%, rgba(16,185,129,0.35), transparent 45%), radial-gradient(circle at 85% 20%, rgba(245,158,11,0.2), transparent 40%)'
                        }}
                    />
                    <div className="relative px-6 sm:px-8 py-7 sm:py-9">
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                            <div>
                                <p className="text-xs font-bold tracking-widest uppercase text-emerald-300/90 mb-2">
                                    Tournament room
                                </p>
                                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">{tournament.name}</h2>
                                <p className="text-slate-300 text-sm">
                                    Hosted by <span className="text-white font-semibold">{tournament.host_name}</span>
                                </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Teams</p>
                                    <p className="text-xl font-bold mt-0.5">{teams.length}/{tournament.max_teams}</p>
                                </div>
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Budget</p>
                                    <p className="text-xl font-bold mt-0.5">₹{(tournament.team_budget / 10000000).toFixed(2)} Cr</p>
                                </div>
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Players</p>
                                    <p className="text-xl font-bold mt-0.5">{players.length}</p>
                                </div>
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Status</p>
                                    <p className="text-sm font-bold mt-1 uppercase tracking-wide text-amber-300">{tournament.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Actions */}
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        {isHost && !auctionEnded && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowAddPlayerModal(true)}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
                                >
                                    Add player
                                </button>
                                <BulkPlayerImport
                                    tournamentId={id}
                                    onImportComplete={fetchTournamentData}
                                />
                                <button
                                    type="button"
                                    onClick={() => navigate(`/auction/${id}`)}
                                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold rounded-xl transition shadow-sm"
                                >
                                    Start auction
                                </button>
                                <div className="flex flex-wrap items-center gap-2 ml-0 sm:ml-2 pl-0 sm:pl-3 sm:border-l border-slate-200">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Max / team</label>
                                    <input
                                        type="number"
                                        min="1"
                                        onChange={(e) => setMaxPerTeamInput(parseInt(e.target.value || '0'))}
                                        className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                                        placeholder="e.g. 11"
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!maxPerTeamInput || maxPerTeamInput <= 0) return alert('Enter a valid number');
                                            const res = await auctionAPI.setCapacity(id, maxPerTeamInput);
                                            if (res.error) alert(res.error); else alert('Capacity updated');
                                        }}
                                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition"
                                    >
                                        Save capacity
                                    </button>
                                </div>
                            </>
                        )}
                        {isHost && auctionEnded && (
                            <button
                                type="button"
                                onClick={() => navigate(`/tournament/${id}/history`)}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition"
                            >
                                View auction history
                            </button>
                        )}
                        {!isHost && !hasJoined && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowJoinModal(true)}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
                                >
                                    Join tournament
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowJoinByCodeModal(true)}
                                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold rounded-xl transition shadow-sm"
                                >
                                    Join team by code
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/auction/${id}`)}
                                    className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition"
                                >
                                    View live auction
                                </button>
                            </>
                        )}
                        {!isHost && hasJoined && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/auction/${id}`)}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
                                >
                                    Enter auction room
                                </button>
                                {myTeams[0] && (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/team/${myTeams[0].id}/squad?tournamentId=${id}`)}
                                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition"
                                    >
                                        My squad
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => navigate(`/tournament/${id}/history`)}
                                    className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition"
                                >
                                    Auction history
                                </button>
                            </>
                        )}
                    </div>

                    {isHost && auctionEnded && (
                        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">⚠</span>
                            <p className="text-sm text-red-700 font-medium">
                                Auction has ended. You cannot add players or start a new auction.
                            </p>
                        </div>
                    )}
                </section>

                {/* My Teams */}
                {myTeams.length > 0 && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm">👕</span>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">My teams</h3>
                                <p className="text-xs text-slate-500">Your role and remaining purse</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {myTeams.map((team) => (
                                <div
                                    key={team.id}
                                    className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                >
                                    <div>
                                        <p className="font-bold text-slate-900">{team.team_name}</p>
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Role: <span className="font-semibold text-slate-700 capitalize">{team.member_role}</span>
                                            {' · '}
                                            Budget: <span className="font-semibold text-emerald-700">₹{(team.remaining_budget / 100000).toFixed(2)} L</span>
                                        </p>
                                    </div>
                                    {team.member_role === 'owner' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedTeamForCaptain(team.id);
                                                setShowInviteCaptainModal(true);
                                            }}
                                            className="shrink-0 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-sm font-semibold rounded-xl transition"
                                        >
                                            Invite captain
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Teams List */}
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">🏟️</span>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Registered teams</h3>
                                    <p className="text-xs text-slate-500">{teams.length} of {tournament.max_teams} slots</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5 space-y-3 max-h-[28rem] overflow-y-auto">
                            {teams.map((team) => (
                                <div
                                    key={team.id}
                                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 hover:border-emerald-200 transition"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/team/${team.id}/squad?tournamentId=${id}`)}
                                            className="font-bold text-slate-900 hover:text-emerald-700 text-left transition"
                                        >
                                            {team.team_name}
                                        </button>
                                        <p className="text-sm font-bold text-emerald-700 shrink-0">
                                            ₹{(team.remaining_budget / 100000).toFixed(2)} L
                                        </p>
                                    </div>
                                    {isHost && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                            <span>Code:</span>
                                            <code className="font-mono font-semibold text-emerald-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                                {team.unique_code}
                                            </code>
                                            <button
                                                type="button"
                                                onClick={() => navigator.clipboard.writeText(team.unique_code)}
                                                className="px-2 py-0.5 border border-slate-200 bg-white rounded-md hover:bg-slate-50 font-semibold text-slate-600"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    )}
                                    {team.members && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {team.members.map((member, idx) => (
                                                member.user_id && (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center text-[11px] font-medium bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg"
                                                    >
                                                        {member.name}
                                                        <span className="ml-1 text-slate-400 capitalize">({member.role})</span>
                                                    </span>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {teams.length === 0 && (
                                <div className="text-center py-10 text-slate-400">
                                    <p className="text-3xl mb-2">👥</p>
                                    <p className="text-sm font-medium">No teams registered yet</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Players List */}
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-sm">🏏</span>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900">Players ({players.length})</h3>
                                    <p className="text-xs text-slate-500 truncate">
                                        {availableCount} available · {soldCount} sold
                                    </p>
                                </div>
                            </div>
                            {isHost && (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/tournament/${id}/history`)}
                                    className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                                >
                                    History
                                </button>
                            )}
                        </div>
                        <div className="p-4 sm:p-5 space-y-2.5 max-h-[28rem] overflow-y-auto">
                            {players.map((player) => (
                                <div
                                    key={player.id}
                                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 flex justify-between items-center gap-3"
                                >
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{player.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{roleLabel(player.role)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {player.status === 'sold' && player.purchase_price ? (
                                            <>
                                                <p className="text-[10px] text-slate-400">Base ₹{(player.base_price / 100000).toFixed(2)} L</p>
                                                <p className="text-sm font-bold text-emerald-600">₹{(player.purchase_price / 100000).toFixed(2)} L</p>
                                            </>
                                        ) : (
                                            <p className="text-sm font-bold text-slate-800">₹{(player.base_price / 100000).toFixed(2)} L</p>
                                        )}
                                        <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                                            playerStatusStyles[player.status] || playerStatusStyles.unsold
                                        }`}>
                                            {player.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {players.length === 0 && (
                                <div className="text-center py-10 text-slate-400">
                                    <p className="text-3xl mb-2">📋</p>
                                    <p className="text-sm font-medium">No players added yet</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Join Tournament Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">New franchise</p>
                            <h3 className="text-xl font-bold text-slate-900">Join tournament</h3>
                        </div>
                        <form onSubmit={handleJoinTournament} className="px-6 py-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Team name</label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                    placeholder="e.g., Mumbai Riders"
                                    required
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="is-captain"
                                    checked={isOwnerAlsoCaptain}
                                    onChange={(e) => setIsOwnerAlsoCaptain(e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                I am also the team captain
                            </label>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowJoinModal(false)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
                                >
                                    Join
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join by Team Code Modal (joins as Owner) */}
            {showJoinByCodeModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-6 py-5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">Team code</p>
                            <h3 className="text-xl font-bold text-slate-900">Join team by code</h3>
                        </div>
                        <form onSubmit={handleJoinByCode} className="px-6 py-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Team code</label>
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-mono tracking-wider focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 outline-none transition"
                                    placeholder="TEAM-XXXXXX"
                                    required
                                />
                            </div>
                            <p className="text-sm text-slate-500">
                                You will join as <span className="font-semibold text-slate-800">Owner</span> of the team.
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowJoinByCodeModal(false)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-xl transition"
                                >
                                    Join
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Player Modal */}
            {showAddPlayerModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Player pool</p>
                            <h3 className="text-xl font-bold text-slate-900">Add player</h3>
                        </div>
                        <form onSubmit={handleAddPlayer} className="px-6 py-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Player name</label>
                                <input
                                    type="text"
                                    value={newPlayer.name}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
                                <select
                                    value={newPlayer.role}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, role: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition bg-white"
                                >
                                    <option value="batsman">Batsman</option>
                                    <option value="bowler">Bowler</option>
                                    <option value="all-rounder">All-rounder</option>
                                    <option value="wicket-keeper">Wicket-keeper</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Base price (₹ in lakhs)</label>
                                <input
                                    type="number"
                                    value={newPlayer.base_price}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, base_price: parseFloat(e.target.value) })}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                    step="0.1"
                                    min="0.1"
                                    required
                                />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddPlayerModal(false)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
                                >
                                    Add player
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invite Captain Modal */}
            {showInviteCaptainModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Team invite</p>
                            <h3 className="text-xl font-bold text-slate-900">Invite captain</h3>
                        </div>
                        <form onSubmit={handleInviteCaptain} className="px-6 py-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Captain&apos;s email</label>
                                <input
                                    type="email"
                                    value={captainEmail}
                                    onChange={(e) => setCaptainEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                    placeholder="captain@example.com"
                                    required
                                />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowInviteCaptainModal(false);
                                        setCaptainEmail('');
                                        setSelectedTeamForCaptain(null);
                                    }}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition"
                                >
                                    Send invite
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
