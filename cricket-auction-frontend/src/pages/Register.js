import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import OTPVerification from '../components/OTPVerification';

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showOTPVerification, setShowOTPVerification] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await authAPI.register(
                formData.email,
                formData.password,
                formData.name
            );

            if (data.error) {
                setError(data.error);
            } else {
                // Show OTP verification instead of logging in immediately
                setRegisteredEmail(formData.email);
                setShowOTPVerification(true);
            }
        } catch (err) {
            setError('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToRegistration = () => {
        setShowOTPVerification(false);
        setRegisteredEmail('');
        setError('');
    };

    // Show OTP verification if user has registered
    if (showOTPVerification) {
        return (
            <OTPVerification
                email={registeredEmail}
                onBack={handleBackToRegistration}
            />
        );
    }

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
            {/* Background */}
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('/images/auction-room.jpg')" }}
                aria-hidden="true"
            />
            <div className="absolute inset-0 bg-slate-950/85" aria-hidden="true" />
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 80% 20%, rgba(16,185,129,0.25), transparent 45%), radial-gradient(circle at 20% 80%, rgba(245,158,11,0.15), transparent 40%)'
                }}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-md">
                {/* Brand */}
                <Link to="/" className="flex items-center justify-center gap-3 mb-8 group">
                    <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl flex items-center justify-center shadow-lg border border-emerald-500/30 group-hover:scale-105 transition">
                        <span className="text-white text-xl">🏏</span>
                    </div>
                    <div className="text-left">
                        <p className="text-xl font-bold text-white leading-tight">
                            Cricket <span className="text-amber-400">Auction</span>
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">← Back to home</p>
                    </div>
                </Link>

                {/* Card */}
                <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md shadow-2xl overflow-hidden">
                    <div className="px-6 sm:px-8 pt-7 pb-2">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400 mb-1">
                            Get started free
                        </p>
                        <h1 className="text-2xl font-extrabold text-white tracking-tight">
                            Create your account
                        </h1>
                        <p className="text-sm text-slate-400 mt-1.5">
                            Host auctions or join a league in minutes.
                        </p>
                    </div>

                    <div className="px-6 sm:px-8 pb-8 pt-5">
                        {error && (
                            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/50 text-red-200 px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                                    Full name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    autoComplete="name"
                                    placeholder="Your name"
                                    className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        autoComplete="new-password"
                                        placeholder="Create a password"
                                        className="w-full px-4 py-3 pr-12 bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <p className="mt-1.5 text-[11px] text-slate-500">
                                    You&apos;ll verify this email with a one-time code.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 py-3.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-900 font-bold rounded-xl shadow-lg shadow-amber-900/20 transition"
                            >
                                {loading ? 'Creating account…' : 'Create account'}
                            </button>
                        </form>

                        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                            <p className="text-sm text-slate-400">
                                Already have an account?{' '}
                                <Link
                                    to="/login"
                                    className="font-semibold text-emerald-400 hover:text-emerald-300 transition"
                                >
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[11px] text-slate-500 mt-6">
                    Free to start · Host or join live player auctions
                </p>
            </div>
        </div>
    );
};

export default Register;
