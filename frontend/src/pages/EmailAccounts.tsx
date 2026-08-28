import { useState, useEffect } from 'react';
import { 
  Mail, CheckCircle, XCircle, Loader2, Info, 
  Eye, EyeOff, RefreshCw, KeyRound, 
  Search, ChevronDown, Check
} from 'lucide-react';
import { api } from '@/lib/api';

export default function EmailAccounts() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Per-client editing state for expandable cards
  const [editState, setEditState] = useState<Record<string, {
    email: string;
    password: string;
    saving?: boolean;
  }>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      if (isAdmin) {
        const res = await api.getAllEmailAccounts();
        const list = Array.isArray(res) ? res : [];
        setAllAccounts(list);
      } else if (user?.client_id) {
        try {
          const res = await api.getEmailAccount(user.client_id);
          if (res) {
            setAllAccounts([res]);
          }
        } catch {
          // If not configured yet, create placeholder
          setAllAccounts([{ client_id: user.client_id, email: '', password: '' }]);
        }
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to load mailbox configurations' });
    } finally {
      setFetchLoading(false);
    }
  };

  const toggleExpand = (clientId: string) => {
    if (expanded === clientId) {
      setExpanded(null);
      return;
    }
    setExpanded(clientId);
    if (!editState[clientId]) {
      const acc = allAccounts.find((a) => a.client_id === clientId) || {};
      setEditState((prev) => ({
        ...prev,
        [clientId]: {
          email: acc.email || '',
          password: acc.password || '',
        },
      }));
    }
  };

  const handleSaveConnection = async (clientId: string) => {
    const s = editState[clientId];
    if (!s || !s.email.trim() || !s.password.trim()) {
      setMsg({ type: 'error', text: 'Please provide both IMAP Email address and App Password.' });
      return;
    }

    setEditState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], saving: true } }));
    setMsg(null);
    try {
      await api.acceptEmail({
        client_id: clientId,
        email: s.email.trim(),
        password: s.password.trim(),
      });
      setMsg({ type: 'success', text: `Mailbox connection saved & verified for ${clientId}!` });
      await fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save mailbox connection' });
    } finally {
      setEditState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], saving: false } }));
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getInitials = (name?: string, id?: string) => {
    const target = name || id || 'MB';
    const parts = target.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return target.slice(0, 2).toUpperCase();
  };

  const filteredAccounts = allAccounts.filter((acc) => {
    const query = searchQuery.toLowerCase();
    return (
      (acc.client_id || '').toLowerCase().includes(query) ||
      (acc.company_name || '').toLowerCase().includes(query) ||
      (acc.name || '').toLowerCase().includes(query) ||
      (acc.email || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Mail className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Mailbox Accounts & Processing
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Configure and connect incoming IMAP/Gmail mailboxes monitored and automated by the AI daemon.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Notification Alert */}
      {msg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
          msg.type === 'error' 
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' 
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {msg.type === 'error' ? <XCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-xs opacity-70 hover:opacity-100 font-bold cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-foreground">How Incoming Mailbox Processing Operates</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The AI background daemon reads incoming messages from each client's linked IMAP/Gmail mailbox in real-time. Inquiries are parsed, scored against the knowledge base, and automatically replied to or escalated into helpdesk tickets based on your policy settings.
          </p>
        </div>
      </div>

      {/* Main Mailbox Directory & Expandable Management */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-zinc-100 dark:border-white/5">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {isAdmin ? `Registered Client Mailboxes (${allAccounts.length})` : 'Connected Mailbox'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? 'Click on any client card to configure or update their IMAP mailbox credentials.' : 'Manage your IMAP support mailbox credentials.'}
            </p>
          </div>

          {/* Search Filter (Admin) */}
          {isAdmin && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by Client ID, email, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {fetchLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs">
            No client mailboxes found matching your search.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((acc) => {
              const isExp = expanded === acc.client_id;
              const hasConfig = Boolean(acc.email && acc.email.trim());
              const s = editState[acc.client_id] || {
                email: acc.email || '',
                password: acc.password || '',
              };

              return (
                <div
                  key={acc.client_id}
                  className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                    isExp
                      ? 'border-primary/40 bg-zinc-50/50 dark:bg-white/[0.02] shadow-md ring-1 ring-primary/20'
                      : 'border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:border-zinc-300 dark:hover:border-white/20'
                  }`}
                >
                  {/* Mailbox Header Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-sm ring-1 ring-white/20 shrink-0">
                        {getInitials(acc.name || acc.company_name, acc.client_id)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-primary">{acc.client_id}</span>
                          {acc.company_name && (
                            <span className="text-xs font-bold text-foreground">
                              · {acc.company_name}
                            </span>
                          )}
                          {acc.name && (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              ({acc.name})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span>{acc.email || 'No IMAP mailbox connected'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-auto">
                      {/* Connection Status Badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                        hasConfig
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${hasConfig ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                        {hasConfig ? 'CONNECTED' : 'NOT CONFIGURED'}
                      </span>

                      {/* Dropdown Expand Toggle Button */}
                      <button
                        onClick={() => toggleExpand(acc.client_id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                          isExp
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-foreground border-zinc-200 dark:border-white/10'
                        }`}
                      >
                        <span>{isExp ? 'Close' : 'Configure Mailbox'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Dropdown Edit Panel for this Client */}
                  {isExp && (
                    <div className="p-5 border-t border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-black/20 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" />
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                          IMAP Connection Credentials for {acc.client_id}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* IMAP Email Address */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            IMAP / Gmail Address <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="support@company.com"
                            value={s.email}
                            onChange={(e) => setEditState((prev) => ({
                              ...prev,
                              [acc.client_id]: { ...prev[acc.client_id], email: e.target.value }
                            }))}
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>

                        {/* IMAP App Password */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            IMAP App Password / Token <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword[acc.client_id] ? 'text' : 'password'}
                              required
                              minLength={8}
                              placeholder="Gmail 16-character App Password"
                              value={s.password}
                              onChange={(e) => setEditState((prev) => ({
                                ...prev,
                                [acc.client_id]: { ...prev[acc.client_id], password: e.target.value }
                              }))}
                              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl pl-3.5 pr-10 py-2 text-xs font-medium font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(acc.client_id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              {showPassword[acc.client_id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-2">
                        <p className="text-[11px] text-muted-foreground">
                          For Google Workspace/Gmail, generate an App Password from your Google Security console.
                        </p>

                        <button
                          disabled={s.saving || !s.email || !s.password}
                          onClick={() => handleSaveConnection(acc.client_id)}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
                        >
                          {s.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Save Mailbox Connection</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
