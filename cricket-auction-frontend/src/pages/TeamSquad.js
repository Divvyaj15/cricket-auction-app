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

    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between">
                        <button onClick={() => navigate(-1)} className="text-blue-600 hover:text-blue-800">← Back</button>
                        <h1 className="text-2xl font-bold text-gray-800">{team?.team_name || 'Team'} Squad</h1>
                        <div className="w-32" />
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Team</p>
                            <p className="text-lg font-semibold">{team?.team_name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600">Remaining Budget</p>
                            <p className="text-2xl font-bold text-green-700">₹{((team?.remaining_budget || 0) / 100000).toFixed(2)} L</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold mb-4">Purchased Players ({players.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {players.length > 0 ? players.map((p) => (
                            <div key={p.id} className="border rounded p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-gray-600">{p.role}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Price</p>
                                    <p className="text-lg font-bold text-green-600">₹{((p.purchase_price || 0) / 100000).toFixed(2)} L</p>
                                </div>
                            </div>
                        )) : (
                            <p className="text-gray-500 text-center py-6">No purchases yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamSquad;


