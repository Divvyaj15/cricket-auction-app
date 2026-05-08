import React, { useEffect, useState } from 'react';
import { auctionAPI } from '../services/api';

const AuctionSummary = () => {
    const { tournamentId } = useParams();
    const navigate = useNavigate();
    // const { user } = useContext(AuthContext);

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

    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

    // Group purchases by team
    const byTeam = purchases.reduce((acc, p) => {
        acc[p.team_id] = acc[p.team_id] || [];
        acc[p.team_id].push(p);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between">
                        <button onClick={() => navigate(`/tournament/${tournamentId}`)} className="text-blue-600 hover:text-blue-800">← Back to Tournament</button>
                        <h1 className="text-2xl font-bold text-gray-800">Auction Summary</h1>
                        <div className="w-32" />
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">Teams Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {teams.map(team => (
                            <div key={team.id} className="border rounded p-4">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold">{team.team_name}</p>
                                    <p className="text-sm font-semibold text-green-700">₹{(team.remaining_budget / 100000).toFixed(2)} L</p>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Remaining Budget</p>
                                <p className="text-sm mt-2">Players Bought: {(byTeam[team.id] || []).length}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">Squads</h2>
                    <div className="space-y-6">
                        {teams.map(team => (
                            <div key={team.id} className="border rounded p-4">
                                <h3 className="font-bold mb-3">{team.team_name} ({(byTeam[team.id] || []).length})</h3>
                                {(byTeam[team.id] || []).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {(byTeam[team.id] || []).map(p => (
                                            <div key={p.id} className="flex items-center justify-between border rounded px-3 py-2">
                                                <div>
                                                    <p className="font-medium">{p.name}</p>
                                                    <p className="text-xs text-gray-600">{p.role}</p>
                                                </div>
                                                <p className="text-sm font-bold text-green-700">₹{(p.purchase_price / 100000).toFixed(2)} L</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No purchases</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">Unsold Players ({unsold.length})</h2>
                    {unsold.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {unsold.map(p => (
                                <div key={p.id} className="flex items-center justify-between border rounded px-3 py-2">
                                    <div>
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-xs text-gray-600">{p.role}</p>
                                    </div>
                                    <p className="text-sm font-semibold">Base ₹{(p.base_price / 100000).toFixed(2)} L</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No unsold players</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuctionSummary;


