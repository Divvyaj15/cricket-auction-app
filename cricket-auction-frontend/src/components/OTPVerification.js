import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../services/api';

const OTPVerification = ({ email, onBack }) => {
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const { login } = React.useContext(AuthContext);
    const navigate = useNavigate();

    // Countdown timer for resend button
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await authAPI.verifyOTP(email, otp);

            if (data.error) {
                setError(data.error);
            } else {
                login(data.token, data.user);
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setError('');
        setResendLoading(true);

        try {
            const data = await authAPI.resendOTP(email);

            if (data.error) {
                setError(data.error);
            } else {
                setError('');
                setCountdown(60); // 60 seconds countdown
                alert('OTP sent successfully! Please check your email.');
            }
        } catch (err) {
            setError('Failed to resend OTP. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleOtpChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Only allow digits
        if (value.length <= 6) {
            setOtp(value);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
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
                        'radial-gradient(circle at 50% 20%, rgba(16,185,129,0.25), transparent 50%)'
                }}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-md">
                <Link to="/" className="flex items-center justify-center gap-3 mb-8 group">
                    <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl flex items-center justify-center shadow-lg border border-emerald-500/30">
                        <span className="text-white text-xl">🏏</span>
                    </div>
                    <p className="text-xl font-bold text-white">
                        Cricket <span className="text-amber-400">Auction</span>
                    </p>
                </Link>

                <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md shadow-2xl overflow-hidden">
                    <div className="px-6 sm:px-8 pt-8 pb-2 text-center">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                            Email verification
                        </p>
                        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
                            Check your inbox
                        </h1>
                        <p className="text-sm text-slate-400">
                            We sent a 6-digit code to
                        </p>
                        <p className="text-emerald-400 font-semibold text-sm mt-1 break-all">{email}</p>
                    </div>

                    <div className="px-6 sm:px-8 pb-8 pt-5">
                        {error && (
                            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/50 text-red-200 px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 text-center">
                                    Verification code
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={otp}
                                    onChange={handleOtpChange}
                                    placeholder="000000"
                                    className="w-full px-4 py-3.5 text-center text-2xl font-mono tracking-[0.35em] bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
                                    maxLength={6}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length !== 6}
                                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-900 font-bold rounded-xl shadow-lg shadow-amber-900/20 transition"
                            >
                                {loading ? 'Verifying…' : 'Verify email'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-slate-400 text-sm mb-2">
                                Didn&apos;t get the code?
                            </p>
                            <button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={resendLoading || countdown > 0}
                                className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 disabled:text-slate-500 disabled:cursor-not-allowed transition"
                            >
                                {resendLoading
                                    ? 'Sending…'
                                    : countdown > 0
                                        ? `Resend in ${countdown}s`
                                        : 'Resend code'}
                            </button>
                        </div>

                        {onBack && (
                            <div className="mt-5 text-center">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="text-sm font-medium text-slate-400 hover:text-white transition"
                                >
                                    ← Back
                                </button>
                            </div>
                        )}

                        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 flex items-start gap-2.5">
                            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="text-sm text-slate-300">
                                <p className="font-semibold text-slate-200 mb-0.5">Check spam folder</p>
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    If you don&apos;t see the email, look in spam or junk.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OTPVerification;
