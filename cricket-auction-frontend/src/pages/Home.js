import React, { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const features = [
    {
        icon: '🏆',
        title: 'Host Tournaments',
        description:
            'Create tournaments with custom budgets, team limits, and unique join codes for your league or friend circle.',
    },
    {
        icon: '🔨',
        title: 'Live Real-time Auctions',
        description:
            'Bid live with real-time updates, countdown timers, bid history, and automatic finalization when the hammer falls.',
    },
    {
        icon: '👥',
        title: 'Team & Squad Management',
        description:
            'Form teams, track budgets, manage roles, and build your squad player by player as the auction unfolds.',
    },
    {
        icon: '📋',
        title: 'Player Pool & Bulk Import',
        description:
            'Add players one by one or upload a CSV. Organize by role — batsman, bowler, all-rounder, and wicket-keeper.',
    },
    {
        icon: '📊',
        title: 'Auction History & Reports',
        description:
            'Review full auction history, team spending, and tournament summaries after every session.',
    },
    {
        icon: '🔐',
        title: 'Secure Accounts',
        description:
            'JWT authentication and OTP email verification keep your tournaments and team data protected.',
    },
];

const steps = [
    {
        step: '01',
        title: 'Create your account',
        description: 'Register with email verification and sign in securely.',
        icon: '📝',
    },
    {
        step: '02',
        title: 'Host or join a tournament',
        description: 'Spin up a new auction or join with a tournament code.',
        icon: '🏟️',
    },
    {
        step: '03',
        title: 'Build your squad live',
        description: 'Bid in real time, manage budget, and assemble a winning team.',
        icon: '🏏',
    },
];

const soldPlayers = [
    { name: 'V. Sharma', role: 'BAT', team: 'Royal Strikers', price: '₹2.4 Cr', color: 'bg-blue-500' },
    { name: 'R. Khan', role: 'BOWL', team: 'City Kings', price: '₹1.8 Cr', color: 'bg-amber-500' },
    { name: 'A. Patel', role: 'AR', team: 'Thunder XI', price: '₹3.1 Cr', color: 'bg-emerald-500' },
    { name: 'S. Das', role: 'WK', team: 'Falcon CC', price: '₹95 L', color: 'bg-rose-500' },
];

const teamBudgets = [
    { name: 'Royal Strikers', spent: 62, left: '₹3.8 Cr', color: 'bg-blue-500' },
    { name: 'City Kings', spent: 48, left: '₹5.2 Cr', color: 'bg-amber-500' },
    { name: 'Thunder XI', spent: 71, left: '₹2.9 Cr', color: 'bg-emerald-500' },
    { name: 'Falcon CC', spent: 35, left: '₹6.5 Cr', color: 'bg-rose-500' },
];

/** Decorative cricket-pitch stripe background */
const PitchPattern = ({ className = '' }) => (
    <div
        className={`pointer-events-none absolute inset-0 opacity-[0.07] ${className}`}
        style={{
            backgroundImage: `
                repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 48px,
                    rgba(255,255,255,0.4) 48px,
                    rgba(255,255,255,0.4) 50px
                )
            `,
        }}
    />
);

/** Live auction room mockup — player on block + bid board */
const AuctionRoomVisual = () => (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0">
        {/* Glow */}
        <div className="absolute -inset-3 bg-gradient-to-br from-amber-400/30 via-emerald-500/20 to-transparent rounded-3xl blur-2xl" />

        <div className="relative rounded-2xl overflow-hidden border border-emerald-700/50 shadow-2xl shadow-black/40 bg-slate-950">
            {/* Top bar — LIVE auction */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <span className="text-xs font-bold tracking-widest text-red-400 uppercase">Live Auction</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                        ⏱ 00:14
                    </span>
                    <span>Round 12</span>
                </div>
            </div>

            {/* Player on the block */}
            <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-emerald-950/80 to-slate-950">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-emerald-400/80 uppercase mb-3 text-center">
                    Player on the block
                </p>
                <div className="flex items-center gap-4">
                    {/* Avatar / jersey */}
                    <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex flex-col items-center justify-center border-2 border-amber-400/60 shadow-lg">
                            <span className="text-3xl">🏏</span>
                            <span className="text-[10px] font-bold text-white/90 mt-0.5">#47</span>
                        </div>
                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded uppercase tracking-wide">
                            BAT
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold text-white truncate">Arjun Mehta</h3>
                        <p className="text-sm text-emerald-300/80">Right-hand batsman · Age 24</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                                Base ₹20 L
                            </span>
                            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                                Avg 42.5
                            </span>
                            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                                SR 138
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Current bid podium */}
            <div className="mx-4 mb-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border border-amber-500/30 p-4">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-semibold tracking-widest text-amber-400/90 uppercase mb-1">
                            Current bid
                        </p>
                        <p className="text-3xl sm:text-4xl font-extrabold text-amber-300 tracking-tight">
                            ₹1.85<span className="text-lg font-semibold text-amber-400/80"> Cr</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                            Leading:{' '}
                            <span className="text-white font-semibold">City Kings</span>
                        </p>
                    </div>
                    <div className="text-right space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            <span>↑</span> +₹5 L
                        </div>
                        <p className="text-[10px] text-slate-500">Min next bid</p>
                    </div>
                </div>
            </div>

            {/* Teams bidding strip */}
            <div className="px-4 pb-4 grid grid-cols-4 gap-2">
                {[
                    { name: 'RS', active: false },
                    { name: 'CK', active: true },
                    { name: 'TX', active: false },
                    { name: 'FC', active: false },
                ].map((t) => (
                    <div
                        key={t.name}
                        className={`rounded-lg py-2 text-center text-xs font-bold border ${
                            t.active
                                ? 'bg-amber-400 text-slate-900 border-amber-300 shadow-md shadow-amber-400/20'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                    >
                        {t.name}
                        {t.active && <div className="text-[9px] font-semibold mt-0.5">BIDDING</div>}
                    </div>
                ))}
            </div>

            {/* Fake bid buttons */}
            <div className="px-4 pb-5 flex gap-2">
                <div className="flex-1 rounded-lg bg-emerald-600 text-white text-center text-sm font-bold py-2.5 shadow-lg shadow-emerald-900/40">
                    Place bid
                </div>
                <div className="rounded-lg bg-slate-800 text-slate-300 text-center text-sm font-semibold py-2.5 px-4 border border-slate-700">
                    Pass
                </div>
            </div>
        </div>

        {/* Floating gavel badge */}
        <div className="absolute -right-2 -bottom-3 sm:-right-4 sm:-bottom-4 bg-slate-900 border border-amber-500/40 text-amber-300 rounded-xl px-3 py-2 shadow-xl flex items-center gap-2 text-sm font-semibold">
            <span className="text-lg">🔨</span>
            Going once…
        </div>
    </div>
);

/** Sold players auction table */
const AuctionTableVisual = () => (
    <div className="rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h3 className="text-sm font-bold text-white tracking-wide">Auction board</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                4 sold · 18 remaining
            </span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                        <th className="px-4 py-2.5 font-semibold">Player</th>
                        <th className="px-3 py-2.5 font-semibold">Role</th>
                        <th className="px-3 py-2.5 font-semibold">Sold to</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Price</th>
                    </tr>
                </thead>
                <tbody>
                    {soldPlayers.map((p, i) => (
                        <tr
                            key={p.name}
                            className={`border-b border-slate-800/80 ${
                                i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'
                            }`}
                        >
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className={`w-7 h-7 rounded-lg ${p.color} flex items-center justify-center text-[10px] font-bold text-white`}
                                    >
                                        {p.name.charAt(0)}
                                    </div>
                                    <span className="font-medium text-slate-100">{p.name}</span>
                                </div>
                            </td>
                            <td className="px-3 py-3">
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                                    {p.role}
                                </span>
                            </td>
                            <td className="px-3 py-3 text-slate-300">{p.team}</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-300">{p.price}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Last sold · Falcon CC</span>
            <span className="text-emerald-400 font-semibold">Purse updated ✓</span>
        </div>
    </div>
);

/** Team purse / budget panel */
const BudgetPanelVisual = () => (
    <div className="rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-xl h-full">
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-950 border-b border-slate-800">
            <span className="text-lg">💰</span>
            <h3 className="text-sm font-bold text-white tracking-wide">Team purses</h3>
        </div>
        <div className="p-4 space-y-4">
            {teamBudgets.map((t) => (
                <div key={t.name}>
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                            <span className="text-sm font-medium text-slate-200">{t.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-amber-300/90">{t.left} left</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${t.color} opacity-90`}
                            style={{ width: `${t.spent}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{t.spent}% purse used</p>
                </div>
            ))}
        </div>
    </div>
);

const Home = () => {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-center">
                    <div className="text-5xl mb-3">🏏</div>
                    <p className="text-lg font-medium text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Navbar */}
            <nav className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800/80">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl flex items-center justify-center shadow-md border border-emerald-500/30">
                                <span className="text-white text-xl">🏏</span>
                            </div>
                            <span className="text-xl font-bold text-white">
                                Cricket <span className="text-amber-400">Auction</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                to="/login"
                                className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
                            >
                                Log in
                            </Link>
                            <Link
                                to="/register"
                                className="px-4 py-2 text-sm font-semibold text-slate-950 bg-amber-400 rounded-lg shadow hover:bg-amber-300 transition"
                            >
                                Get started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero — stadium green + auction visual */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-950" />
                <PitchPattern />
                {/* Pitch oval glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] rounded-[100%] bg-emerald-600/10 blur-3xl" />
                <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />

                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        <div>
                            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-full mb-6">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                </span>
                                Live cricket player auctions
                            </p>
                            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.1] tracking-tight mb-6 text-white">
                                Your own auction table.{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                                    Real-time bids.
                                </span>
                            </h1>
                            <p className="text-lg text-slate-300 mb-8 max-w-xl leading-relaxed">
                                Host IPL-style player auctions for your tournament. Teams bid live
                                from the board, budgets update instantly, and every sale is logged —
                                just like the big leagues.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Link
                                    to="/register"
                                    className="inline-flex justify-center items-center px-8 py-3.5 text-base font-bold rounded-xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-900/30 hover:bg-amber-300 transition"
                                >
                                    Open the auction room
                                </Link>
                                <Link
                                    to="/login"
                                    className="inline-flex justify-center items-center px-8 py-3.5 text-base font-semibold rounded-xl border border-slate-600 text-white hover:bg-slate-800/80 transition"
                                >
                                    Sign in
                                </Link>
                            </div>
                            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-400">
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-400">🔨</span> Live bid board
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-400">💰</span> Purse tracking
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sky-400">📋</span> Sold list & history
                                </div>
                            </div>
                        </div>

                        <AuctionRoomVisual />
                    </div>
                </div>
            </section>

            {/* Auction table + purses showcase */}
            <section className="relative py-16 sm:py-20 border-t border-slate-800/80">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber-400 mb-3">
                            Inside the room
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            Auction table, purse, and sold board
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Everything an auctioneer and franchise needs on one screen — current
                            player, team budgets, and who went for how much.
                        </p>
                    </div>
                    <div className="grid lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3">
                            <AuctionTableVisual />
                        </div>
                        <div className="lg:col-span-2">
                            <BudgetPanelVisual />
                        </div>
                    </div>
                </div>
            </section>

            {/* Mini process strip — cricket icons */}
            <section className="border-y border-slate-800 bg-slate-900/50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    {[
                        { icon: '🏟️', label: 'Create tournament', sub: 'Set budget & teams' },
                        { icon: '👕', label: 'Fill the pool', sub: 'Players & base prices' },
                        { icon: '🔨', label: 'Go live', sub: 'Bid against the clock' },
                        { icon: '📜', label: 'Lock squads', sub: 'History & summary' },
                    ].map((item) => (
                        <div key={item.label}>
                            <div className="text-3xl mb-2">{item.icon}</div>
                            <p className="text-sm font-bold text-white">{item.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-20 sm:py-24">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            Built for the full auction night
                        </h2>
                        <p className="text-lg text-slate-400">
                            From tournament setup to the final hammer fall — one place for hosts and
                            team owners.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-emerald-700/50 hover:bg-slate-900 transition"
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-2xl mb-4">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950" />
                <PitchPattern />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                            How it works
                        </h2>
                        <p className="text-lg text-slate-400">
                            Three simple steps from sign-up to a live auction room.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {steps.map((item) => (
                            <div
                                key={item.step}
                                className="relative bg-slate-900/80 rounded-2xl p-8 border border-slate-800"
                            >
                                <span className="text-5xl font-extrabold text-slate-800 absolute top-4 right-6">
                                    {item.step}
                                </span>
                                <div className="text-3xl mb-4">{item.icon}</div>
                                <h3 className="text-xl font-semibold text-white mb-3 relative">
                                    {item.title}
                                </h3>
                                <p className="text-slate-400 relative leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA — auction desk style */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative rounded-3xl overflow-hidden border border-emerald-800/50 shadow-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950" />
                        <PitchPattern />
                        <div className="relative px-8 py-14 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-3xl mb-6">
                                🔨
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                                Ready to open the floor?
                            </h2>
                            <p className="text-slate-300 text-lg mb-8 max-w-xl mx-auto">
                                Set up a tournament in minutes, share the code with franchises, and
                                start the auction with a live bid board.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    to="/register"
                                    className="inline-flex justify-center px-8 py-3.5 font-bold rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition"
                                >
                                    Get started free
                                </Link>
                                <Link
                                    to="/login"
                                    className="inline-flex justify-center px-8 py-3.5 font-semibold rounded-xl border border-slate-600 text-white hover:bg-slate-800/80 transition"
                                >
                                    I already have an account
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8 bg-slate-950">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🏏</span>
                        <span className="font-semibold text-slate-300">
                            Cricket <span className="text-amber-400">Auction</span>
                        </span>
                    </div>
                    <p>Host live player auctions for your cricket tournaments.</p>
                    <div className="flex gap-4">
                        <Link to="/login" className="hover:text-amber-400 transition">
                            Login
                        </Link>
                        <Link to="/register" className="hover:text-amber-400 transition">
                            Register
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
