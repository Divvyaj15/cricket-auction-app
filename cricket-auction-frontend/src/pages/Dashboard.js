import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { tournamentAPI } from '../services/api';

const formatBudgetLakhs = (budget) => {
    if (budget == null || Number.isNaN(Number(budget))) return '—';
    return `₹${(Number(budget) / 100000).toFixed(1)} L`;
};

const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Dashboard = () => {
    const [hostedTournaments, setHostedTournaments] = useState([]);
    const [participatingTournaments, setParticipatingTournaments] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [tournamentToDelete, setTournamentToDelete] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tournamentCode, setTournamentCode] = useState('');
    const [copiedCode, setCopiedCode] = useState(null);
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

    const handleDeleteTournament = (tournament) => {
        setTournamentToDelete(tournament);
        setShowDeleteModal(true);
    };

    const confirmDeleteTournament = async () => {
        if (!tournamentToDelete) return;

        try {
            const data = await tournamentAPI.delete(tournamentToDelete.id);

            if (data.error) {
                alert('Error: ' + data.error);
            } else {
                alert('Tournament deleted successfully!');
                setShowDeleteModal(false);
                setTournamentToDelete(null);
                fetchTournaments(); // Refresh the list
            }
        } catch (error) {
            alert('Error deleting tournament');
            console.error(error);
        }
    };

    const copyCode = async (code, e) => {
        e?.stopPropagation?.();
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 1500);
        } catch {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = code;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 1500);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg shadow-emerald-900/10">
                        <span className="text-3xl">🏏</span>
                    </div>
                    <p className="text-base font-semibold text-slate-700">Loading your dashboard…</p>
                    <p className="text-sm text-slate-400 mt-1">Fetching tournaments</p>
                </div>
            </div>
        );
    }

    const firstName = user?.name?.split(/\s+/)[0] || 'there';
    const totalTournaments = hostedTournaments.length + participatingTournaments.length;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Header */}
            <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl flex items-center justify-center shadow-md border border-emerald-500/20">
                                <span className="text-white text-xl">🏏</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                                    Cricket <span className="text-amber-500">Auction</span>
                                </h1>
                                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Tournament dashboard</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                                    {getInitials(user?.name)}
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-semibold text-slate-900 leading-tight">{user?.name}</p>
                                    <p className="text-xs text-slate-500">{user?.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    logout();
                                    navigate('/');
                                }}
                                className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition shadow-sm"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Welcome banner */}
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white shadow-xl">
                    <div className="absolute inset-0 opacity-30" style={{
                        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(16,185,129,0.35), transparent 45%), radial-gradient(circle at 80% 20%, rgba(245,158,11,0.25), transparent 40%)'
                    }} />
                    <div className="relative px-6 sm:px-8 py-8 sm:py-10">
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                            <div>
                                <p className="text-xs font-bold tracking-widest uppercase text-emerald-300/90 mb-2">
                                    Auction control room
                                </p>
                                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
                                    Welcome back, {firstName}
                                </h2>
                                <p className="text-slate-300 max-w-xl text-sm sm:text-base">
                                    Host live auctions, share tournament codes, or join a league your friends set up.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3 min-w-[110px]">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Hosting</p>
                                    <p className="text-2xl font-bold text-white mt-0.5">{hostedTournaments.length}</p>
                                </div>
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3 min-w-[110px]">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Joined</p>
                                    <p className="text-2xl font-bold text-white mt-0.5">{participatingTournaments.length}</p>
                                </div>
                                <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3 min-w-[110px]">
                                    <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Total</p>
                                    <p className="text-2xl font-bold text-amber-300 mt-0.5">{totalTournaments}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quick actions */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className="group text-left rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-2xl flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition">
                                🏟️
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition">
                                    Create tournament
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Set teams, budget, and get a shareable join code.
                                </p>
                                <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-emerald-600">
                                    Open form
                                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                                </span>
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowJoinModal(true)}
                        className="group text-left rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-amber-200 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 text-2xl flex items-center justify-center border border-amber-100 group-hover:scale-105 transition">
                                🎫
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition">
                                    Join tournament
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Enter the code shared by the host to jump in.
                                </p>
                                <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-amber-600">
                                    Enter code
                                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                                </span>
                            </div>
                        </div>
                    </button>
                </section>

                {/* Hosted Tournaments */}
                {hostedTournaments.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">🏆</span>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">My tournaments</h3>
                                    <p className="text-xs text-slate-500">You are the host</p>
                                </div>
                            </div>
                            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                                {hostedTournaments.length} active
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {hostedTournaments.map((tournament) => (
                                <div
                                    key={tournament.id}
                                    className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-slate-200 overflow-hidden group relative flex flex-col"
                                >
                                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-700" />
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                                                Host
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTournament(tournament);
                                                }}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                                title="Delete Tournament"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => navigate(`/tournament/${tournament.id}`)}
                                            className="text-left flex-1 flex flex-col"
                                        >
                                            <h4 className="text-lg font-bold text-slate-900 mb-4 group-hover:text-emerald-700 transition line-clamp-2">
                                                {tournament.name}
                                            </h4>

                                            <div className="space-y-2.5 text-sm flex-1">
                                                <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Code</p>
                                                        <code className="font-mono font-bold text-emerald-700 text-sm">
                                                            {tournament.unique_code}
                                                        </code>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => copyCode(tournament.unique_code, e)}
                                                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition"
                                                    >
                                                        {copiedCode === tournament.unique_code ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Teams</p>
                                                        <p className="font-bold text-slate-800">{tournament.max_teams}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                                        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Budget</p>
                                                        <p className="font-bold text-slate-800">{formatBudgetLakhs(tournament.team_budget)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-sm font-semibold text-emerald-600">Manage tournament</span>
                                                <span className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm group-hover:bg-emerald-600 group-hover:text-white transition">
                                                    →
                                                </span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Participating Tournaments */}
                {participatingTournaments.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm">👥</span>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Joined tournaments</h3>
                                    <p className="text-xs text-slate-500">You are a participant</p>
                                </div>
                            </div>
                            <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full">
                                {participatingTournaments.length} joined
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {participatingTournaments.map((tournament) => (
                                <button
                                    type="button"
                                    key={tournament.id}
                                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                                    className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-200 overflow-hidden group text-left flex flex-col"
                                >
                                    <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
                                    <div className="p-5 flex-1 flex flex-col">
                                        <span className="self-start text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md mb-3">
                                            Participant
                                        </span>
                                        <h4 className="text-lg font-bold text-slate-900 mb-4 group-hover:text-amber-700 transition line-clamp-2">
                                            {tournament.name}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm flex-1">
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Host</p>
                                                <p className="font-bold text-slate-800 truncate">{tournament.host_name}</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Budget</p>
                                                <p className="font-bold text-slate-800">{formatBudgetLakhs(tournament.team_budget)}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-sm font-semibold text-amber-600">Open tournament</span>
                                            <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-sm group-hover:bg-amber-500 group-hover:text-white transition">
                                                →
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty State */}
                {hostedTournaments.length === 0 && participatingTournaments.length === 0 && (
                    <section className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">
                            🏆
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No tournaments yet</h3>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            Create your first auction night or join with a code from a host.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-sm"
                            >
                                Create tournament
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowJoinModal(true)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition"
                            >
                                Join with code
                            </button>
                        </div>
                    </section>
                )}
            </div>

            {/* Create Tournament Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
                        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 sm:px-8 py-5 flex items-start justify-between gap-4 z-10">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Host setup</p>
                                <h3 className="text-xl font-bold text-slate-900">Create tournament</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateTournament} className="px-6 sm:px-8 py-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Tournament name</label>
                                <input
                                    type="text"
                                    value={newTournament.name}
                                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                    placeholder="College Premier League 2025"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Max teams</label>
                                    <input
                                        type="number"
                                        value={newTournament.max_teams}
                                        onChange={(e) => setNewTournament({ ...newTournament, max_teams: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                        placeholder="8"
                                        min="2"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Budget (₹ lakhs)</label>
                                    <input
                                        type="number"
                                        value={newTournament.team_budget}
                                        onChange={(e) => setNewTournament({ ...newTournament, team_budget: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                        placeholder="100"
                                        step="0.1"
                                        min="0.1"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-slate-700">Team names</label>
                                    <button
                                        type="button"
                                        onClick={handleAddTeamName}
                                        className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                                    >
                                        + Add team
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mb-2">
                                    Number of fields matches max teams. Fill every name before creating.
                                </p>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {newTournament.team_names.map((name, index) => (
                                        <div key={index} className="flex gap-2">
                                            <span className="w-9 h-10 shrink-0 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => handleTeamNameChange(index, e.target.value)}
                                                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none transition"
                                                placeholder={`Team ${index + 1}`}
                                            />
                                            {newTournament.team_names.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTeamName(index)}
                                                    className="px-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-100"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm transition"
                                >
                                    Create tournament
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Tournament Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 px-6 py-5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">Join league</p>
                            <h3 className="text-xl font-bold text-slate-900">Enter tournament code</h3>
                        </div>

                        <form onSubmit={handleJoinTournament} className="px-6 py-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Tournament code</label>
                                <input
                                    type="text"
                                    value={tournamentCode}
                                    onChange={(e) => setTournamentCode(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 font-mono text-lg tracking-wider outline-none transition"
                                    placeholder="TOUR-XXXXXX"
                                    required
                                />
                                <p className="mt-2 text-sm text-slate-500">
                                    Use the code shared by the tournament host.
                                </p>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowJoinModal(false);
                                        setTournamentCode('');
                                    }}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-xl shadow-sm transition"
                                >
                                    Join tournament
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && tournamentToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-slate-200">
                        <div className="text-center">
                            <div className="mx-auto w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-4">
                                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete tournament?</h3>
                            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                                Are you sure you want to delete <strong className="text-slate-900">"{tournamentToDelete.name}"</strong>?
                                This cannot be undone and will remove teams, players, and auction data.
                            </p>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setTournamentToDelete(null);
                                }}
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteTournament}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition"
                            >
                                Delete tournament
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
