import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle, XCircle, Loader2, 
  Eye, EyeOff, RefreshCw, 
  Search, Check, Inbox, ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { SettingsCard, SettingsRow } from '@/components/fluent';
import { cn } from '@/lib/utils';
import { StatusBadge, Input } from '@/components/common';

export default function EmailAccounts() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONNECTED' | 'UNCONFIGURED'>('ALL');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Per-client editing state
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

  const togglePasswordVisibility = (key: string) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const connectedCount = allAccounts.filter((a) => Boolean(a.email && a.email.trim())).length;
  const unconfiguredCount = allAccounts.filter((a) => !Boolean(a.email && a.email.trim())).length;

  const filteredAccounts = allAccounts.filter((acc) => {
    const hasEmail = Boolean(acc.email && acc.email.trim());
    if (statusFilter === 'CONNECTED' && !hasEmail) return false;
    if (statusFilter === 'UNCONFIGURED' && hasEmail) return false;

    const query = searchQuery.toLowerCase();
    return (
      (acc.client_id || '').toLowerCase().includes(query) ||
      (acc.company_name || '').toLowerCase().includes(query) ||
      (acc.name || '').toLowerCase().includes(query) ||
      (acc.email || '').toLowerCase().includes(query) ||
      (acc.login_email || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4 sm:space-y-5 pb-12 max-w-7xl mx-auto">
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
          {isAdmin && (
            <Link
              to="/admin/clients"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground transition-all cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Manage Clients</span>
            </Link>
          )}
          <button
            onClick={fetchData}
            disabled={fetchLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", fetchLoading && "animate-spin")} />
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
        description="Click on any client row to inspect or update IMAP addresses and passwords"
        headerAction={
          isAdmin ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Status Segmented Filter */}
              <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.04] p-0.5 rounded-md border border-black/[0.06] dark:border-white/[0.06] text-[11px]">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-all cursor-pointer',
                    statusFilter === 'ALL'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All ({allAccounts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CONNECTED')}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-all cursor-pointer',
                    statusFilter === 'CONNECTED'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Connected ({connectedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNCONFIGURED')}
                  className={cn(
                    'px-2 py-1 rounded font-medium transition-all cursor-pointer',
                    statusFilter === 'UNCONFIGURED'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Unconfigured ({unconfiguredCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="w-44 sm:w-56">
                <Input
                  icon={<Search className="w-3.5 h-3.5" />}
                  placeholder="Filter mailboxes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="py-1 text-xs"
                />
              </div>
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
                    {isAdmin && acc.login_email && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        (Login: {acc.login_email})
                      </span>
                    )}
                  </div>
                }
                description={acc.email ? `IMAP: ${acc.email}` : 'No IMAP mailbox connected'}
                expandable
                expanded={isExp}
                onToggleExpand={() => openEditDrawer(acc.client_id)}
                action={
                  hasConfig ? (
                    <StatusBadge variant="success" label="Connected" dot size="xs" />
                  ) : (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge variant="warning" label="Unconfigured" dot size="xs" />
                      <button
                        type="button"
                        onClick={() => openEditDrawer(acc.client_id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                      >
                        <span>Connect</span>
                      </button>
                    </div>
                  )
                }
              >
                {/* Expandable Credential Editor Form */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        IMAP / Gmail Address <span className="text-rose-500">*</span>
                      </label>
                      <Input
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
                        className="font-mono text-xs py-1.5"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        IMAP App Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Input
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
                          className="font-mono text-xs pr-8 py-1.5"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => togglePasswordVisibility(acc.client_id)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer z-10"
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
    </div>
  );
}
