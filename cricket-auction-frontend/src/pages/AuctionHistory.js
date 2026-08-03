import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamAPI, playerAPI, auctionAPI } from '../services/api';

// Aggregates sold and unsold players for a tournament with purchase details
const AuctionHistory = () => {
    const { tournamentId } = useParams();
    const navigate = useNavigate();

    const [sold, setSold] = useState([]);
    const [unsold, setUnsold] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [allTeams, allPlayers] = await Promise.all([
                    teamAPI.getTeamsByTournament(tournamentId),
                    playerAPI.getByTournament(tournamentId)
                ]);

                const soldPlayers = [];
                const unsoldPlayers = (allPlayers || []).filter(p => p.status === 'unsold');

                for (const team of allTeams || []) {
                    try {
                        const purchases = await auctionAPI.getPurchases(team.id);
                        for (const purchase of purchases || []) {
                            soldPlayers.push({
                                ...purchase,
                                team_id: team.id,
                                team_name: team.team_name
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to fetch purchases for team ${team.id}:`, error);
                    }
                }

                setSold(soldPlayers);
                setUnsold(unsoldPlayers);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tournamentId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🏏</span>
                    </div>
                    <p className="font-semibold text-slate-700">Loading auction history…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(`/tournament/${tournamentId}`)}
                            className="text-sm font-semibold text-slate-600 hover:text-emerald-700 transition"
                        >
                            ← Tournament
                        </button>
                        <div className="text-center min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Auction history</h1>
                            <p className="text-[11px] text-slate-400 font-medium">Sold & unsold board</p>
                        </div>
                        <div className="w-20" />
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Sold</p>
                        <p className="text-3xl font-extrabold text-emerald-600 mt-1">{sold.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Unsold</p>
                        <p className="text-3xl font-extrabold text-amber-600 mt-1">{unsold.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total</p>
                        <p className="text-3xl font-extrabold text-slate-900 mt-1">{sold.length + unsold.length}</p>
                    </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">✓</span>
                        Sold players ({sold.length})
                    </h2>
                    {sold.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sold.map((player) => (
                                <div
                                    key={player.id}
                                    className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 truncate">{player.name}</h3>
                                            <p className="text-xs text-slate-500 capitalize mt-0.5">{player.role}</p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                                            Sold
                                        </span>
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-slate-500">Team</span>
                                            <span className="font-semibold text-slate-800 text-right">{player.team_name || 'Unknown'}</span>
                                        </div>
                                        {player.base_price != null && (
                                            <div className="flex justify-between gap-2">
                                                <span className="text-slate-500">Base</span>
                                                <span className="text-slate-600">₹{((player.base_price || 0) / 100000).toFixed(2)} L</span>
                                            </div>
                                        )}
                                        {player.purchase_price != null && (
                                            <div className="flex justify-between gap-2 pt-1 border-t border-emerald-100">
                                                <span className="text-slate-500">Sold for</span>
                                                <span className="font-bold text-emerald-700">₹{((player.purchase_price || 0) / 100000).toFixed(2)} L</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-slate-400 py-10 text-sm">No players sold yet</p>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm">—</span>
                        Unsold players ({unsold.length})
                    </h2>
                    {unsold.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {unsold.map((player) => (
                                <div
                                    key={player.id}
                                    className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between mb-3 gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 truncate">{player.name}</h3>
                                            <p className="text-xs text-slate-500 capitalize mt-0.5">{player.role}</p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                                            Unsold
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Base price</span>
                                        <span className="font-bold text-amber-700">₹{((player.base_price || 0) / 100000).toFixed(2)} L</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-slate-400 py-10 text-sm">All players sold</p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AuctionHistory;
