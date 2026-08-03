import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auctionAPI, teamAPI } from '../services/api';

const TeamSquad = () => {
    const { teamId } = useParams();
    const navigate = useNavigate();

    const [team, setTeam] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const allTeams = await teamAPI.getTeamsByTournament(new URLSearchParams(window.location.search).get('tournamentId'));
                const teamData = allTeams.find(t => String(t.id) === String(teamId));
                setTeam(teamData || null);
                const purchases = await auctionAPI.getPurchases(teamId);
                setPlayers(purchases || []);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [teamId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🏏</span>
                    </div>
                    <p className="font-semibold text-slate-700">Loading squad…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="text-sm font-semibold text-slate-600 hover:text-emerald-700 transition"
                        >
                            ← Back
                        </button>
                        <div className="text-center min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                                {team?.team_name || 'Team'} squad
                            </h1>
                            <p className="text-[11px] text-slate-400 font-medium">Purchased players</p>
                        </div>
                        <div className="w-16" />
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold tracking-widest uppercase text-emerald-300/90 mb-2">Franchise</p>
                            <h2 className="text-2xl sm:text-3xl font-extrabold">{team?.team_name || 'Team'}</h2>
                            <p className="text-slate-300 text-sm mt-1">{players.length} player{players.length === 1 ? '' : 's'} in squad</p>
                        </div>
                        <div className="rounded-xl bg-white/10 border border-white/10 backdrop-blur px-5 py-3">
                            <p className="text-[11px] uppercase tracking-wide text-slate-300 font-semibold">Remaining budget</p>
                            <p className="text-2xl font-bold text-amber-300 mt-0.5">
                                ₹{((team?.remaining_budget || 0) / 100000).toFixed(2)} L
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">
                        Purchased players ({players.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {players.length > 0 ? players.map((p) => (
                            <div
                                key={p.id}
                                className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">{p.name}</p>
                                    <p className="text-xs text-slate-500 capitalize mt-0.5">{p.role}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Price</p>
                                    <p className="text-lg font-bold text-emerald-600">
                                        ₹{((p.purchase_price || 0) / 100000).toFixed(2)} L
                                    </p>
                                </div>
                            </div>
                        )) : (
                            <div className="md:col-span-2 text-center py-12 text-slate-400">
                                <p className="text-3xl mb-2">👕</p>
                                <p className="text-sm font-medium">No purchases yet</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default TeamSquad;
