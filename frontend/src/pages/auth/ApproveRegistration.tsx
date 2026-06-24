import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function ApproveRegistration() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!email) {
      setStatus('error');
      setMessage('Invalid approval link: email query parameter is missing.');
      return;
    }

    const approve = async () => {
      try {
        const res = await api.approveRegistration(email);
        setStatus('success');
        setMessage(res.message || `User ${email} has been approved successfully.`);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Failed to approve registration.');
      }
    };

    approve();
  }, [email]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-black to-primary/10 z-0"></div>
      
      <div className="w-full max-w-md relative z-10 glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6 text-center">
        {status === 'loading' && (
          <div className="space-y-4 py-6">
            <Loader2 className="w-16 h-16 text-accent animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-white">Approving Registration</h2>
            <p className="text-zinc-400 text-sm">Please wait while we verify and authorize user account...</p>
            {email && <p className="text-zinc-500 text-xs font-mono">{email}</p>}
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="mx-auto bg-emerald-500/10 w-20 h-20 rounded-full border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Registration Approved</h2>
            <p className="text-zinc-300 text-sm leading-relaxed">{message}</p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              A confirmation email has been sent to the user notifying them that they can now log in.
            </p>
            
            <div className="pt-4">
              <Link to="/login" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-accent/25 flex items-center justify-center gap-2">
                Go to Login <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            <div className="mx-auto bg-rose-500/10 w-20 h-20 rounded-full border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Approval Failed</h2>
            <p className="text-rose-400 text-sm font-medium">{message}</p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Please double check the approval URL, or contact the administrator if this problem persists.
            </p>

            <div className="pt-4">
              <Link to="/login" className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2">
                Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
