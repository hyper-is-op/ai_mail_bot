import { useState, useEffect } from 'react';
import { Users, Mail, CheckCircle, XCircle, Loader2, Info, Eye, EyeOff, PlusCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function EmailAccounts() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [myAccount, setMyAccount] = useState<any>(null);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const clientId = user?.client_id || '';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, [clientId, isAdmin]);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      if (isAdmin) {
        const res = await api.getAllEmailAccounts();
        setAllAccounts(res);
      }
      
      if (clientId) {
        try {
          const res = await api.getEmailAccount(clientId);
          setMyAccount(res);
          setFormData({ email: res.email, password: res.password });
        } catch (e) {
          // If no account exists for client yet, that's fine
        }
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setMsg({ type: 'error', text: 'No active session Client ID found. Please log in again.' });
      return;
    }
    
    setSaveLoading(true);
    setMsg({ type: '', text: '' });
    try {
      await api.acceptEmail({
        client_id: clientId,
        email: formData.email,
        password: formData.password
      });
      setMsg({ type: 'success', text: `Successfully saved your IMAP credentials!` });
      
      setMyAccount({ email: formData.email, password: formData.password });
      fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaveLoading(false);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPassword(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Email Accounts</h2>
          <p className="text-muted-foreground mt-1">Manage IMAP credentials for automated parsing.</p>
        </div>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${msg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
          {msg.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{msg.text}</span>
        </div>
      )}

      {/* Info Alert Box */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-white">Why configure an Email Account?</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We require IMAP Gmail credentials to connect to your support channel. The AI model reads incoming messages in real-time, instantly answers standard customer queries, and generates helpdesk tickets for unresolved requests.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Form: Add / Edit Credentials Form (Always Visible, Client ID hidden/automatic) */}
        {!isAdmin && (
          <div className="glass-panel p-6 rounded-2xl border border-white/10 xl:col-span-4 h-fit">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary" /> Save Credentials
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-300">Email Address</label>
                <input 
                  type="email" required
                  placeholder="support@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-300">App Password / Token</label>
                <div className="relative">
                  <input 
                    type={showFormPassword ? 'text' : 'password'} required minLength={8}
                    placeholder="Gmail 16-character App Password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-mono" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button disabled={saveLoading} type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mt-4">
                {saveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Securely'}
              </button>
            </form>
          </div>
        )}

        {/* Right Section: Master Accounts (Admin) or Active Config Card (Client) */}
        <div className={isAdmin ? "xl:col-span-12 flex flex-col" : "xl:col-span-8 flex flex-col"}>
          {isAdmin ? (
            // Admin View - Shows all Client Accounts Table
            <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="text-lg font-semibold">Master Accounts Directory (Admin Only)</h3>
                  <p className="text-xs text-muted-foreground">List of all active IMAP configuration parameters across the platform</p>
                </div>
              </div>

              {fetchLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : allAccounts.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-white/5 text-muted-foreground border-b border-white/5">
                        <th className="p-4 font-semibold">Client ID</th>
                        <th className="p-4 font-semibold">Gmail Address</th>
                        <th className="p-4 font-semibold">App Password</th>
                        <th className="p-4 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allAccounts.map((account) => (
                        <tr key={account.client_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-mono font-bold text-accent">{account.client_id}</td>
                          <td className="p-4">{account.email}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 font-mono">
                              <span>{showPassword[account.client_id] ? account.password : '••••••••••••••••'}</span>
                              <button onClick={() => togglePasswordVisibility(account.client_id)} className="text-muted-foreground hover:text-white transition-colors">
                                {showPassword[account.client_id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-xl text-muted-foreground">
                  <Users className="w-12 h-12 mb-2 opacity-25" />
                  <p>No active client configurations found.</p>
                </div>
              )}
            </div>
          ) : (
            // Client View - Shows Active Config Card
            <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col h-full justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" /> Active Configuration
                </h3>
                <p className="text-xs text-muted-foreground mb-6">Your currently active IMAP link details monitored by AI daemon</p>
              </div>

              {fetchLoading ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : myAccount ? (
                <div className="space-y-4 bg-white/5 p-5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs p-1 border border-primary/30 truncate">
                      {clientId.split('-')[1] || 'CLI'}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{myAccount.email}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> AI Worker Connected
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">Authentication Token</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span>{showPassword['my'] ? myAccount.password : '••••••••••••••••'}</span>
                      <button onClick={() => togglePasswordVisibility('my')} className="text-muted-foreground hover:text-white transition-colors">
                        {showPassword['my'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded-xl text-muted-foreground">
                  <Mail className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No active configuration. Setup on the left.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
