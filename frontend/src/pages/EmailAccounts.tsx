import { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Loader2, 
  Eye, EyeOff, RefreshCw, 
  Search, Check, Plus, 
  Inbox
} from 'lucide-react';
import { api } from '@/lib/api';
import { SettingsCard, SettingsRow } from '@/components/fluent';
import { cn } from '@/lib/utils';

export default function EmailAccounts() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Per-client editing state
  const [editState, setEditState] = useState<Record<string, {
    email: string;
    password: string;
    saving?: boolean;
  }>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // New account modal / card state
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

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
          setAllAccounts([{ client_id: user.client_id, email: '', password: '' }]);
        }
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to load mailbox configurations' });
    } finally {
      setFetchLoading(false);
    }
  };

  const openEditDrawer = (clientId: string) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      return;
    }
    setExpandedClientId(clientId);
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
      setMsg({ type: 'success', text: `Mailbox connection verified & saved for ${clientId}!` });
      await fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save mailbox connection' });
    } finally {
      setEditState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], saving: false } }));
    }
  };

  const handleCreateNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId.trim() || !newEmail.trim() || !newPassword.trim()) {
      setMsg({ type: 'error', text: 'Please complete all required fields.' });
      return;
    }
    setCreatingAccount(true);
    setMsg(null);
    try {
      await api.acceptEmail({
        client_id: newClientId.trim().toLowerCase(),
        email: newEmail.trim(),
        password: newPassword.trim(),
      });
      setMsg({ type: 'success', text: `Mailbox successfully connected and saved for client ${newClientId}!` });
      setShowNewAccountModal(false);
      setNewClientId('');
      setNewEmail('');
      setNewPassword('');
      await fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save client mailbox connection' });
    } finally {
      setCreatingAccount(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
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
    <div className="space-y-4 sm:space-y-5 select-none pb-12 max-w-7xl mx-auto">
      {/* Windows 11 Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Client Mailboxes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure primary incoming IMAP mailboxes and credentials for clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNewAccountModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Mailbox</span>
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {msg && (
        <div
          className={cn(
            'p-3 rounded-lg border flex items-center justify-between gap-3 text-xs font-medium',
            msg.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          )}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'error' ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="font-bold opacity-70 hover:opacity-100 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Directory of Expandable Mailbox Rows */}
      <SettingsCard
        title="Configured Mailbox Credentials"
        description="Click on any mailbox row to update IMAP addresses and passwords"
        headerAction={
          isAdmin ? (
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter mailboxes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-md pl-8 pr-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary"
              />
            </div>
          ) : undefined
        }
      >
        {fetchLoading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Loading mailbox configurations...</span>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No matching client mailboxes found.
          </div>
        ) : (
          filteredAccounts.map((acc) => {
            const isExp = expandedClientId === acc.client_id;
            const hasConfig = Boolean(acc.email && acc.email.trim());
            const s = editState[acc.client_id] || {
              email: acc.email || '',
              password: acc.password || '',
            };

            return (
              <SettingsRow
                key={acc.client_id}
                icon={Inbox}
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-primary font-bold">{acc.client_id}</span>
                    {acc.company_name && <span>· {acc.company_name}</span>}
                  </div>
                }
                description={acc.email || 'No IMAP mailbox connected'}
                expandable
                expanded={isExp}
                onToggleExpand={() => openEditDrawer(acc.client_id)}
                action={
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                      hasConfig
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    )}
                  >
                    {hasConfig ? 'Connected' : 'Unconfigured'}
                  </span>
                }
              >
                {/* Expandable Credential Editor Form */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        IMAP / Gmail Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="support@company.com"
                        value={s.email}
                        onChange={(e) =>
                          setEditState((prev) => ({
                            ...prev,
                            [acc.client_id]: { ...prev[acc.client_id], email: e.target.value },
                          }))
                        }
                        className="w-full bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary font-mono shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        IMAP App Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword[acc.client_id] ? 'text' : 'password'}
                          required
                          minLength={8}
                          placeholder="Gmail 16-character App Password"
                          value={s.password}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              [acc.client_id]: { ...prev[acc.client_id], password: e.target.value },
                            }))
                          }
                          className="w-full bg-white dark:bg-[#202020] border border-black/[0.08] dark:border-white/[0.08] rounded-md pl-3 pr-8 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => togglePasswordVisibility(acc.client_id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showPassword[acc.client_id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[11px] text-muted-foreground">
                      Use standard SSL/TLS port 993 with OAuth2 or an App Password.
                    </span>
                    <button
                      type="button"
                      disabled={s.saving || !s.email || !s.password}
                      onClick={() => handleSaveConnection(acc.client_id)}
                      className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md shadow-2xs hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {s.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Mailbox</span>
                    </button>
                  </div>
                </div>
              </SettingsRow>
            );
          })
        )}
      </SettingsCard>

      {/* =========================================================================
          CONNECT CLIENT MAILBOX FLYOUT MODAL (Windows 11 Dialog Style)
          ========================================================================= */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="win11-card rounded-lg p-5 max-w-md w-full border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2C] shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Connect Client Mailbox
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Each client account connects to a single primary IMAP mailbox.
              </p>
            </div>

            <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
              💡 <strong>1:1 Account Architecture:</strong> Connecting an email address to a Client ID configures the monitored mailbox for that client. Setting a new mailbox on an existing client replaces its credentials.
            </div>

            <form onSubmit={handleCreateNewAccount} className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-foreground">
                    Target Client ID <span className="text-rose-500">*</span>
                  </label>
                  {isAdmin && (
                    <a
                      href="/admin/clients"
                      className="text-[11px] text-primary hover:underline"
                    >
                      Manage Clients &rarr;
                    </a>
                  )}
                </div>
                {allAccounts.length > 0 ? (
                  <div className="space-y-1.5">
                    <select
                      value={newClientId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewClientId(val);
                        const match = allAccounts.find((a) => a.client_id === val);
                        if (match && match.email) {
                          setNewEmail(match.email);
                        }
                      }}
                      className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary font-mono"
                    >
                      <option value="">-- Select an existing client --</option>
                      {allAccounts.map((a) => (
                        <option key={a.client_id} value={a.client_id}>
                          {a.client_id} {a.company_name ? `(${a.company_name})` : ''} {a.email ? `[Has Mailbox: ${a.email}]` : '[No Mailbox]'}
                        </option>
                      ))}
                      <option value="__custom__">+ Enter custom Client ID...</option>
                    </select>

                    {newClientId === '__custom__' && (
                      <input
                        type="text"
                        required
                        placeholder="Enter Client ID (e.g. CLI-ABCD1234)"
                        onChange={(e) => setNewClientId(e.target.value)}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary font-mono mt-1"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLI-12345678"
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                    className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary font-mono"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  IMAP / Gmail Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="support@client.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  IMAP App Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="16-character App Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAccountModal(false);
                    setNewClientId('');
                    setNewEmail('');
                    setNewPassword('');
                  }}
                  className="px-3.5 py-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md shadow-2xs hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creatingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save Mailbox</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
