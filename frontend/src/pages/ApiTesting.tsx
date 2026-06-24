import { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader2, Activity } from 'lucide-react';
import { api } from '@/lib/api';

export default function ApiTesting() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await api.health();
      setHealthStatus(res);
    } catch (err: any) {
      setHealthStatus({ status: 'Error', details: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">API Testing & Health</h2>
          <p className="text-muted-foreground mt-1">Test your connected services and API endpoints.</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> System Health Check
          </h3>
          <button onClick={checkHealth} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> Run Check</>}
          </button>
        </div>

        {healthStatus && (
          <div className={`p-4 rounded-xl border flex items-start gap-4 ${healthStatus.status === 'mail_ai_automation running' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
            {healthStatus.status === 'mail_ai_automation running' ? <CheckCircle className="w-6 h-6 mt-1" /> : <XCircle className="w-6 h-6 mt-1" />}
            <div>
              <p className="font-bold text-lg mb-1">{healthStatus.status === 'mail_ai_automation running' ? 'All Systems Operational' : 'Connection Failed'}</p>
              <pre className="text-xs opacity-80 font-mono mt-2 bg-black/20 p-3 rounded-lg overflow-x-auto w-full max-w-2xl">
                {JSON.stringify(healthStatus, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Available Endpoints Documented</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { method: 'GET', path: '/' },
              { method: 'POST', path: '/process-email' },
              { method: 'POST', path: '/accept-email' },
              { method: 'GET', path: '/email-account/{user_id}' },
              { method: 'POST', path: '/create-ticket' },
              { method: 'POST', path: '/order-status' },
              { method: 'POST', path: '/insert-create_payload_ticket' },
              { method: 'POST', path: '/insert-payload_get_ticket' },
            ].map((ep, i) => (
              <div key={i} className="bg-black/10 dark:bg-white/5 border border-white/10 rounded-lg p-3 flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-1 rounded bg-black/20 ${ep.method === 'GET' ? 'text-blue-400' : 'text-green-400'}`}>
                  {ep.method}
                </span>
                <span className="font-mono text-sm">{ep.path}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
