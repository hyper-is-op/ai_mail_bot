import { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  };

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
    <div className="min-h-screen w-full flex bg-background text-foreground relative">
      {/* Absolute Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-50 p-2.5 rounded-full bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-sm transition-all cursor-pointer"
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Left side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32 relative z-10">
        <div className="w-full max-w-sm mx-auto space-y-8">
          <div>
            <div className="flex items-center mb-6">
              <img src="https://stg.c-zentrix.com/images/C-Zentrix-logo-white.png" alt="C-Zentrix Logo" className="h-10 object-contain dark:invert-0 invert" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
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
                    <label className="text-sm font-medium text-foreground">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                        placeholder="admin@mailai.com"
                      />
                    </div>
                  </div>

                  <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-6 cursor-pointer">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send Verification Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Verification Code (OTP)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-center tracking-widest text-lg text-foreground"
                      placeholder="000000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-6 cursor-pointer">
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
                className="w-full bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-lg py-2 text-xs transition-all flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
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
                <label className="text-sm font-medium text-foreground">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                    placeholder="admin@mailai.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setForgotStep(1);
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-primary hover:underline bg-transparent border-none p-0 cursor-pointer font-medium"
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
                    className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-6 cursor-pointer">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Right side - Visuals */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-blue-50/80 via-slate-100 to-indigo-50/50 dark:from-zinc-950 dark:via-black dark:to-zinc-900 overflow-hidden border-l border-zinc-200 dark:border-white/10 items-center justify-center p-12">
        {/* Subtle Background Glow Elements */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-accent/10 dark:bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 dark:opacity-15 mix-blend-overlay pointer-events-none"></div>

        <div className="relative z-10 max-w-lg bg-white/90 dark:bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-zinc-200/80 dark:border-white/15 shadow-xl dark:shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Autonomous AI Agents</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">Intelligent Mail Automation</h2>
          <p className="text-zinc-600 dark:text-zinc-300 text-sm mb-6 leading-relaxed">
            Scale your customer support with fine-tuned LLMs. Automatically categorize, reply, and track tickets with enterprise-grade accuracy.
          </p>
          <div className="flex items-center gap-6 pt-4 border-t border-zinc-200 dark:border-white/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">Automation</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Integrated</span>
            </div>
            <div className="w-px h-8 bg-zinc-200 dark:bg-white/10"></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">10x</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Faster Resolution</span>
            </div>
            <div className="w-px h-8 bg-zinc-200 dark:bg-white/10"></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">24/7</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Autonomous</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
