import { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, UserCircle2, Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.register({ email, password, role });
      if (res.success) {
        setRegistered(true);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Visuals */}
      <div className="hidden lg:flex flex-1 relative bg-black overflow-hidden border-r border-white/10 items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-black to-primary/20 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay z-0"></div>

        <div className="relative z-10 max-w-lg glass-panel p-8 rounded-2xl border border-white/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">Join the Future of Support</h2>
          <p className="text-white/70 mb-6">
            Register as an Admin or Client to get access to automated AI responses, robust analytics, and enterprise ticket management.
          </p>
        </div>
      </div>

      {/* Right side - Register Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32 relative z-10">
        <div className="w-full max-w-sm mx-auto space-y-8">
          {registered ? (
            <div className="text-center space-y-6">
              <div className="mx-auto bg-emerald-500/10 w-16 h-16 rounded-full border border-emerald-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Registration Pending</h1>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  Your account has been created and is pending admin approval. A confirmation request has been sent to the administrator.
                </p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Once approved, a confirmation email will be sent to <span className="text-white font-medium">{email}</span> and you can log in.
                </p>
              </div>
              <Link to="/login" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-accent/25 flex items-center justify-center gap-2 mt-6">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <div className="bg-accent/20 w-12 h-12 rounded-xl border border-accent/30 flex items-center justify-center mb-6">
                  <UserCircle2 className="w-6 h-6 text-accent" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
                <p className="text-muted-foreground mt-2 text-sm">Register to start using Mail AI.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
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
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                      placeholder="Min 8 characters"
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button disabled={loading} type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg py-2.5 text-sm font-medium transition-all shadow-lg shadow-accent/25 flex items-center justify-center gap-2 mt-6">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Register Account <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-4">
                Already have an account? <Link to="/login" className="text-accent hover:underline font-medium">Sign in here</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
