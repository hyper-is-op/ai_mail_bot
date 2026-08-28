import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { 
    Loader2, UserPlus, CheckCircle, XCircle, ShieldCheck, 
    Lock, Eye, EyeOff, Search, Building, Phone, Mail, 
    User, ChevronDown, Trash2, Check, RefreshCw
} from 'lucide-react';

export default function AdminClients() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

    const [accounts, setAccounts] = useState<any[]>([]);
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Create New Client Form (Account & Profile only)
    const [createForm, setCreateForm] = useState({
        name: '',
        phone_number: '',
        company_name: '',
        department_name: '',
        login_email: '',
        login_password: '',
    });
    const [creating, setCreating] = useState(false);
    const [showCreatePass, setShowCreatePass] = useState(false);

    // Edit Client State
    const [manageState, setManageState] = useState<Record<string, {
        name: string;
        phone_number: string;
        company_name: string;
        department_name: string;
        login_email: string;
        new_password: string;
        status?: 'active' | 'inactive';
        savingProfile?: boolean;
        resettingPass?: boolean;
    }>>({});
    const [showResetPass, setShowResetPass] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [accs, pend] = await Promise.all([
                api.getAllEmailAccounts(),
                api.getPendingUsers(),
            ]);
            setAccounts(accs || []);
            setPending(pend || []);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to load client accounts' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setMsg(null);
        try {
            const res = await api.createClient({
                name: createForm.name.trim(),
                phone_number: createForm.phone_number.trim(),
                company_name: createForm.company_name.trim() || undefined,
                department_name: createForm.department_name.trim() || undefined,
                login_email: createForm.login_email.trim(),
                login_password: createForm.login_password,
            });
            setMsg({ 
                type: 'success', 
                text: `Client ${res.client_id} created successfully! Credentials emailed to ${createForm.login_email}.` 
            });
            setCreateForm({
                name: '',
                phone_number: '',
                company_name: '',
                department_name: '',
                login_email: '',
                login_password: '',
            });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to create client account' });
        } finally {
            setCreating(false);
        }
    };

    const handleApprove = async (email: string) => {
        try {
            await api.approveRegistration(email);
            setMsg({ type: 'success', text: `${email} registration approved!` });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to approve registration' });
        }
    };

    const toggleManage = (clientId: string) => {
        if (expanded === clientId) {
            setExpanded(null);
            return;
        }
        setExpanded(clientId);
        if (!manageState[clientId]) {
            const acc = accounts.find((a) => a.client_id === clientId) || {};
            setManageState((prev) => ({
                ...prev,
                [clientId]: {
                    name: acc.name || '',
                    phone_number: acc.phone_number || '',
                    company_name: acc.company_name || '',
                    department_name: acc.department_name || '',
                    login_email: acc.login_email || acc.email || '',
                    new_password: '',
                    status: acc.status || 'active',
                },
            }));
        }
    };

    const handleSaveProfile = async (clientId: string) => {
        const s = manageState[clientId];
        if (!s) return;
        setManageState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], savingProfile: true } }));
        setMsg(null);
        try {
            await api.updateClientProfile({
                client_id: clientId,
                name: s.name,
                phone_number: s.phone_number,
                company_name: s.company_name,
                department_name: s.department_name,
                login_email: s.login_email,
            });
            setMsg({ type: 'success', text: `Profile details updated for client ${clientId}.` });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to update profile' });
        } finally {
            setManageState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], savingProfile: false } }));
        }
    };

    const handleToggleStatus = async (clientId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await api.setUserStatus(clientId, newStatus);
            setMsg({ type: 'success', text: `Client ${clientId} is now ${newStatus}.` });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to update client status' });
        }
    };

    const handleResetPassword = async (clientId: string) => {
        const s = manageState[clientId];
        const newPass = s?.new_password || '';
        if (!newPass || newPass.length < 8) {
            setMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
            return;
        }
        setManageState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], resettingPass: true } }));
        setMsg(null);
        try {
            await api.adminResetClientPassword({ client_id: clientId, new_password: newPass });
            setMsg({ type: 'success', text: `Login password for ${clientId} updated successfully.` });
            setManageState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], new_password: '' } }));
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Password reset failed' });
        } finally {
            setManageState((prev) => ({ ...prev, [clientId]: { ...prev[clientId], resettingPass: false } }));
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        if (!window.confirm(`⚠️ WARNING: Permanently delete client "${clientId}" and all associated logs, credentials, and data? This action cannot be undone.`)) {
            return;
        }
        try {
            await api.deleteClient(clientId);
            setMsg({ type: 'success', text: `Client "${clientId}" has been deleted.` });
            setExpanded(null);
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to delete client' });
        }
    };

    const getInitials = (name?: string, id?: string) => {
        const target = name || id || 'CL';
        const parts = target.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return target.slice(0, 2).toUpperCase();
    };

    const filteredAccounts = accounts.filter((acc) => {
        const query = searchQuery.toLowerCase();
        return (
            (acc.client_id || '').toLowerCase().includes(query) ||
            (acc.name || '').toLowerCase().includes(query) ||
            (acc.company_name || '').toLowerCase().includes(query) ||
            (acc.login_email || acc.email || '').toLowerCase().includes(query)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Clients Management
                        </h2>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                            Onboard new client accounts and manage client profiles, contact information, and dashboard credentials.
                        </p>
                    </div>
                </div>

                <button
                    onClick={loadAll}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
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

            {/* Create Client Form */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-zinc-100 dark:border-white/5">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-white">Create New Client Account</h3>
                        <p className="text-xs text-muted-foreground">Register an authorized client organization and dashboard login user.</p>
                    </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Client Contact Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" /> Client Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. John Doe"
                                value={createForm.name}
                                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Phone Number */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Phone Number <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="e.g. +1 555-0199"
                                value={createForm.phone_number}
                                onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
                                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Company Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-muted-foreground" /> Company / Organization
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Acme Corporation"
                                value={createForm.company_name}
                                onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Department Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-muted-foreground" /> Department Name
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Customer Support & Operations"
                                value={createForm.department_name}
                                onChange={(e) => setCreateForm({ ...createForm, department_name: e.target.value })}
                                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Login Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Dashboard Login Email <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="email"
                                placeholder="client.admin@acme.com"
                                value={createForm.login_email}
                                onChange={(e) => setCreateForm({ ...createForm, login_email: e.target.value })}
                                className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Login Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Dashboard Password <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    required
                                    minLength={8}
                                    type={showCreatePass ? 'text' : 'password'}
                                    placeholder="Min 8 characters"
                                    value={createForm.login_password}
                                    onChange={(e) => setCreateForm({ ...createForm, login_password: e.target.value })}
                                    className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl pl-3.5 pr-10 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCreatePass(!showCreatePass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    {showCreatePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button
                            disabled={creating}
                            type="submit"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                            <span>Create Client Account</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Pending Approvals */}
            {pending.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            Pending Registrations ({pending.length})
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pending.map((p) => (
                            <div key={p.id} className="flex justify-between items-center bg-white/60 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl p-3.5">
                                <div className="min-w-0 pr-2">
                                    <p className="text-xs font-bold text-foreground truncate">{p.email}</p>
                                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.client_id} · {p.created_at}</p>
                                </div>
                                <button
                                    onClick={() => handleApprove(p.email)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-all shrink-0 cursor-pointer"
                                >
                                    Approve
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Clients List & Management */}
            <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-zinc-100 dark:border-white/5">
                    <div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-white">Registered Clients ({accounts.length})</h3>
                        <p className="text-xs text-muted-foreground">Browse, edit profiles, reset credentials, or deactivate client accounts.</p>
                    </div>

                    {/* Search filter */}
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter by name, ID, company..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    {filteredAccounts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-xs">
                            No clients found matching your search.
                        </div>
                    ) : (
                        filteredAccounts.map((acc) => {
                            const isExp = expanded === acc.client_id;
                            const s = manageState[acc.client_id] || {
                                name: acc.name || '',
                                phone_number: acc.phone_number || '',
                                company_name: acc.company_name || '',
                                department_name: acc.department_name || '',
                                login_email: acc.login_email || acc.email || '',
                                new_password: '',
                                status: acc.status || 'active',
                            };
                            const isActive = acc.status !== 'inactive';

                            return (
                                <div
                                    key={acc.client_id}
                                    className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                                        isExp
                                            ? 'border-primary/40 bg-zinc-50/50 dark:bg-white/[0.02] shadow-md ring-1 ring-primary/20'
                                            : 'border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:border-zinc-300 dark:hover:border-white/20'
                                    }`}
                                >
                                    {/* Client Header Row */}
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 gap-3">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/80 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-sm ring-1 ring-white/20 shrink-0">
                                                {getInitials(acc.name, acc.client_id)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs text-primary">{acc.client_id}</span>
                                                    <span className="text-xs font-bold text-foreground">
                                                        {acc.name ? `· ${acc.name}` : ''}
                                                    </span>
                                                    {acc.company_name && (
                                                        <span className="text-[11px] text-muted-foreground font-medium">
                                                            ({acc.company_name})
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                                    {acc.login_email || acc.email || 'No email registered'}
                                                    {acc.phone_number ? ` · ${acc.phone_number}` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 self-end sm:self-auto">
                                            {/* Status Badge & Toggle */}
                                            <button
                                                onClick={() => handleToggleStatus(acc.client_id, acc.status || 'active')}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    isActive
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20'
                                                }`}
                                                title="Click to toggle Active / Inactive"
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                                                {isActive ? 'ACTIVE' : 'INACTIVE'}
                                            </button>

                                            <button
                                                onClick={() => toggleManage(acc.client_id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                                    isExp
                                                        ? 'bg-primary text-primary-foreground border-primary'
                                                        : 'bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-foreground border-zinc-200 dark:border-white/10'
                                                }`}
                                            >
                                                <span>{isExp ? 'Close' : 'Manage Profile'}</span>
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Edit Profile & Credentials Section */}
                                    {isExp && (
                                        <div className="p-5 border-t border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-black/20 space-y-5 animate-in fade-in duration-200">
                                            {/* Profile Information */}
                                            <div>
                                                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-primary" /> Profile & Contact Details
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Client Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Contact Person Name"
                                                            value={s.name}
                                                            onChange={(e) => setManageState((prev) => ({
                                                                ...prev,
                                                                [acc.client_id]: { ...prev[acc.client_id], name: e.target.value }
                                                            }))}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Phone Number</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Phone Number"
                                                            value={s.phone_number}
                                                            onChange={(e) => setManageState((prev) => ({
                                                                ...prev,
                                                                [acc.client_id]: { ...prev[acc.client_id], phone_number: e.target.value }
                                                            }))}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Dashboard Login Email</label>
                                                        <input
                                                            type="email"
                                                            placeholder="Login Email"
                                                            value={s.login_email}
                                                            onChange={(e) => setManageState((prev) => ({
                                                                ...prev,
                                                                [acc.client_id]: { ...prev[acc.client_id], login_email: e.target.value }
                                                            }))}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Company / Organization</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Company Name"
                                                            value={s.company_name}
                                                            onChange={(e) => setManageState((prev) => ({
                                                                ...prev,
                                                                [acc.client_id]: { ...prev[acc.client_id], company_name: e.target.value }
                                                            }))}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Department Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Department Name"
                                                            value={s.department_name}
                                                            onChange={(e) => setManageState((prev) => ({
                                                                ...prev,
                                                                [acc.client_id]: { ...prev[acc.client_id], department_name: e.target.value }
                                                            }))}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex justify-start">
                                                    <button
                                                        disabled={s.savingProfile}
                                                        onClick={() => handleSaveProfile(acc.client_id)}
                                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                                    >
                                                        {s.savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                        <span>Save Profile Changes</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Reset Login Password */}
                                            <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                                                <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                                    <Lock className="w-3.5 h-3.5 text-amber-500" /> Reset Dashboard Password
                                                </h4>
                                                <p className="text-[11px] text-muted-foreground mb-3">Set a new login password for {acc.client_id}.</p>
                                                
                                                <div className="flex flex-wrap gap-2.5 items-center">
                                                    <div className="relative w-full max-w-xs">
                                                        <input
                                                            type={showResetPass[acc.client_id] ? 'text' : 'password'}
                                                            placeholder="New password (min 8 chars)"
                                                            value={s.new_password}
                                                            onChange={(e) => setManageState((prev) => ({
                                                                ...prev,
                                                                [acc.client_id]: { ...prev[acc.client_id], new_password: e.target.value }
                                                            }))}
                                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs font-medium font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowResetPass((prev) => ({ ...prev, [acc.client_id]: !prev[acc.client_id] }))}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                        >
                                                            {showResetPass[acc.client_id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>

                                                    <button
                                                        disabled={s.resettingPass || !s.new_password}
                                                        onClick={() => handleResetPassword(acc.client_id)}
                                                        className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
                                                    >
                                                        {s.resettingPass ? 'Resetting...' : 'Reset Password'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Danger Zone: Delete Client */}
                                            <div className="pt-4 border-t border-rose-500/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                <div>
                                                    <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                                                        <Trash2 className="w-3.5 h-3.5" /> Danger Zone
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        Permanently remove this client organization, dashboard access, and all associated configurations.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteClient(acc.client_id)}
                                                    className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer self-start sm:self-auto"
                                                >
                                                    Delete Client Account
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}