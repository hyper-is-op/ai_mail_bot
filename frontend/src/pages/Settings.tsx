import { useState, useEffect } from 'react';
import { 
  Sliders, 
  ShieldAlert, 
  CheckCircle2, 
  Settings2, 
  Save, 
  Loader2, 
  Check,
  Languages,
  Filter,
  Trash2,
  Plus,
  AlertTriangle,
  Inbox
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

  const [activeTab, setActiveTab] = useState<'engine' | 'moderation' | 'profile'>('engine');
  
  // Keyword Moderation States
  const [policy, setPolicy] = useState<'reply' | 'ignore'>('reply');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [blockedEmails, setBlockedEmails] = useState<any[]>([]);
  const [modLoading, setModLoading] = useState(false);
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Profile States
  const [companyName, setCompanyName] = useState('');
  const [departmentName, setDepartmentName] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const clientId = user?.client_id || '';

  useEffect(() => {
    if (clientId) {
      loadSettings();
      loadModerationData();
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
        setCompanyName(data.company_name || '');
        setDepartmentName(data.department_name || '');
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadModerationData = async () => {
    if (!clientId) return;
    setModLoading(true);
    try {
      const kwRes = await api.getBlockedKeywords(clientId);
      setKeywords(kwRes.keywords || []);
      
      const policyRes = await api.getBlockedPolicy(clientId);
      setPolicy(policyRes.action || 'reply');

      const emailsRes = await api.getBlockedEmails(clientId);
      setBlockedEmails(emailsRes || []);
    } catch (err) {
      console.error("Failed to load moderation settings:", err);
    } finally {
      setModLoading(false);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !clientId) return;
    setKeywordSaving(true);
    try {
      await api.addBlockedKeyword(clientId, newKeyword.trim());
      setNewKeyword('');
      const kwRes = await api.getBlockedKeywords(clientId);
      setKeywords(kwRes.keywords || []);
    } catch (err: any) {
      setError(err.message || 'Failed to add keyword');
    } finally {
      setKeywordSaving(false);
    }
  };

  const handleDeleteKeyword = async (kw: string) => {
    if (!clientId) return;
    try {
      await api.deleteBlockedKeyword(clientId, kw);
      const kwRes = await api.getBlockedKeywords(clientId);
      setKeywords(kwRes.keywords || []);
    } catch (err: any) {
      setError(err.message || 'Failed to delete keyword');
    }
  };

  const handlePolicyChange = async (newAction: 'reply' | 'ignore') => {
    if (!clientId) return;
    try {
      await api.setBlockedPolicy(clientId, newAction);
      setPolicy(newAction);
    } catch (err: any) {
      setError(err.message || 'Failed to update moderation policy');
    }
  };

  const handleUpdateBlockedEmail = async (recordId: number, status: 'ignored' | 'replied') => {
    if (!clientId) return;
    try {
      await api.updateBlockedEmailStatus(clientId, recordId, status);
      const emailsRes = await api.getBlockedEmails(clientId);
      setBlockedEmails(emailsRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to update email status');
    }
  };

  const handleBulkIgnoreBlocked = async () => {
    if (!clientId) return;
    try {
      await api.bulkIgnoreBlockedEmails(clientId);
      const emailsRes = await api.getBlockedEmails(clientId);
      setBlockedEmails(emailsRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk ignore emails');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSuccess(false);
    try {
      await api.updateSelfProfile({
        client_id: clientId,
        company_name: companyName,
        department_name: departmentName
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile details.');
    } finally {
      setSaving(false);
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

      {/* Tab Switcher */}
      <div className="flex border-b border-white/10 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('engine')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'engine'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          AI Engine Controls
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('moderation')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'moderation'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Keyword Moderation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          Company Profile
        </button>
      </div>

      {activeTab === 'engine' && (
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
      )}

      {activeTab === 'moderation' && (
        <div className="space-y-6">
          {modLoading ? (
            <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-zinc-400 font-medium">Loading moderation details...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Policy & Keyword List */}
              <div className="lg:col-span-5 space-y-6">
                {/* Policy Card */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-white">Block Action Policy</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose how the system handles incoming emails that match any of your blocked keywords.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handlePolicyChange('reply')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        policy === 'reply'
                          ? 'border-primary bg-primary/10 text-white'
                          : 'border-white/5 bg-white/5 text-muted-foreground hover:bg-white/10'
                      }`}
                    >
                      <span className="font-bold text-xs block">📋 Review Mode</span>
                      <span className="text-[9px] text-zinc-400 mt-1 block">Hold email for manual reply draft.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePolicyChange('ignore')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        policy === 'ignore'
                          ? 'border-primary bg-primary/10 text-white'
                          : 'border-white/5 bg-white/5 text-muted-foreground hover:bg-white/10'
                      }`}
                    >
                      <span className="font-bold text-xs block">🚫 Discard Mode</span>
                      <span className="text-[9px] text-zinc-400 mt-1 block">Silently ignore and do not reply.</span>
                    </button>
                  </div>
                </div>

                {/* Keywords List Card */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-accent" />
                    <h3 className="font-bold text-white">Blocked Keywords</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Emails containing any of these keywords (whole words) will trigger the moderation policy.
                  </p>

                  <form onSubmit={handleAddKeyword} className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. refund, cancel, payment"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      disabled={keywordSaving}
                      type="submit"
                      className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-primary/90"
                    >
                      Add
                    </button>
                  </form>

                  {keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-2 max-h-48 overflow-y-auto pr-1">
                      {keywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-xs text-zinc-300"
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => handleDeleteKeyword(kw)}
                            className="text-zinc-500 hover:text-rose-400 transition-colors"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-white/10 rounded-xl">
                      No keywords defined. All messages pass.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Blocked Emails Triage Box */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col h-full space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Inbox className="w-5 h-5 text-amber-500" />
                      <div>
                        <h3 className="font-bold text-white">Blocked Emails Log</h3>
                        <p className="text-xs text-muted-foreground">Emails intercepted by the keyword moderation filter</p>
                      </div>
                    </div>
                    {blockedEmails.some((e) => e.status === 'pending_review') && (
                      <button
                        type="button"
                        onClick={handleBulkIgnoreBlocked}
                        className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded text-zinc-400 hover:text-white"
                      >
                        Ignore All Pending
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[450px] space-y-3 pr-1">
                    {blockedEmails.length > 0 ? (
                      blockedEmails.map((email) => (
                        <div key={email.id} className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-mono font-semibold">
                                Matched keyword: {email.matched_keyword}
                              </span>
                              <p className="text-xs font-semibold text-white mt-1.5">{email.from_email}</p>
                              <p className="text-xs text-zinc-300 font-medium">Subject: {email.subject}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              email.status === 'pending_review'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : email.status === 'ignored'
                                ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {email.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground bg-black/25 p-2.5 rounded-lg font-mono line-clamp-3 whitespace-pre-wrap">
                            {email.body}
                          </p>
                          {email.status === 'pending_review' && (
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateBlockedEmail(email.id, 'ignored')}
                                className="text-[10px] bg-zinc-500/15 hover:bg-zinc-500/25 text-zinc-400 px-2.5 py-1 rounded"
                              >
                                Ignore
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateBlockedEmail(email.id, 'replied')}
                                className="text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 px-2.5 py-1 rounded font-semibold"
                              >
                                Mark as Replied
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-xl text-muted-foreground">
                        <Inbox className="w-10 h-10 mb-2 opacity-25" />
                        <p className="text-xs">No emails blocked by keywords yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Settings2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-white">Company Profile Settings</h3>
                <p className="text-xs text-muted-foreground">Specify details used by the AI agent to tailor response contexts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. C-Zentrix"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Department Name</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Support"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

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
                  Updating Profile...
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4 text-white font-bold" />
                  Profile Details Updated!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Profile Details
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
