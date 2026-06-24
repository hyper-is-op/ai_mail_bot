import { useState, useEffect } from 'react';
import { 
  Sliders, 
  ShieldAlert, 
  CheckCircle2, 
  Settings2, 
  Save, 
  Loader2, 
  Check,
  Languages
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Settings() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [tone, setTone] = useState('Formal');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const clientId = user?.client_id || '';

  useEffect(() => {
    if (clientId) {
      loadSettings();
    }
  }, [clientId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getEmailAccount(clientId);
      if (data) {
        setEmail(data.email || '');
        setPassword(data.password || '');
        setThreshold(data.score_threshold !== undefined ? data.score_threshold : 80);
        setTone(data.response_tone || 'Formal');
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSuccess(false);

    try {
      await api.acceptEmail({
        client_id: clientId,
        email: email || 'pending@c-zentrix.com', // fallback if they haven't configured Accounts page yet
        password: password || 'temporary_placeholder_pass',
        score_threshold: threshold,
        response_tone: tone
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save system configurations.');
    } finally {
      setSaving(false);
    }
  };

  // Helper text describing rigor mode based on the current threshold
  const getThresholdDescription = (val: number) => {
    if (val >= 85) {
      return {
        label: 'Strict Security Mode',
        color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
        text: 'Only absolute high-fidelity AI responses (>= 85% score) will auto-send. Recommended for critical support pipelines to minimize validation risks.'
      };
    } else if (val >= 70) {
      return {
        label: 'Balanced Autonomy Mode',
        color: 'text-primary border-primary/20 bg-primary/5',
        text: 'A professional standard balance. Well-reasoned drafts (>= 70%) are instantly sent, while borderline or complex complaints are safely triaged as CRM tickets.'
      };
    } else {
      return {
        label: 'Aggressive Auto-Response Mode',
        color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
        text: 'Agile auto-reply mode. Auto-sends replies on moderate validation (>= 30%). Great for high volume, simple FAQ catalogs, but increases risk of slight context misalignment.'
      };
    }
  };

  const rigor = getThresholdDescription(threshold);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium">Fetching client configuration credentials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <Settings2 className="w-8 h-8 text-primary" />
          Control Center & Settings
        </h2>
        <p className="text-muted-foreground mt-1">Configure your dynamic AI validation thresholds, tone models, and response personas.</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: AI Agent Score Threshold Settings */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Sliders className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">AI Confidence Validation</h3>
                  <p className="text-xs text-zinc-400">Set the validation threshold score for auto-sending replies.</p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Confidence Threshold Score</span>
                  <span className="text-3xl font-black text-primary font-mono">{threshold}%</span>
                </div>

                <input
                  type="range"
                  min={30}
                  max={95}
                  step={5}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 accent-primary rounded-lg appearance-none cursor-pointer my-4 focus:outline-none focus:ring-1 focus:ring-primary"
                />

                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                  <span>Lenient (30%)</span>
                  <span>Balanced (70%)</span>
                  <span>Strict (95%)</span>
                </div>
              </div>
            </div>

            {/* Dynamic Rigor Status Card */}
            <div className={`border rounded-xl p-4 transition-all duration-300 ${rigor.color} mt-4`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">{rigor.label}</span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">{rigor.text}</p>
            </div>
          </div>

          {/* Card 2: Tone & Persona Switcher */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
                  <Languages className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">Tone & Response Persona</h3>
                  <p className="text-xs text-zinc-400">Dynamically adjust agent prompts to match your brand tone profile.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {[
                  { id: 'Formal', label: '💼 Formal', desc: 'Polite, structured, standard business response style.' },
                  { id: 'Friendly', label: '🤝 Friendly', desc: 'Warm, empathetic, approachable conversational style.' },
                  { id: 'Concise', label: '⚡ Concise', desc: 'Straight to the point, short, and highly optimized answers.' },
                  { id: 'Technical', label: '🛠️ Technical', desc: 'Deep details, highlighting parameters, schemas, and traces.' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTone(item.id)}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-200 ${
                      tone === item.id
                        ? 'border-accent bg-accent/10 dark:bg-accent/20 text-accent-foreground dark:text-white'
                        : 'border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                    }`}
                  >
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">{item.label}</span>
                    <span className={`text-[10px] mt-1 leading-relaxed ${
                      tone === item.id
                        ? 'text-accent dark:text-zinc-300'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}>{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Trigger Panel */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className={`w-full relative overflow-hidden flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg
              ${success 
                ? 'bg-emerald-500 text-white shadow-emerald-500/10' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deploying Configurations...
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4 text-white font-bold" />
                System Settings Live!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save System Configurations
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
