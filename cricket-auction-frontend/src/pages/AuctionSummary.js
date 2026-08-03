import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auctionAPI } from '../services/api';

const AuctionSummary = () => {
    const { tournamentId } = useParams();
    const navigate = useNavigate();

    const [teams, setTeams] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [unsold, setUnsold] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await auctionAPI.endAuction(tournamentId);
                if (!data.error) {
                    setTeams(data.teams || []);
                    setPurchases(data.purchases || []);
                    setUnsold(data.unsold || []);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tournamentId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg">
                        <span className="text-2xl">🏏</span>
                    </div>
                    <p className="font-semibold text-slate-700">Loading summary…</p>
                </div>
            </div>
        );
    }

    const byTeam = purchases.reduce((acc, p) => {
        acc[p.team_id] = acc[p.team_id] || [];
        acc[p.team_id].push(p);
        return acc;
    }, {});

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
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Auction summary</h1>
                            <p className="text-[11px] text-slate-400 font-medium">Final board</p>
                        </div>
                        <div className="w-20" />
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
                    <p className="text-xs font-bold tracking-widest uppercase text-emerald-300/90 mb-2">Session complete</p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Final auction board</h2>
                    <p className="text-slate-300 text-sm">
                        {teams.length} teams · {purchases.length} purchases · {unsold.length} unsold
                    </p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Teams overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teams.map(team => (
                            <div key={team.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-bold text-slate-900 truncate">{team.team_name}</p>
                                    <p className="text-sm font-bold text-emerald-700 shrink-0">
                                        ₹{(team.remaining_budget / 100000).toFixed(2)} L
                                    </p>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wide font-semibold">Remaining budget</p>
                                <p className="text-sm text-slate-600 mt-2">
                                    Players bought: <span className="font-semibold text-slate-900">{(byTeam[team.id] || []).length}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Squads</h2>
                    <div className="space-y-5">
                        {teams.map(team => (
                            <div key={team.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                                <h3 className="font-bold text-slate-900 mb-3">
                                    {team.team_name}{' '}
                                    <span className="text-slate-400 font-semibold text-sm">({(byTeam[team.id] || []).length})</span>
                                </h3>
                                {(byTeam[team.id] || []).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {(byTeam[team.id] || []).map(p => (
                                            <div
                                                key={p.id}
                                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-900 truncate">{p.name}</p>
                                                    <p className="text-[11px] text-slate-500 capitalize">{p.role}</p>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-700 shrink-0">
                                                    ₹{(p.purchase_price / 100000).toFixed(2)} L
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400">No purchases</p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 mb-4">Unsold players ({unsold.length})</h2>
                    {unsold.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {unsold.map(p => (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-900 truncate">{p.name}</p>
                                        <p className="text-[11px] text-slate-500 capitalize">{p.role}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-amber-700 shrink-0">
                                        Base ₹{(p.base_price / 100000).toFixed(2)} L
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">No unsold players</p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AuctionSummary;
