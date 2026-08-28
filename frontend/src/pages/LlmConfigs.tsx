import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { 
    Loader2, CheckCircle, XCircle, Cpu, Trash2, Eye, EyeOff, 
    Globe, Users, Save, Layers, Check, Sparkles, RefreshCw, Edit2,
    Shield, ShieldAlert, AlertTriangle, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react';

const PROVIDER_DEFAULT_URLS: Record<string, string> = {
    groq: 'https://api.groq.com/openai/v1',
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    grok: 'https://api.x.ai/v1',
    azure: '',
    custom: ''
};

const PROVIDER_SAMPLE_MODELS: Record<string, string[]> = {
    groq: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
    ],
    openai: [
        'gpt-4o',
        'gpt-4o-mini',
        'o3-mini',
        'gpt-4-turbo',
        'gpt-3.5-turbo'
    ],
    claude: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229'
    ],
    gemini: [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.5-flash-8b'
    ],
    grok: [
        'grok-2-latest',
        'grok-2-vision-latest',
        'grok-beta'
    ],
    azure: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4'
    ],
    custom: []
};

const CALLER_FUNCTIONS = [
    { key: 'detect_intent_llm', label: 'Intent Detection & Ticket Classifier', desc: 'Analyzes customer emails to classify intent and decide ticket creation.' },
    { key: 'generate_reply_llm', label: 'AI Auto-Reply Generator', desc: 'Generates conversational, brand-aligned email resolutions.' },
    { key: 'design_payload', label: 'Tool & Action Payload Generator', desc: 'Constructs structured JSON payloads for third-party connector APIs.' },
    { key: 'scan_history_for_ticket', label: 'Historical Ticket Scanner', desc: 'Scans previous thread history to locate existing ticket IDs.' },
    { key: 'extract_issue_description', label: 'Issue Description Extractor', desc: 'Extracts clear problem summaries for ticket titles and CRM.' },
    { key: 'generate_summary_llm', label: 'Email Thread Summarizer', desc: 'Creates concise summaries of lengthy multi-turn email chains.' },
    { key: 'llm_score', label: 'Confidence & Sentiment Scorer', desc: 'Calculates response confidence and customer sentiment metrics.' }
];

export default function LlmConfigs() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

    const [activeTab, setActiveTab] = useState<'global_default' | 'globally_available' | 'client_configs'>('global_default');

    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: '', text: '' });

    // ==========================================
    // TAB 1: Global Default LLM (Single fallback row: global_default_llm)
    // ==========================================
    const [globalDefault, setGlobalDefault] = useState({
        provider: 'groq',
        api_key: '',
        base_url: 'https://api.groq.com/openai/v1',
        model_name: 'qwen/qwen3.6-27b',
        api_version: '',
        refreshed: null as string | null,
        is_override_active: false
    });
    const [savingGlobalDefault, setSavingGlobalDefault] = useState(false);
    const [refreshingGlobalDefault, setRefreshingGlobalDefault] = useState(false);
    const [showDefaultApiKey, setShowDefaultApiKey] = useState(false);
    const [globalDefaultFetchedModels, setGlobalDefaultFetchedModels] = useState<string[]>([]);
    const [globalDefaultSaveSuccess, setGlobalDefaultSaveSuccess] = useState(false);

    // Emergency Override Confirmation Modal State
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [pendingOverrideState, setPendingOverrideState] = useState(false);
    const [overrideUpdating, setOverrideUpdating] = useState(false);

    // ==========================================
    // TAB 2: Globally Available LLM Configs (globally_available_llm_configs)
    // ==========================================
    const [globallyAvailableConfigs, setGloballyAvailableConfigs] = useState<any[]>([]);
    const [availForm, setAvailForm] = useState({
        id: undefined as number | undefined,
        name: '',
        provider: 'groq',
        api_key: '',
        base_url: 'https://api.groq.com/openai/v1',
        model_name: '',
        api_version: ''
    });
    const [savingAvail, setSavingAvail] = useState(false);
    const [showAvailFormApiKey, setShowAvailFormApiKey] = useState(false);
    const [showApiKeyMap, setShowApiKeyMap] = useState<Record<number, boolean>>({});
    const [availFetchedModels, setAvailFetchedModels] = useState<string[]>([]);
    const [refreshingAvailForm, setRefreshingAvailForm] = useState(false);
    const [refreshingAvailId, setRefreshingAvailId] = useState<number | null>(null);
    const [availActiveModelsMap, setAvailActiveModelsMap] = useState<Record<number, string[]>>({});

    // ==========================================
    // TAB 3: Client LLM Configs State (client_llm_config)
    // ==========================================
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [clientConfigs, setClientConfigs] = useState<Record<string, any>>({});
    const [clientConfigLoading, setClientConfigLoading] = useState(false);
    const [clientSavingFn, setClientSavingFn] = useState<string | null>(null);
    const [clientSaveSuccess, setClientSaveSuccess] = useState<Record<string, boolean>>({});
    const [fnFetchedModels, setFnFetchedModels] = useState<Record<string, string[]>>({});
    const [fnFetchingModels, setFnFetchingModels] = useState<Record<string, boolean>>({});

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [accs, defLlm, availList] = await Promise.all([
                api.getAllEmailAccounts(),
                api.getGlobalDefaultLlm(),
                api.getGloballyAvailableLlmConfigs()
            ]);
            setAccounts(accs);
            if (defLlm) {
                setGlobalDefault({
                    provider: defLlm.provider || 'groq',
                    api_key: defLlm.api_key || '',
                    base_url: defLlm.base_url || 'https://api.groq.com/openai/v1',
                    model_name: defLlm.model_name || '',
                    api_version: defLlm.api_version || '',
                    refreshed: defLlm.refreshed || null,
                    is_override_active: !!defLlm.is_override_active
                });
            }
            setGloballyAvailableConfigs(availList || []);
            if (accs.length > 0 && !selectedClientId) {
                setSelectedClientId(accs[0].client_id);
            }
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    // Load client-specific configs when selected client changes
    useEffect(() => {
        if (selectedClientId) {
            loadClientConfigs(selectedClientId);
        }
    }, [selectedClientId]);

    const loadClientConfigs = async (clientId: string) => {
        setClientConfigLoading(true);
        try {
            const rows = await api.getClientLlmConfig(clientId);
            const map: Record<string, any> = {};
            rows.forEach((r: any) => {
                map[r.caller_function] = {
                    mode: r.provider && r.api_key ? 'custom' : 'global',
                    global_config_id: r.global_config_id || undefined,
                    provider: r.provider || 'groq',
                    api_key: r.api_key || '',
                    base_url: r.base_url || '',
                    model_name: r.model_name || '',
                    api_version: r.api_version || '',
                    updated_at: r.updated_at,
                    refreshed: r.refreshed
                };
            });
            setClientConfigs(map);
        } catch (err: any) {
            setMsg({ type: 'error', text: `Failed to load client LLM configurations: ${err.message}` });
        } finally {
            setClientConfigLoading(false);
        }
    };

    // ----------------------------------------------------
    // Tab 1: Global Default Handlers
    // ----------------------------------------------------
    const handleInitiateOverrideToggle = (targetState: boolean) => {
        setPendingOverrideState(targetState);
        setShowOverrideModal(true);
    };

    const handleConfirmOverrideToggle = async () => {
        setOverrideUpdating(true);
        try {
            await api.toggleGlobalLlmOverride(pendingOverrideState);
            setGlobalDefault(prev => ({ ...prev, is_override_active: pendingOverrideState }));
            setShowOverrideModal(false);
            setMsg({
                type: 'success',
                text: pendingOverrideState 
                    ? '🚨 Emergency Global LLM Override ACTIVATED. All client and template configs are now bypassed.'
                    : '✅ Emergency Global LLM Override DEACTIVATED. Normal client routing restored.'
            });
        } catch (err: any) {
            setMsg({ type: 'error', text: `Failed to toggle emergency override: ${err.message}` });
        } finally {
            setOverrideUpdating(false);
        }
    };

    const handleSaveGlobalDefault = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingGlobalDefault(true);
        setMsg({ type: '', text: '' });
        try {
            await api.setGlobalDefaultLlm({
                provider: globalDefault.provider,
                api_key: globalDefault.api_key,
                base_url: globalDefault.base_url || null,
                model_name: globalDefault.model_name,
                api_version: globalDefault.api_version || null
            });
            setGlobalDefaultSaveSuccess(true);
            setTimeout(() => setGlobalDefaultSaveSuccess(false), 3000);
            setMsg({ type: 'success', text: 'Global Default LLM saved successfully in global_default_llm.' });
            const defLlm = await api.getGlobalDefaultLlm();
            if (defLlm) {
                setGlobalDefault(prev => ({ 
                    ...prev, 
                    refreshed: defLlm.refreshed,
                    is_override_active: !!defLlm.is_override_active
                }));
            }
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSavingGlobalDefault(false);
        }
    };

    const handleRefreshGlobalDefault = async () => {
        if (!globalDefault.api_key?.trim()) {
            setMsg({ type: 'error', text: `Please enter an API key first to query live models for ${globalDefault.provider.toUpperCase()}.` });
            return;
        }
        setRefreshingGlobalDefault(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await api.fetchProviderModels({
                provider: globalDefault.provider,
                api_key: globalDefault.api_key.trim(),
                base_url: globalDefault.base_url?.trim() || undefined,
                api_version: globalDefault.api_version?.trim() || undefined
            });
            const models = res.models || [];
            if (models.length === 0) {
                setMsg({ type: 'error', text: `No active models returned by ${globalDefault.provider.toUpperCase()}.` });
                return;
            }
            setGlobalDefaultFetchedModels(models);
            setGlobalDefault(prev => ({
                ...prev,
                model_name: models.includes(prev.model_name) ? prev.model_name : models[0]
            }));
            setMsg({ type: 'success', text: `Refreshed Global Default LLM. Retrieved ${models.length} live models from ${globalDefault.provider.toUpperCase()}.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to refresh live models for Global Default LLM.' });
        } finally {
            setRefreshingGlobalDefault(false);
        }
    };

    // ----------------------------------------------------
    // Tab 2: Globally Available Pool Handlers
    // ----------------------------------------------------
    const handleRefreshAvailFormLive = async () => {
        if (!availForm.api_key?.trim()) {
            setMsg({ type: 'error', text: `Please enter an API key first to query live models for ${availForm.provider.toUpperCase()}.` });
            return;
        }
        setRefreshingAvailForm(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await api.fetchProviderModels({
                provider: availForm.provider,
                api_key: availForm.api_key.trim(),
                base_url: availForm.base_url?.trim() || undefined,
                api_version: availForm.api_version?.trim() || undefined
            });
            const models = res.models || [];
            if (models.length === 0) {
                setMsg({ type: 'error', text: `No active models returned by ${availForm.provider.toUpperCase()}.` });
                return;
            }
            setAvailFetchedModels(models);
            setAvailForm(prev => ({
                ...prev,
                model_name: models.includes(prev.model_name) ? prev.model_name : models[0]
            }));
            setMsg({ type: 'success', text: `Retrieved ${models.length} live models from ${availForm.provider.toUpperCase()}.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || `Failed to fetch live models for ${availForm.provider}` });
        } finally {
            setRefreshingAvailForm(false);
        }
    };
    const handleSaveGloballyAvailable = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingAvail(true);
        setMsg({ type: '', text: '' });
        try {
            await api.saveGloballyAvailableLlmConfig({
                id: availForm.id,
                name: availForm.name,
                provider: availForm.provider,
                api_key: availForm.api_key,
                base_url: availForm.base_url || null,
                model_name: availForm.model_name,
                api_version: availForm.api_version || null
            });
            setMsg({ type: 'success', text: `Configuration "${availForm.name}" saved successfully in globally_available_llm_configs.` });
            setAvailForm({
                id: undefined,
                name: '',
                provider: 'groq',
                api_key: '',
                base_url: 'https://api.groq.com/openai/v1',
                model_name: '',
                api_version: ''
            });
            setAvailFetchedModels([]);
            const list = await api.getGloballyAvailableLlmConfigs();
            setGloballyAvailableConfigs(list || []);
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setSavingAvail(false);
        }
    };

    const handleRefreshGloballyAvailable = async (configId: number) => {
        setRefreshingAvailId(configId);
        setMsg({ type: '', text: '' });
        try {
            const res = await api.refreshGloballyAvailableLlmConfig(configId);
            const modelsList = res.models || [];
            setAvailActiveModelsMap(prev => ({ ...prev, [configId]: modelsList }));
            setGloballyAvailableConfigs(prev => prev.map(c => c.id === configId ? { ...c, refreshed: res.refreshed } : c));
            setMsg({ type: 'success', text: `Refreshed "${res.name}". Retrieved ${res.count} live models from ${res.provider.toUpperCase()}.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to refresh configuration models.' });
        } finally {
            setRefreshingAvailId(null);
        }
    };

    const handleDeleteGloballyAvailable = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this globally available LLM template? Any client use case referencing it will fall back to Global Default.')) return;
        try {
            await api.deleteGloballyAvailableLlmConfig(id);
            setGloballyAvailableConfigs(prev => prev.filter(c => c.id !== id));
            setMsg({ type: 'success', text: 'Configuration deleted successfully.' });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        }
    };

    // ----------------------------------------------------
    // Tab 3: Client LLM Handlers
    // ----------------------------------------------------
    const handleRefreshClientFunction = async (fnKey: string) => {
        const state = clientConfigs[fnKey] || {};
        const isCustom = state.mode === 'custom';
        
        if (isCustom && !state.api_key?.trim()) {
            setMsg({ type: 'error', text: 'Enter an API key first to query models from this custom provider.' });
            return;
        }
        
        setFnFetchingModels(prev => ({ ...prev, [fnKey]: true }));
        setMsg({ type: '', text: '' });
        try {
            const res = await api.refreshClientLlmConfig({
                client_id: selectedClientId,
                caller_function: fnKey,
                global_config_id: isCustom ? null : (state.global_config_id || null),
                provider: isCustom ? state.provider : null,
                api_key: isCustom ? state.api_key : null,
                base_url: isCustom ? (state.base_url || null) : null,
                api_version: isCustom ? (state.api_version || null) : null
            });
            const list: string[] = res.models || [];
            setFnFetchedModels(prev => ({ ...prev, [fnKey]: list }));
            setClientConfigs(prev => ({
                ...prev,
                [fnKey]: {
                    ...prev[fnKey],
                    refreshed: res.refreshed,
                    model_name: prev[fnKey]?.model_name || (list.length > 0 ? list[0] : '')
                }
            }));
            if (res.global_config_id) {
                setGloballyAvailableConfigs(prev => prev.map(c => c.id === res.global_config_id ? { ...c, refreshed: res.refreshed } : c));
            } else if (!isCustom) {
                setGlobalDefault(prev => ({ ...prev, refreshed: res.refreshed }));
            }
            setMsg({ type: 'success', text: `Refreshed live models for ${fnKey}. Retrieved ${res.count} available models from ${res.provider.toUpperCase()}.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to refresh models for this function' });
        } finally {
            setFnFetchingModels(prev => ({ ...prev, [fnKey]: false }));
        }
    };

    const handleSaveClientFunctionConfig = async (fnKey: string) => {
        if (!selectedClientId) {
            setMsg({ type: 'error', text: 'Please select a client account first.' });
            return;
        }
        const state = clientConfigs[fnKey] || {};
        const isCustom = state.mode === 'custom';

        setClientSavingFn(fnKey);
        setMsg({ type: '', text: '' });
        try {
            const payload = {
                client_id: selectedClientId,
                caller_function: fnKey,
                model_name: state.model_name || '',
                global_config_id: isCustom ? null : (state.global_config_id ? parseInt(state.global_config_id) : null),
                provider: isCustom ? state.provider : null,
                api_key: isCustom ? state.api_key : null,
                base_url: isCustom ? (state.base_url || null) : null,
                api_version: isCustom ? (state.api_version || null) : null
            };

            await api.setClientLlmConfig(payload);
            setClientSaveSuccess(prev => ({ ...prev, [fnKey]: true }));
            setTimeout(() => {
                setClientSaveSuccess(prev => ({ ...prev, [fnKey]: false }));
            }, 3000);
            loadClientConfigs(selectedClientId);
            setMsg({ type: 'success', text: `Saved configuration for ${fnKey} successfully in client_llm_config.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || 'Failed to save client LLM config' });
        } finally {
            setClientSavingFn(null);
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
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2 text-foreground">
                        <Cpu className="w-6 h-6 text-primary" /> AI &amp; LLM Configuration
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">Manage the platform global default, pool of reusable provider templates, and per-client automation use cases.</p>
                </div>

                {/* 3-Tab Switcher */}
                <div className="flex items-center gap-1 win11-card p-1 rounded-lg shadow-2xs">
                    <button
                        onClick={() => setActiveTab('global_default')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'global_default'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Global Default LLM</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('globally_available')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'globally_available'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Globally Available Configs</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('client_configs')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'client_configs'
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Client LLM Configs</span>
                    </button>
                </div>
            </div>

            {/* Universal Direct Output Enforcement Banner */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5">
                <span className="text-base">🛡️</span>
                <span>
                    <strong>Universal Direct Output Enforcement:</strong> Reasoning &amp; Chain-of-Thought thinking modes are automatically suppressed across all providers to ensure clean, structured JSON parsing without markdown leaks.
                </span>
            </div>

            {msg.text && (
                <div className={`p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-medium ${msg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'}`}>
                    {msg.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    <span>{msg.text}</span>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 1: GLOBAL DEFAULT LLM (global_default_llm) */}
            {/* ========================================================================= */}
            {activeTab === 'global_default' && (
                <div className="space-y-4">
                    <div className="win11-card p-5 rounded-lg space-y-5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                            <div>
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                    <Globe className="w-4 h-4 text-primary" /> Platform Global Default LLM (`global_default_llm`)
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    This single configuration acts as the platform-wide fallback AI engine whenever a client has no explicit provider or template mapped.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {globalDefault.refreshed ? (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Refreshed: {globalDefault.refreshed}
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground italic bg-black/[0.04] dark:bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-black/[0.06] dark:border-white/[0.06]">
                                        Never refreshed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Emergency Global Override Control Card */}
                        <div className={`p-4 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            globalDefault.is_override_active
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
                                : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] text-muted-foreground'
                        }`}>
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg shrink-0 ${
                                    globalDefault.is_override_active
                                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                        : 'bg-black/[0.04] dark:bg-white/[0.08] text-muted-foreground border border-black/[0.06] dark:border-white/[0.08]'
                                }`}>
                                    {globalDefault.is_override_active ? <ShieldAlert className="w-4 h-4 animate-pulse text-rose-500" /> : <Shield className="w-4 h-4 text-muted-foreground" />}
                                </div>
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-foreground">Emergency Global Override</span>
                                        <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold border ${
                                            globalDefault.is_override_active
                                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30'
                                                : 'bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground border-black/[0.06] dark:border-white/[0.08]'
                                        }`}>
                                            {globalDefault.is_override_active ? '● ACTIVE — ENFORCING GLOBAL DEFAULT' : 'INACTIVE — NORMAL ROUTING'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                                        When enabled, forces the entire platform to execute all AI operations through this Global Default LLM, completely overriding per-client and template configurations during outages or emergencies.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleInitiateOverrideToggle(!globalDefault.is_override_active)}
                                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                    globalDefault.is_override_active
                                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20 ring-1 ring-rose-400/50'
                                        : 'bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-foreground border border-black/[0.08] dark:border-white/[0.08]'
                                }`}
                            >
                                {globalDefault.is_override_active ? (
                                    <>
                                        <ToggleRight className="w-4 h-4 text-white" />
                                        <span>Turn OFF Override</span>
                                    </>
                                ) : (
                                    <>
                                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                        <span>Turn ON Override</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <form onSubmit={handleSaveGlobalDefault} className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Provider Type</label>
                                <select
                                    value={globalDefault.provider}
                                    onChange={e => {
                                        const p = e.target.value;
                                        setGlobalDefault(prev => ({
                                            ...prev,
                                            provider: p,
                                            base_url: PROVIDER_DEFAULT_URLS[p] || '',
                                            model_name: PROVIDER_SAMPLE_MODELS[p]?.[0] || ''
                                        }));
                                        setGlobalDefaultFetchedModels([]);
                                    }}
                                    className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors cursor-pointer shadow-2xs"
                                >
                                    <option value="groq" className="bg-card text-foreground">Groq (Recommended Fast)</option>
                                    <option value="openai" className="bg-card text-foreground">OpenAI</option>
                                    <option value="claude" className="bg-card text-foreground">Claude (Anthropic)</option>
                                    <option value="gemini" className="bg-card text-foreground">Google Gemini</option>
                                    <option value="grok" className="bg-card text-foreground">xAI (Grok)</option>
                                    <option value="azure" className="bg-card text-foreground">Azure OpenAI</option>
                                    <option value="custom" className="bg-card text-foreground">Custom OpenAI Gateway</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Default API Key</label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showDefaultApiKey ? 'text' : 'password'}
                                        placeholder="API key for platform default"
                                        value={globalDefault.api_key}
                                        onChange={e => setGlobalDefault({ ...globalDefault, api_key: e.target.value })}
                                        className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors pr-10 shadow-2xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDefaultApiKey(!showDefaultApiKey)}
                                        className="absolute right-3 top-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        {showDefaultApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Default Model Selection</label>
                                    {globalDefaultFetchedModels.length > 0 && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            {globalDefaultFetchedModels.length} live models
                                        </span>
                                    )}
                                </div>
                                {(() => {
                                    const providerKey = globalDefault.provider || 'groq';
                                    const sampleModels = PROVIDER_SAMPLE_MODELS[providerKey] || [];
                                    const combined = Array.from(new Set([globalDefault.model_name, ...globalDefaultFetchedModels, ...sampleModels].filter(Boolean)));
                                    return (
                                        <div className="flex gap-2">
                                            <select
                                                value={globalDefault.model_name}
                                                onChange={e => setGlobalDefault({ ...globalDefault, model_name: e.target.value })}
                                                className="flex-1 min-w-0 bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors cursor-pointer shadow-2xs"
                                            >
                                                {globalDefaultFetchedModels.length > 0 ? (
                                                    <optgroup label={`Live Fetched Models (${globalDefaultFetchedModels.length})`} className="bg-card text-primary font-bold">
                                                        {globalDefaultFetchedModels.map(m => (
                                                            <option key={m} value={m} className="bg-card text-foreground">{m}</option>
                                                        ))}
                                                    </optgroup>
                                                ) : (
                                                    <optgroup label={`Available ${providerKey.toUpperCase()} Models`} className="bg-card text-muted-foreground font-semibold">
                                                        {combined.map(m => (
                                                            <option key={m} value={m} className="bg-card text-foreground">{m}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleRefreshGlobalDefault}
                                                disabled={refreshingGlobalDefault}
                                                title="Fetch live models directly from provider API"
                                                className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-2xs"
                                            >
                                                {refreshingGlobalDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                <span className="hidden sm:inline">Refresh</span>
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Base API URL</label>
                                <input
                                    type="text"
                                    placeholder="e.g. https://api.groq.com/openai/v1"
                                    value={globalDefault.base_url || ''}
                                    onChange={e => setGlobalDefault({ ...globalDefault, base_url: e.target.value })}
                                    className="bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-b-2 focus:border-b-primary transition-colors font-mono shadow-2xs"
                                />
                            </div>

                            <div className="flex items-end justify-end">
                                <button
                                    type="submit"
                                    disabled={savingGlobalDefault}
                                    className={`w-full py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                                        globalDefaultSaveSuccess 
                                            ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
                                    } disabled:opacity-50`}
                                >
                                    {savingGlobalDefault ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Saving Global Default...</span>
                                        </>
                                    ) : globalDefaultSaveSuccess ? (
                                        <>
                                            <Check className="w-4 h-4 font-bold" />
                                            <span>Saved Global Default!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Save Global Default</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: GLOBALLY AVAILABLE LLM CONFIGS (globally_available_llm_configs) */}
            {/* ========================================================================= */}
            {activeTab === 'globally_available' && (
                <div className="space-y-6">
                    {/* Add / Edit Form Panel */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                                    {availForm.id !== undefined ? '⚡ Edit Globally Available LLM Config Template' : '➕ Add Globally Available LLM Config Template'}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Define reusable provider integrations in `globally_available_llm_configs` that clients can reference across their use cases.
                                </p>
                            </div>
                            {availForm.id !== undefined && (
                                <button
                                    onClick={() => {
                                        setAvailForm({ id: undefined, name: '', provider: 'groq', api_key: '', base_url: 'https://api.groq.com/openai/v1', model_name: '', api_version: '' });
                                        setAvailFetchedModels([]);
                                    }}
                                    className="text-xs bg-white/10 hover:bg-white/20 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Cancel Edit
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSaveGloballyAvailable} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Friendly Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. My Fast Classifier, Production Claude"
                                    value={availForm.name}
                                    onChange={e => setAvailForm({ ...availForm, name: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Provider Type</label>
                                <select
                                    value={availForm.provider}
                                    onChange={e => {
                                        const p = e.target.value;
                                        setAvailForm(prev => ({
                                            ...prev,
                                            provider: p,
                                            base_url: PROVIDER_DEFAULT_URLS[p] || '',
                                            model_name: PROVIDER_SAMPLE_MODELS[p]?.[0] || ''
                                        }));
                                        setAvailFetchedModels([]);
                                    }}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                                >
                                    <option value="groq" className="bg-zinc-900 text-white">Groq</option>
                                    <option value="openai" className="bg-zinc-900 text-white">OpenAI</option>
                                    <option value="claude" className="bg-zinc-900 text-white">Claude (Anthropic)</option>
                                    <option value="gemini" className="bg-zinc-900 text-white">Google Gemini</option>
                                    <option value="grok" className="bg-zinc-900 text-white">xAI (Grok)</option>
                                    <option value="azure" className="bg-zinc-900 text-white">Azure OpenAI</option>
                                    <option value="custom" className="bg-zinc-900 text-white">Custom OpenAI Gateway</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">API Key</label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showAvailFormApiKey ? 'text' : 'password'}
                                        placeholder="Provider API key"
                                        value={availForm.api_key}
                                        onChange={e => setAvailForm({ ...availForm, api_key: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowAvailFormApiKey(!showAvailFormApiKey)}
                                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-white transition-colors"
                                    >
                                        {showAvailFormApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase">Default Model</label>
                                    {availFetchedModels.length > 0 && (
                                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            {availFetchedModels.length} live models
                                        </span>
                                    )}
                                </div>
                                {(() => {
                                    const providerKey = availForm.provider || 'groq';
                                    const sampleModels = PROVIDER_SAMPLE_MODELS[providerKey] || [];
                                    const combined = Array.from(new Set([availForm.model_name, ...availFetchedModels, ...sampleModels].filter(Boolean)));
                                    return (
                                        <div className="flex gap-2">
                                            <select
                                                value={availForm.model_name}
                                                onChange={e => setAvailForm({ ...availForm, model_name: e.target.value })}
                                                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                                            >
                                                {availFetchedModels.length > 0 ? (
                                                    <optgroup label={`Live Fetched Models (${availFetchedModels.length})`} className="bg-zinc-900 text-primary font-bold">
                                                        {availFetchedModels.map(m => (
                                                            <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                        ))}
                                                    </optgroup>
                                                ) : (
                                                    <optgroup label={`Available ${providerKey.toUpperCase()} Models`} className="bg-zinc-900 text-zinc-300 font-semibold">
                                                        {combined.map(m => (
                                                            <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleRefreshAvailFormLive}
                                                disabled={refreshingAvailForm}
                                                title="Fetch live models directly from provider API"
                                                className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                            >
                                                {refreshingAvailForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                <span className="hidden sm:inline">Refresh</span>
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex flex-col gap-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Base API URL</label>
                                <input
                                    type="text"
                                    placeholder="e.g. https://api.groq.com/openai/v1"
                                    value={availForm.base_url || ''}
                                    onChange={e => setAvailForm({ ...availForm, base_url: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors font-mono text-xs"
                                />
                            </div>

                            <div className="flex items-end justify-end md:col-span-3">
                                <button
                                    type="submit"
                                    disabled={savingAvail}
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {savingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>{availForm.id !== undefined ? 'Update Configuration' : 'Save New Configuration'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Existing Pool List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" /> Active Globally Available Templates ({globallyAvailableConfigs.length})
                        </h4>

                        {globallyAvailableConfigs.length === 0 ? (
                            <div className="p-8 text-center glass-panel rounded-2xl border border-white/5 text-muted-foreground text-sm">
                                No globally available LLM templates created yet. Add one above to allow clients to use it.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {globallyAvailableConfigs.map(c => {
                                    const isRefreshing = refreshingAvailId === c.id;
                                    const isKeyVisible = showApiKeyMap[c.id];
                                    return (
                                        <div key={c.id} className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white text-base">{c.name}</span>
                                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary uppercase font-bold">
                                                                {c.provider}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">Model: <strong className="text-zinc-200">{c.model_name}</strong></p>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setAvailForm({
                                                                    id: c.id,
                                                                    name: c.name,
                                                                    provider: c.provider,
                                                                    api_key: c.api_key,
                                                                    base_url: c.base_url || '',
                                                                    model_name: c.model_name || '',
                                                                    api_version: c.api_version || ''
                                                                });
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteGloballyAvailable(c.id)}
                                                            className="p-1.5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1.5 text-xs font-mono">
                                                    <div className="flex items-center justify-between text-zinc-400">
                                                        <span>API Key:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-zinc-200">
                                                                {isKeyVisible ? c.api_key : `${c.api_key?.substring(0, 7)}••••••••`}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowApiKeyMap(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                                                className="text-zinc-500 hover:text-zinc-300"
                                                            >
                                                                {isKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between text-zinc-400 text-[11px] truncate">
                                                        <span>Base URL:</span>
                                                        <span className="text-zinc-300 truncate max-w-[180px]">{c.base_url || 'Default Provider URL'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                                                {c.refreshed ? (
                                                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                        {c.refreshed}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-zinc-500 italic">Never refreshed</span>
                                                )}

                                                <button
                                                    onClick={() => handleRefreshGloballyAvailable(c.id)}
                                                    disabled={isRefreshing}
                                                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                                >
                                                    {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                    <span>Refresh</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: CLIENT LLM CONFIGS (client_llm_config) */}
            {/* ========================================================================= */}
            {activeTab === 'client_configs' && (
                <div className="space-y-6">
                    {/* Client Selection Bar */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Select Target Client</h3>
                                <p className="text-xs text-muted-foreground">Configure AI engine parameters per use-case (stored in <code className="text-primary font-mono">client_llm_config</code>).</p>
                            </div>
                        </div>

                        <select
                            value={selectedClientId}
                            onChange={e => setSelectedClientId(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors min-w-[280px]"
                        >
                            {accounts.map(a => (
                                <option key={a.client_id} value={a.client_id} className="bg-zinc-900 text-white">
                                    {a.account_name} ({a.client_id})
                                </option>
                            ))}
                        </select>
                    </div>

                    {clientConfigLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-primary" /> Use-Case AI Engine Mappings ({CALLER_FUNCTIONS.length})
                                </h4>
                                <span className="text-xs text-muted-foreground font-mono">Client ID: {selectedClientId}</span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {CALLER_FUNCTIONS.map(fn => {
                                    const cfg = clientConfigs[fn.key] || {
                                        mode: 'global',
                                        global_config_id: undefined,
                                        provider: 'groq',
                                        api_key: '',
                                        base_url: '',
                                        model_name: '',
                                        api_version: ''
                                    };
                                    const isSaving = clientSavingFn === fn.key;
                                    const isSaved = clientSaveSuccess[fn.key];
                                    const isCustomMode = cfg.mode === 'custom';

                                    return (
                                        <div key={fn.key} className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-bold text-white text-sm">{fn.label}</span>
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                                                            {fn.key}
                                                        </span>
                                                        {cfg.refreshed ? (
                                                            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                Refreshed: {cfg.refreshed}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-zinc-500 italic bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                                                Never refreshed
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{fn.desc}</p>
                                                </div>

                                                {/* Mode Toggle: Global Inherit vs Custom Provider */}
                                                <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setClientConfigs(prev => ({
                                                            ...prev,
                                                            [fn.key]: { ...prev[fn.key], mode: 'global' }
                                                        }))}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                            !isCustomMode
                                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                                : 'text-zinc-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <Globe className="w-3.5 h-3.5" />
                                                        <span>Global Provider</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setClientConfigs(prev => ({
                                                            ...prev,
                                                            [fn.key]: { ...prev[fn.key], mode: 'custom' }
                                                        }))}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                            isCustomMode
                                                                ? 'bg-purple-600 text-white shadow-sm'
                                                                : 'text-zinc-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        <span>Custom Provider</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mode A: Global Provider Reference */}
                                            {!isCustomMode ? (() => {
                                                const selectedTemplate = globallyAvailableConfigs.find(c => c.id === cfg.global_config_id);
                                                const liveModels = fnFetchedModels[fn.key] || (cfg.global_config_id ? availActiveModelsMap[cfg.global_config_id] : []) || (selectedTemplate ? [] : globalDefaultFetchedModels);
                                                const providerKey = selectedTemplate?.provider || globalDefault.provider || 'groq';
                                                const suggestedModels = PROVIDER_SAMPLE_MODELS[providerKey] || [];
                                                const defaultFallbackModel = selectedTemplate?.model_name || globalDefault.model_name || 'qwen/qwen3.6-27b';
                                                const availableOptions = Array.from(new Set([defaultFallbackModel, cfg.model_name, ...liveModels, ...suggestedModels].filter(Boolean) as string[]));

                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-bold text-zinc-400 uppercase">Referenced Provider Integration</label>
                                                            <select
                                                                value={cfg.global_config_id || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                                                                    const sel = globallyAvailableConfigs.find(c => c.id === val);
                                                                    setClientConfigs(prev => ({
                                                                        ...prev,
                                                                        [fn.key]: {
                                                                            ...prev[fn.key],
                                                                            global_config_id: val,
                                                                            model_name: sel?.model_name || ''
                                                                        }
                                                                    }));
                                                                }}
                                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                                                            >
                                                                <option value="" className="bg-zinc-900 text-zinc-300 font-bold">
                                                                    🌐 Default Global LLM Fallback ({globalDefault.provider.toUpperCase()} - {globalDefault.model_name})
                                                                </option>
                                                                {globallyAvailableConfigs.length > 0 && (
                                                                    <optgroup label="Globally Available Templates" className="bg-zinc-900 text-zinc-400 font-semibold">
                                                                        {globallyAvailableConfigs.map(c => (
                                                                            <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                                                                                📦 {c.name} ({c.provider.toUpperCase()} - {c.model_name})
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                )}
                                                            </select>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Model Name Selection</label>
                                                                {liveModels.length > 0 && (
                                                                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                        {liveModels.length} live models
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <select
                                                                    value={cfg.model_name || ''}
                                                                    onChange={e => setClientConfigs(prev => ({
                                                                        ...prev,
                                                                        [fn.key]: { ...prev[fn.key], model_name: e.target.value }
                                                                    }))}
                                                                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                                                                >
                                                                    <option value="" className="bg-zinc-900 text-zinc-400">
                                                                        🌐 (use provider default: {defaultFallbackModel})
                                                                    </option>
                                                                    {liveModels.length > 0 ? (
                                                                        <optgroup label={`Live Fetched Models (${liveModels.length})`} className="bg-zinc-900 text-primary font-bold">
                                                                            {liveModels.map(m => (
                                                                                <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ) : (
                                                                        <optgroup label={`Available ${providerKey.toUpperCase()} Models`} className="bg-zinc-900 text-zinc-300 font-semibold">
                                                                            {availableOptions.map(m => (
                                                                                <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    )}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRefreshClientFunction(fn.key)}
                                                                    disabled={fnFetchingModels[fn.key]}
                                                                    title="Fetch live models from referenced provider"
                                                                    className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                                                >
                                                                    {fnFetchingModels[fn.key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                                    <span className="hidden sm:inline">Refresh</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })() : (() => {
                                                /* Mode B: Dedicated Custom Provider */
                                                const customLiveModels = fnFetchedModels[fn.key] || [];
                                                const customProviderKey = cfg.provider || 'groq';
                                                const customSuggested = PROVIDER_SAMPLE_MODELS[customProviderKey] || [];
                                                const customOptions = Array.from(new Set([cfg.model_name, ...customLiveModels, ...customSuggested].filter(Boolean) as string[]));

                                                return (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-bold text-purple-300 uppercase">Provider Type</label>
                                                            <select
                                                                value={cfg.provider || 'groq'}
                                                                onChange={e => {
                                                                    const p = e.target.value;
                                                                    setClientConfigs(prev => ({
                                                                        ...prev,
                                                                        [fn.key]: {
                                                                            ...prev[fn.key],
                                                                            provider: p,
                                                                            base_url: PROVIDER_DEFAULT_URLS[p] || '',
                                                                            model_name: PROVIDER_SAMPLE_MODELS[p]?.[0] || ''
                                                                        }
                                                                    }));
                                                                }}
                                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                                                            >
                                                                <option value="groq" className="bg-zinc-900 text-white">Groq</option>
                                                                <option value="openai" className="bg-zinc-900 text-white">OpenAI</option>
                                                                <option value="claude" className="bg-zinc-900 text-white">Claude (Anthropic)</option>
                                                                <option value="gemini" className="bg-zinc-900 text-white">Google Gemini</option>
                                                                <option value="grok" className="bg-zinc-900 text-white">xAI (Grok)</option>
                                                                <option value="azure" className="bg-zinc-900 text-white">Azure OpenAI</option>
                                                                <option value="custom" className="bg-zinc-900 text-white">Custom OpenAI Gateway</option>
                                                            </select>
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-bold text-purple-300 uppercase">Custom API Key</label>
                                                            <input
                                                                type="password"
                                                                placeholder="Client-specific API key"
                                                                value={cfg.api_key || ''}
                                                                onChange={e => setClientConfigs(prev => ({
                                                                    ...prev,
                                                                    [fn.key]: { ...prev[fn.key], api_key: e.target.value }
                                                                }))}
                                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors"
                                                            />
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] font-bold text-purple-300 uppercase">Model Name</label>
                                                                {customLiveModels.length > 0 && (
                                                                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                        {customLiveModels.length} live models
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <select
                                                                    value={cfg.model_name || ''}
                                                                    onChange={e => setClientConfigs(prev => ({
                                                                        ...prev,
                                                                        [fn.key]: { ...prev[fn.key], model_name: e.target.value }
                                                                    }))}
                                                                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white bg-zinc-900 focus:outline-none focus:border-primary transition-colors"
                                                                >
                                                                    <option value="" disabled className="bg-zinc-900 text-zinc-400">-- Select Model --</option>
                                                                    {customLiveModels.length > 0 ? (
                                                                        <optgroup label={`Live Fetched Models (${customLiveModels.length})`} className="bg-zinc-900 text-primary font-bold">
                                                                            {customLiveModels.map(m => (
                                                                                <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ) : (
                                                                        <optgroup label={`Available ${customProviderKey.toUpperCase()} Models`} className="bg-zinc-900 text-zinc-300 font-semibold">
                                                                            {customOptions.map(m => (
                                                                                <option key={m} value={m} className="bg-zinc-900 text-white">{m}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    )}
                                                                </select>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRefreshClientFunction(fn.key)}
                                                                    disabled={fnFetchingModels[fn.key]}
                                                                    title="Fetch live models from custom provider"
                                                                    className="px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                                                >
                                                                    {fnFetchingModels[fn.key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                                    <span className="hidden sm:inline">Refresh</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Save Button for Function */}
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveClientFunctionConfig(fn.key)}
                                                    disabled={isSaving}
                                                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                                                        isSaved
                                                            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                            : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
                                                    } disabled:opacity-50`}
                                                >
                                                    {isSaving ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Saving...</span>
                                                        </>
                                                    ) : isSaved ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 font-bold" />
                                                            <span>Saved Configuration!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="w-3.5 h-3.5" />
                                                            <span>Save for {fn.label}</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Emergency Global Override Confirmation & Warning Modal */}
            {showOverrideModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`bg-white dark:bg-zinc-900 border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 ${
                        pendingOverrideState ? 'border-rose-500/40' : 'border-blue-500/40'
                    }`}>
                        <div className="flex items-start gap-3.5">
                            <div className={`p-3 rounded-xl shrink-0 border ${
                                pendingOverrideState 
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400' 
                                    : 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400'
                            }`}>
                                {pendingOverrideState ? <AlertTriangle className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {pendingOverrideState ? 'Activate Emergency Global Override?' : 'Restore Normal LLM Routing?'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {pendingOverrideState
                                        ? 'You are about to enforce platform-wide override using Global Default LLM.'
                                        : 'You are disabling the platform-wide override to return to standard priority routing.'}
                                </p>
                            </div>
                        </div>

                        <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                            pendingOverrideState 
                                ? 'bg-rose-500/5 border-rose-500/20 text-zinc-700 dark:text-zinc-300' 
                                : 'bg-blue-500/5 border-blue-500/20 text-zinc-700 dark:text-zinc-300'
                        }`}>
                            {pendingOverrideState ? (
                                <>
                                    <div className="font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                                        <AlertCircle className="w-4 h-4" />
                                        CRITICAL SYSTEM IMPACT:
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                                        Enabling this will <strong>immediately bypass all client-specific custom models, API credentials, and template mappings</strong> across all mailboxes. Every incoming email and AI agent operation will be forced through <strong>{globalDefault.provider.toUpperCase()} ({globalDefault.model_name})</strong>.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="font-semibold text-blue-500 dark:text-blue-400 flex items-center gap-1.5">
                                        <Check className="w-4 h-4" />
                                        ROUTING RESTORATION:
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                                        Disabling this will re-enable per-client custom provider credentials and mapped template configurations according to client specific rules.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowOverrideModal(false)}
                                disabled={overrideUpdating}
                                className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmOverrideToggle}
                                disabled={overrideUpdating}
                                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                                    pendingOverrideState
                                        ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                                        : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                                }`}
                            >
                                {overrideUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>{pendingOverrideState ? 'Yes, Enforce Global Override' : 'Yes, Restore Normal Routing'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
