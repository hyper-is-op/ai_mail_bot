import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Loader2, UserPlus, CheckCircle, XCircle, ShieldCheck, Settings2, DollarSign, Clock, Lock, Eye, EyeOff, Cpu, Key, Globe, Plus, Trash2, Edit3, Server } from 'lucide-react';

const CALLER_FUNCTIONS = [
    'detect_intent_llm', 'generate_reply_llm', 'design_payload',
    'scan_history_for_ticket', 'extract_issue_description', 'generate_summary_llm', 'llm_score'
];
const MODEL_OPTIONS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
const FEATURE_KEYS = [
    ['feature_ticket_creation', 'Ticket Creation'],
    ['feature_auto_send', 'Auto-Send'],
    ['feature_rag', 'RAG Knowledge Lookup'],
    ['feature_order_tracking', 'Tools Intigration'],
    ['feature_manual_reply', 'Manual Reply'],
] as const;

export default function AdminClients() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

    const [accounts, setAccounts] = useState<any[]>([]);
    const [pending, setPending] = useState<any[]>([]);
    const [budgets, setBudgets] = useState<any[]>([]);
    const [llmConfigs, setLlmConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [expanded, setExpanded] = useState<string | null>(null);

    const [createForm, setCreateForm] = useState({
        name: '', phone_number: '', login_email: '', login_password: '', imap_email: '', imap_password: '',
        agent_type: '', department_name: '', company_name: ''
    });
    const [creating, setCreating] = useState(false);

    const [manageState, setManageState] = useState<Record<string, any>>({});
    const [showLoginPass, setShowLoginPass] = useState(false);
    const [showImapPass, setShowImapPass] = useState(false);
    const [showResetPass, setShowResetPass] = useState<Record<string, boolean>>({});
    const [showManageImapPass, setShowManageImapPass] = useState<Record<string, boolean>>({});

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [accs, pend, budg, configs] = await Promise.all([
                api.getAllEmailAccounts(), api.getPendingUsers(), api.getAllBudgetStatuses(), api.getLlmConfigs()
            ]);
            setAccounts(accs);
            setPending(pend);
            setBudgets(budg);
            setLlmConfigs(configs);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await api.createClient(createForm);
            setMsg({ type: 'success', text: `Client ${res.client_id} created. Credentials emailed to ${createForm.login_email}.` });
            setCreateForm({ 
                name: '', phone_number: '', login_email: '', login_password: '', imap_email: '', imap_password: '',
                agent_type: '', department_name: '', company_name: '' 
            });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setCreating(false);
        }
    };

    const handleApprove = async (email: string) => {
        try {
            await api.approveRegistration(email);
            setMsg({ type: 'success', text: `${email} approved.` });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    const openManage = async (clientId: string) => {
        if (expanded === clientId) { setExpanded(null); return; }
        setExpanded(clientId);
        if (!manageState[clientId]) {
            const acc = accounts.find(a => a.client_id === clientId) || {};
            try {
                const modelConfig = await api.getClientModelConfig(clientId);
                const modelMap: Record<string, string> = {};
                modelConfig.forEach((m: any) => { modelMap[m.caller_function] = m.model_name; });
                setManageState(prev => ({
                    ...prev,
                    [clientId]: {
                        feature_ticket_creation: true, feature_auto_send: true, feature_rag: true,
                        feature_order_tracking: true, feature_manual_reply: true,
                        cost_multiplier: 1.0, monthly_budget_usd: '',
                        models: modelMap,
                        new_password: '',
                        name: acc.name || '',
                        phone_number: acc.phone_number || '',
                        login_email: acc.login_email || '',
                        imap_email: acc.imap_email || '',
                        imap_password: acc.imap_password || '',
                        agent_type: acc.agent_type || '',
                        department_name: acc.department_name || '',
                        company_name: acc.company_name || '',
                    }
                }));
            } catch {
                setManageState(prev => ({
                    ...prev,
                    [clientId]: {
                        models: {},
                        new_password: '',
                        name: acc.name || '',
                        phone_number: acc.phone_number || '',
                        login_email: acc.login_email || '',
                        imap_email: acc.imap_email || '',
                        imap_password: acc.imap_password || '',
                        agent_type: acc.agent_type || '',
                        department_name: acc.department_name || '',
                        company_name: acc.company_name || '',
                    }
                }));
            }
        }
    };

    const saveProfile = async (clientId: string) => {
        const s = manageState[clientId];
        try {
            await api.updateClientProfile({
                client_id: clientId,
                name: s.name,
                phone_number: s.phone_number,
                login_email: s.login_email,
                imap_email: s.imap_email,
                imap_password: s.imap_password,
                agent_type: s.agent_type,
                department_name: s.department_name,
                company_name: s.company_name,
            });
            setMsg({ type: 'success', text: `Profile details updated for ${clientId}.` });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete client "${clientId}" and all associated logs, credentials, and data? This action cannot be undone.`)) {
            return;
        }
        try {
            await api.deleteClient(clientId);
            setMsg({ type: 'success', text: `Client "${clientId}" has been successfully deleted.` });
            setExpanded(null);
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    const handleAdminResetPassword = async (clientId: string) => {
        const s = manageState[clientId];
        const newPass = s?.new_password || '';
        if (!newPass || newPass.length < 8) {
            setMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
            return;
        }
        try {
            await api.adminResetClientPassword({ client_id: clientId, new_password: newPass });
            setMsg({ type: 'success', text: `Login password for ${clientId} updated successfully.` });
            setManageState(prev => ({ ...prev, [clientId]: { ...prev[clientId], new_password: '' } }));
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    const saveFeatures = async (clientId: string) => {
        const s = manageState[clientId];
        try {
            await api.setClientFeatures({
                client_id: clientId,
                feature_ticket_creation: s.feature_ticket_creation,
                feature_auto_send: s.feature_auto_send,
                feature_rag: s.feature_rag,
                feature_order_tracking: s.feature_order_tracking,
                feature_manual_reply: s.feature_manual_reply,
            });
            setMsg({ type: 'success', text: `Features updated for ${clientId}` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    const saveCost = async (clientId: string) => {
        const s = manageState[clientId];
        try {
            await api.setClientCostConfig({
                client_id: clientId,
                cost_multiplier: parseFloat(s.cost_multiplier) || 1.0,
                monthly_budget_usd: s.monthly_budget_usd ? parseFloat(s.monthly_budget_usd) : null,
            });
            setMsg({ type: 'success', text: `Cost config updated for ${clientId}` });
            loadAll();
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    const saveModel = async (clientId: string, fn: string, model: string) => {
        try {
            await api.setClientModelConfig({ client_id: clientId, caller_function: fn, model_name: model });
            setMsg({ type: 'success', text: `Model set for ${fn}` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-primary" /> Admin · Client Management
                </h2>
                <p className="text-muted-foreground mt-1">Create clients, approve pending registrations, and configure per-client behavior.</p>
            </div>

            {msg.text && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${msg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                    {msg.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{msg.text}</span>
                </div>
            )}

            {/* Create Client */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Create New Client</h3>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input required type="text" placeholder="Client Name" value={createForm.name}
                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                    <input required type="text" placeholder="Phone Number" value={createForm.phone_number}
                        onChange={e => setCreateForm({ ...createForm, phone_number: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                    <input required type="email" placeholder="Client login email" value={createForm.login_email}
                        onChange={e => setCreateForm({ ...createForm, login_email: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                    <div className="relative">
                        <input required type={showLoginPass ? "text" : "password"} minLength={8} placeholder="Client login password (min 8 chars)" value={createForm.login_password}
                            onChange={e => setCreateForm({ ...createForm, login_password: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm w-full" />
                        <button
                            type="button"
                            onClick={() => setShowLoginPass(!showLoginPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                        >
                            {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <input type="email" placeholder="IMAP/Gmail address (optional)" value={createForm.imap_email}
                        onChange={e => setCreateForm({ ...createForm, imap_email: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                    <div className="relative">
                        <input type={showImapPass ? "text" : "password"} placeholder="IMAP app password (optional)" value={createForm.imap_password}
                            onChange={e => setCreateForm({ ...createForm, imap_password: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm w-full" />
                        <button
                            type="button"
                            onClick={() => setShowImapPass(!showImapPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                        >
                            {showImapPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <input type="text" placeholder="Agent Type/Persona (optional, e.g. Support Agent)" value={createForm.agent_type}
                        onChange={e => setCreateForm({ ...createForm, agent_type: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                    <input type="text" placeholder="Department Name (optional, e.g. Customer Support)" value={createForm.department_name}
                        onChange={e => setCreateForm({ ...createForm, department_name: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm" />
                    <input type="text" placeholder="Company Name (optional, e.g. C-Zentrix)" value={createForm.company_name}
                        onChange={e => setCreateForm({ ...createForm, company_name: e.target.value })}
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm md:col-span-2" />
                    <button disabled={creating} type="submit" className="md:col-span-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Client & Email Credentials'}
                    </button>
                </form>
            </div>

            {/* Pending Approvals */}
            {pending.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-400" /> Pending Approvals</h3>
                    <div className="space-y-2">
                        {pending.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                                <div>
                                    <p className="text-sm font-medium">{p.email}</p>
                                    <p className="text-xs text-muted-foreground">{p.client_id} · {p.role} · {p.created_at}</p>
                                </div>
                                <button onClick={() => handleApprove(p.email)} className="bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-semibold">
                                    Approve
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Clients table */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-semibold mb-4">All Clients</h3>
                <div className="space-y-3">
                    {accounts.map((acc) => {
                        const budget = budgets.find(b => b.client_id === acc.client_id);
                        const s = manageState[acc.client_id];
                        return (
                            <div key={acc.client_id} className="border border-white/10 rounded-xl overflow-hidden">
                                <div className="flex justify-between items-center p-4 bg-white/5">
                                    <div>
                                        <p className="font-mono font-bold text-accent">{acc.client_id}</p>
                                        <p className="text-sm text-muted-foreground">{acc.email}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {budget && budget.status !== 'unlimited' && (
                                            <span className={`text-xs px-2 py-1 rounded-full border ${budget.status === 'exceeded' ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' :
                                                budget.status === 'warning' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                                                    'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                                }`}>
                                                ${budget.spent} / ${budget.budget} ({budget.percent}%)
                                            </span>
                                        )}
                                        <button onClick={() => openManage(acc.client_id)} className="text-sm text-primary flex items-center gap-1">
                                            <Settings2 className="w-4 h-4" /> Manage
                                        </button>
                                    </div>
                                </div>

                                {expanded === acc.client_id && s && (
                                    <div className="p-4 space-y-4 border-t border-white/10">
                                        {/* Feature toggles */}
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">FEATURES</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {FEATURE_KEYS.map(([key, label]) => (
                                                    <label key={key} className="flex items-center gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                                                        <input type="checkbox" checked={!!s[key]}
                                                            onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], [key]: e.target.checked } }))} />
                                                        {label}
                                                    </label>
                                                ))}
                                            </div>
                                            <button onClick={() => saveFeatures(acc.client_id)} className="mt-2 text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg">
                                                Save Features
                                            </button>
                                        </div>

                                        {/* Model per function */}
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">MODEL OVERRIDE PER FUNCTION</p>
                                            <div className="space-y-2">
                                                {CALLER_FUNCTIONS.map(fn => (
                                                    <div key={fn} className="flex items-center gap-2 text-sm">
                                                        <span className="flex-1 font-mono text-xs">{fn}</span>
                                                        <select
                                                            value={s.models?.[fn] || ''}
                                                            onChange={e => {
                                                                const model = e.target.value;
                                                                setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], models: { ...prev[acc.client_id].models, [fn]: model } } }));
                                                                saveModel(acc.client_id, fn, model);
                                                            }}
                                                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white bg-zinc-900"
                                                        >
                                                            <option value="" className="bg-zinc-900 text-zinc-400">(use global default)</option>
                                                            <optgroup label="Standard Models" className="bg-zinc-900 text-zinc-300">
                                                                {MODEL_OPTIONS.map(m => (
                                                                    <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                                ))}
                                                            </optgroup>
                                                            {llmConfigs.length > 0 && (
                                                                <optgroup label="Custom Provider Configs" className="bg-zinc-900 text-zinc-300">
                                                                    {llmConfigs
                                                                        .filter(c => c.client_id === 'SYSTEM' || c.client_id === acc.client_id)
                                                                        .map(c => (
                                                                            <option key={c.id} value={`config_${c.id}`} className="bg-zinc-900 text-white font-medium">
                                                                                {c.client_id === 'SYSTEM' ? '🌐 [Global]' : '🔒 [Client]'} {c.name} ({c.provider}: {c.model_name})
                                                                            </option>
                                                                        ))
                                                                    }
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Cost / budget */}
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><DollarSign className="w-3 h-3" /> COST & BUDGET</p>
                                            <div className="flex gap-2 items-end">
                                                <div>
                                                    <label className="text-xs text-muted-foreground">Cost Multiplier</label>
                                                    <input type="number" step="0.01" value={s.cost_multiplier}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], cost_multiplier: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm w-24 block" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-muted-foreground">Monthly Budget ($)</label>
                                                    <input type="number" step="1" placeholder="unlimited" value={s.monthly_budget_usd}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], monthly_budget_usd: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm w-28 block" />
                                                </div>
                                                <button onClick={() => saveCost(acc.client_id)} className="text-xs bg-primary/20 text-primary px-3 py-2 rounded-lg">
                                                    Save
                                                </button>
                                            </div>
                                        </div>

                                        {/* Client Profile & Account Settings */}
                                        <div className="pt-2 border-t border-white/10">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">CLIENT PROFILE & ACCOUNT SETTINGS</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">Client Name</label>
                                                    <input required type="text" placeholder="Client Name" value={s.name || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], name: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">Phone Number</label>
                                                    <input required type="text" placeholder="Phone Number" value={s.phone_number || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], phone_number: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">Login Email</label>
                                                    <input required type="email" placeholder="Login Email" value={s.login_email || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], login_email: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">IMAP/Gmail Email</label>
                                                    <input type="email" placeholder="IMAP Email Address" value={s.imap_email || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], imap_email: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                                <div className="space-y-1 relative">
                                                    <label className="text-[10px] font-semibold text-zinc-400">IMAP Password</label>
                                                    <div className="relative">
                                                        <input 
                                                            type={showManageImapPass[acc.client_id] ? "text" : "password"} 
                                                            placeholder="IMAP App Password" 
                                                            value={s.imap_password || ''}
                                                            onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], imap_password: e.target.value } }))}
                                                            className="bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-1.5 text-sm w-full text-white" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowManageImapPass(prev => ({ ...prev, [acc.client_id]: !prev[acc.client_id] }))}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                                                        >
                                                            {showManageImapPass[acc.client_id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">Agent Type/Persona</label>
                                                    <input type="text" placeholder="e.g. Support Agent" value={s.agent_type || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], agent_type: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">Department Name</label>
                                                    <input type="text" placeholder="e.g. Customer Support" value={s.department_name || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], department_name: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-semibold text-zinc-400">Company Name</label>
                                                    <input type="text" placeholder="e.g. C-Zentrix" value={s.company_name || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], company_name: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm w-full text-white" />
                                                </div>
                                            </div>
                                            <button onClick={() => saveProfile(acc.client_id)} className="mt-2 text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 rounded-lg transition-all">
                                                Update Profile & Credentials
                                            </button>
                                        </div>

                                         {/* Reset Login Password */}
                                        <div className="pt-2 border-t border-white/10">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> RESET LOGIN PASSWORD</p>
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1 max-w-xs relative">
                                                    <input 
                                                        type={showResetPass[acc.client_id] ? "text" : "password"} 
                                                        placeholder="New password (min 8 chars)" 
                                                        value={s.new_password || ''}
                                                        onChange={e => setManageState(prev => ({ ...prev, [acc.client_id]: { ...prev[acc.client_id], new_password: e.target.value } }))}
                                                        className="bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-1.5 text-sm w-full block text-white placeholder-white/30" 
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowResetPass(prev => ({ ...prev, [acc.client_id]: !prev[acc.client_id] }))}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                                                    >
                                                        {showResetPass[acc.client_id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => handleAdminResetPassword(acc.client_id)} 
                                                    className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-3 py-2 rounded-lg transition-all"
                                                >
                                                    Reset Password
                                                </button>
                                            </div>
                                        </div>

                                        {/* Danger Zone: Delete Client */}
                                        <div className="pt-4 border-t border-rose-500/20">
                                            <p className="text-xs font-semibold text-rose-400 mb-2">DANGER ZONE</p>
                                            <button 
                                                onClick={() => handleDeleteClient(acc.client_id)} 
                                                className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-3 py-2 rounded-lg font-semibold transition-all"
                                            >
                                                Delete Client Account & Data
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}