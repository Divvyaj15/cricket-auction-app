import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamAPI, playerAPI, auctionAPI } from '../services/api';

// Aggregates sold and unsold players for a tournament with purchase details
const AuctionHistory = () => {
    const { tournamentId } = useParams();
    const navigate = useNavigate();

    const [sold, setSold] = useState([]);
    const [unsold, setUnsold] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [allTeams, allPlayers] = await Promise.all([
                    teamAPI.getTeamsByTournament(tournamentId),
                    playerAPI.getByTournament(tournamentId)
                ]);
                setTeams(allTeams || []);

                // Get sold players with purchase details
                const soldPlayers = [];
                const unsoldPlayers = (allPlayers || []).filter(p => p.status === 'unsold');
                
                // For each team, get their purchases to build complete sold players list
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
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading auction history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <nav className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="h-16 flex items-center justify-between">
                        <button 
                            onClick={() => navigate(`/tournament/${tournamentId}`)} 
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Tournament
                        </button>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Auction History
                        </h1>
                        <div className="w-32" />
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-3 bg-green-100 rounded-full">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Sold Players</p>
                                <p className="text-2xl font-bold text-gray-900">{sold.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-3 bg-orange-100 rounded-full">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Unsold Players</p>
                                <p className="text-2xl font-bold text-gray-900">{unsold.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-3 bg-blue-100 rounded-full">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Players</p>
                                <p className="text-2xl font-bold text-gray-900">{sold.length + unsold.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sold Players */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            Sold Players ({sold.length})
                        </h2>
                    </div>
                    {sold.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sold.map((player) => (
                                <div key={player.id} className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800 text-lg">{player.name}</h3>
                                            <p className="text-sm text-gray-600 capitalize">{player.role}</p>
                                        </div>
                                        <div className="ml-3">
                                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                                                SOLD
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Team:</span>
                                            <span className="font-semibold text-gray-800">{player.team_name || 'Unknown Team'}</span>
                                        </div>
                                        {player.base_price && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Base Price:</span>
                                                <span className="text-sm text-gray-500">₹{((player.base_price || 0) / 100000).toFixed(2)} L</span>
                                            </div>
                                        )}
                                        {player.purchase_price && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Sold For:</span>
                                                <span className="text-lg font-bold text-green-600">₹{((player.purchase_price || 0) / 100000).toFixed(2)} L</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-lg">No players sold yet</p>
                        </div>
                    )}
                </div>

                {/* Unsold Players */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            Unsold Players ({unsold.length})
                        </h2>
                    </div>
                    {unsold.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {unsold.map((player) => (
                                <div key={player.id} className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800 text-lg">{player.name}</h3>
                                            <p className="text-sm text-gray-600 capitalize">{player.role}</p>
                                        </div>
                                        <div className="ml-3">
                                            <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-semibold">
                                                UNSOLD
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">Base Price:</span>
                                            <span className="text-lg font-bold text-orange-600">₹{((player.base_price || 0) / 100000).toFixed(2)} L</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-lg">All players sold!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuctionHistory;