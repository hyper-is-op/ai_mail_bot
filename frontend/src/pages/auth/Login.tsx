import { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Send OTP, 2 = Enter OTP & Set Password
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login({ email, password });
      if (res.success) {
        localStorage.setItem('user', JSON.stringify({ ...res.user, token: res.token }));
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await api.forgotPasswordSendOtp(email);
      if (res.success) {
        setSuccessMessage(res.message || 'A verification code has been sent.');
        setForgotStep(2);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await api.forgotPasswordReset({
        email,
        otp,
        new_password: newPassword
      });
      if (res.success) {
        setSuccessMessage(res.message || 'Password reset successful!');
        setTimeout(() => {
          setIsForgotMode(false);
          setForgotStep(1);
          setOtp('');
          setNewPassword('');
          setSuccessMessage('');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32 relative z-10">
        <div className="w-full max-w-sm mx-auto space-y-8">
          <div>
            <div className="flex items-center mb-6">
              <img src="https://stg.c-zentrix.com/images/C-Zentrix-logo-white.png" alt="C-Zentrix Logo" className="h-10 object-contain dark:invert-0 invert" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isForgotMode ? 'Reset password' : 'Welcome back'}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {isForgotMode
                ? (forgotStep === 1 ? 'Enter your email address to receive a verification code.' : 'Enter the code and set your new password.')
                : 'Sign in to your Mail AI Automation dashboard.'}
            </p>
          </div>

          {isForgotMode ? (
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 text-sm rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {successMessage}
                </div>
              )}

              {forgotStep === 1 ? (
                <form onSubmit={handleSendOtpSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="admin@mailai.com"
                      />
                    </div>
                  </div>

                  <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-6">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send Verification Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Verification Code (OTP)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-center tracking-widest text-lg"
                      placeholder="000000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 dark:hover:text-white transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-6">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Reset Password <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(false);
                  setForgotStep(1);
                  setError('');
                  setSuccessMessage('');
                }}
                className="w-full bg-transparent hover:bg-white/5 text-muted-foreground hover:text-white rounded-lg py-2 text-xs transition-all flex items-center justify-center gap-1.5 mt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="admin@mailai.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setForgotStep(1);
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account? <Link to="/register" className="text-primary hover:underline font-medium">Register here</Link>
          </p> */}
        </div>
      </div>

      {/* Right side - Visuals */}
      <div className="hidden lg:flex flex-1 relative bg-black overflow-hidden border-l border-white/10 items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-black to-accent/20 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-0"></div>

        <div className="relative z-10 max-w-lg glass-panel p-8 rounded-2xl border border-white/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">Intelligent Mail Automation</h2>
          <p className="text-white/70 mb-6 line-clamp-3">
            Scale your customer support with fine-tuned LLMs. Automatically categorize, reply, and track tickets with unparalleled accuracy.
          </p>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-bold text-white">99.8%</span>
              <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">Uptime</span>
            </div>
            <div className="w-px bg-white/20"></div>
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-bold text-white">10x</span>
              <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">Faster Replies</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
