import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Loader2, CheckCircle, XCircle, Cpu, Key, Plus, Trash2, Edit3, Eye, EyeOff } from 'lucide-react';

export default function LlmConfigManager() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

    const [accounts, setAccounts] = useState<any[]>([]);
    const [llmConfigs, setLlmConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [llmForm, setLlmForm] = useState({
        id: undefined as number | undefined,
        client_id: 'SYSTEM',
        name: '',
        provider: 'groq',
        api_key: '',
        base_url: '',
        model_name: '',
        api_version: ''
    });
    const [savingLlm, setSavingLlm] = useState(false);
    const [showApiKey, setShowApiKey] = useState<Record<number, boolean>>({});
    const [showFormApiKey, setShowFormApiKey] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [accs, configs] = await Promise.all([
                api.getAllEmailAccounts(), api.getLlmConfigs()
            ]);
            setAccounts(accs);
            setLlmConfigs(configs);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLlmConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingLlm(true);
        setMsg({ type: '', text: '' });
        try {
            await api.saveLlmConfig({
                id: llmForm.id,
                client_id: llmForm.client_id,
                name: llmForm.name,
                provider: llmForm.provider,
                api_key: llmForm.api_key,
                base_url: llmForm.base_url || null,
                model_name: llmForm.model_name,
                api_version: llmForm.api_version || null
            });
            setMsg({ type: 'success', text: `LLM configuration "${llmForm.name}" saved successfully.` });
            setLlmForm({
                id: undefined,
                client_id: 'SYSTEM',
                name: '',
                provider: 'groq',
                api_key: '',
                base_url: '',
                model_name: '',
                api_version: ''
            });
            const configs = await api.getLlmConfigs();
            setLlmConfigs(configs);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSavingLlm(false);
        }
    };

    const handleDeleteLlmConfig = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this LLM configuration? Any client model overrides mapping to this config will revert to standard models.')) return;
        try {
            await api.deleteLlmConfig(id);
            setMsg({ type: 'success', text: 'LLM configuration deleted.' });
            const configs = await api.getLlmConfigs();
            setLlmConfigs(configs);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-white">
                    <Cpu className="w-8 h-8 text-primary" /> LLM Configurations
                </h2>
                <p className="text-muted-foreground mt-1">Configure multi-provider LLM integrations (OpenAI, Azure, Groq, xAI Grok, Gemini, Custom) for system-wide defaults or client-specific API credentials.</p>
            </div>

            {msg.text && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${msg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
                    {msg.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{msg.text}</span>
                </div>
            )}

            {/* Config Form Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                        {llmForm.id !== undefined ? '⚡ Edit LLM Configuration' : '➕ Add LLM Configuration'}
                    </h3>
                    {llmForm.id !== undefined && (
                        <button
                            onClick={() => setLlmForm({ id: undefined, client_id: 'SYSTEM', name: '', provider: 'groq', api_key: '', base_url: '', model_name: '', api_version: '' })}
                            className="text-xs bg-white/10 hover:bg-white/20 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>

                <form onSubmit={handleSaveLlmConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Friendly Name</label>
                        <input required type="text" placeholder="e.g. OpenAI GPT-4o" value={llmForm.name}
                            onChange={e => setLlmForm({ ...llmForm, name: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Client Scope</label>
                        <select value={llmForm.client_id}
                            onChange={e => setLlmForm({ ...llmForm, client_id: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                        >
                            <option value="SYSTEM" className="bg-zinc-900 text-white">🌐 Global (System Default)</option>
                            {accounts.map(acc => (
                                <option key={acc.client_id} value={acc.client_id} className="bg-zinc-900 text-white">
                                    🔒 Client: {acc.client_id} ({acc.name})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Provider Type</label>
                        <select value={llmForm.provider}
                            onChange={e => setLlmForm({ ...llmForm, provider: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                        >
                            <option value="groq" className="bg-zinc-900 text-white">Groq</option>
                            <option value="openai" className="bg-zinc-900 text-white">OpenAI</option>
                            <option value="gemini" className="bg-zinc-900 text-white">Gemini (compatibility endpoint)</option>
                            <option value="grok" className="bg-zinc-900 text-white">xAI (Grok)</option>
                            <option value="azure" className="bg-zinc-900 text-white">Azure OpenAI</option>
                            <option value="custom" className="bg-zinc-900 text-white">Custom OpenAI-compatible Gateway</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 relative">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">API Key</label>
                        <div className="relative">
                            <input required type={showFormApiKey ? "text" : "password"} placeholder="Enter API Key" value={llmForm.api_key}
                                onChange={e => setLlmForm({ ...llmForm, api_key: e.target.value })}
                                className="bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-white w-full focus:outline-none focus:border-primary transition-colors" />
                            <button
                                type="button"
                                onClick={() => setShowFormApiKey(!showFormApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                            >
                                {showFormApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Model Name</label>
                        <input required type="text" placeholder="e.g. gpt-4o, llama-3.3-70b-versatile" value={llmForm.model_name}
                            onChange={e => setLlmForm({ ...llmForm, model_name: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Base URL (optional)</label>
                        <input type="text" placeholder="e.g. https://api.openai.com/v1" value={llmForm.base_url}
                            onChange={e => setLlmForm({ ...llmForm, base_url: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors" />
                    </div>

                    {llmForm.provider === 'azure' && (
                        <div className="flex flex-col gap-1 md:col-span-3">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Azure API Version (optional)</label>
                            <input type="text" placeholder="e.g. 2024-02-15-preview" value={llmForm.api_version}
                                onChange={e => setLlmForm({ ...llmForm, api_version: e.target.value })}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors" />
                        </div>
                    )}

                    <button disabled={savingLlm} type="submit" className="md:col-span-3 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/95 transition-all">
                        {savingLlm ? <Loader2 className="w-4 h-4 animate-spin" /> : llmForm.id !== undefined ? 'Update LLM Configuration' : 'Add LLM Configuration'}
                    </button>
                </form>
            </div>

            {/* Configurations List Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-lg font-semibold text-white">Active LLM Provider Integrations ({llmConfigs.length})</h3>
                {llmConfigs.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">No custom LLM configurations defined yet. The platform is currently using fallback default models via system environment variables.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {llmConfigs.map(c => {
                            const isGlobal = c.client_id === 'SYSTEM';
                            return (
                                <div key={c.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between hover:border-white/20 transition-all">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isGlobal ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                                                {isGlobal ? '🌐 Global (System)' : `🔒 Client: ${c.client_id}`}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-mono">ID: config_{c.id}</span>
                                        </div>
                                        <h4 className="font-semibold text-white text-sm mt-1">{c.name}</h4>
                                        <p className="text-xs text-zinc-400"><span className="font-bold">Provider:</span> {c.provider.toUpperCase()}</p>
                                        <p className="text-xs text-zinc-400"><span className="font-bold">Model Name:</span> {c.model_name}</p>
                                        {c.base_url && (
                                            <p className="text-xs text-zinc-500 truncate"><span className="font-bold">Base URL:</span> {c.base_url}</p>
                                        )}
                                        {c.api_version && (
                                            <p className="text-xs text-zinc-500 truncate"><span className="font-bold">API Version:</span> {c.api_version}</p>
                                        )}
                                        <div className="flex gap-2 items-center text-xs mt-2 bg-black/20 p-2 rounded-lg border border-white/5">
                                            <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <span className="font-mono text-zinc-400 truncate flex-1">
                                                {showApiKey[c.id] ? c.api_key : '••••••••••••••••••••'}
                                            </span>
                                            <button
                                                onClick={() => setShowApiKey(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                                className="text-zinc-400 hover:text-white"
                                            >
                                                {showApiKey[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                                        <button
                                            onClick={() => setLlmForm({
                                                id: c.id,
                                                client_id: c.client_id,
                                                name: c.name,
                                                provider: c.provider,
                                                api_key: c.api_key,
                                                base_url: c.base_url || '',
                                                model_name: c.model_name,
                                                api_version: c.api_version || ''
                                            })}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLlmConfig(c.id)}
                                            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
