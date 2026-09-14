import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { 
  Loader2,
  CheckCircle,
  XCircle,
  Cpu,
  Globe,
  Users,
  Layers,
} from 'lucide-react';
import {
  GlobalDefaultState,
  GloballyAvailableConfig,
  AvailFormState,
  ClientConfigsMap,
  GlobalDefaultTab,
  GloballyAvailableTab,
  ClientConfigsTab,
  OverrideConfirmModal,
} from '@/components/llm-configs';

export default function LlmConfigs() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const [activeTab, setActiveTab] = useState<'global_default' | 'globally_available' | 'client_configs'>('global_default');

  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // ==========================================
  // TAB 1: Global Default LLM (global_default_llm)
  // ==========================================
  const [globalDefault, setGlobalDefault] = useState<GlobalDefaultState>({
    provider: 'groq',
    api_key: '',
    base_url: 'https://api.groq.com/openai/v1',
    model_name: 'qwen/qwen3.6-27b',
    api_version: '',
    refreshed: null,
    is_override_active: false,
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
  // TAB 2: Globally Available LLM Configs
  // ==========================================
  const [globallyAvailableConfigs, setGloballyAvailableConfigs] = useState<GloballyAvailableConfig[]>([]);
  const [availForm, setAvailForm] = useState<AvailFormState>({
    id: undefined,
    name: '',
    provider: 'groq',
    api_key: '',
    base_url: 'https://api.groq.com/openai/v1',
    model_name: '',
    api_version: '',
  });
  const [savingAvail, setSavingAvail] = useState(false);
  const [showAvailFormApiKey, setShowAvailFormApiKey] = useState(false);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<number, boolean>>({});
  const [availFetchedModels, setAvailFetchedModels] = useState<string[]>([]);
  const [refreshingAvailForm, setRefreshingAvailForm] = useState(false);
  const [refreshingAvailId, setRefreshingAvailId] = useState<number | null>(null);
  const [availActiveModelsMap, setAvailActiveModelsMap] = useState<Record<number, string[]>>({});

  // ==========================================
  // TAB 3: Client LLM Configs (client_llm_config)
  // ==========================================
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientConfigs, setClientConfigs] = useState<ClientConfigsMap>({});
  const [clientConfigLoading, setClientConfigLoading] = useState(false);
  const [clientSavingFn, setClientSavingFn] = useState<string | null>(null);
  const [clientSaveSuccess, setClientSaveSuccess] = useState<Record<string, boolean>>({});
  const [fnFetchedModels, setFnFetchedModels] = useState<Record<string, string[]>>({});
  const [fnFetchingModels, setFnFetchingModels] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [accs, defLlm, availList] = await Promise.all([
        api.getAllEmailAccounts(),
        api.getGlobalDefaultLlm(),
        api.getGloballyAvailableLlmConfigs(),
      ]);
      setAccounts(accs || []);
      if (defLlm) {
        setGlobalDefault({
          provider: defLlm.provider || 'groq',
          api_key: defLlm.api_key || '',
          base_url: defLlm.base_url || 'https://api.groq.com/openai/v1',
          model_name: defLlm.model_name || '',
          api_version: defLlm.api_version || '',
          refreshed: defLlm.refreshed || null,
          is_override_active: !!defLlm.is_override_active,
        });
      }
      setGloballyAvailableConfigs(availList || []);
      if (accs && accs.length > 0 && !selectedClientId) {
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
      const map: ClientConfigsMap = {};
      (rows || []).forEach((r: any) => {
        map[r.caller_function] = {
          mode: r.provider && r.api_key ? 'custom' : 'global',
          global_config_id: r.global_config_id || undefined,
          provider: r.provider || 'groq',
          api_key: r.api_key || '',
          base_url: r.base_url || '',
          model_name: r.model_name || '',
          api_version: r.api_version || '',
          updated_at: r.updated_at,
          refreshed: r.refreshed,
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
      setGlobalDefault((prev) => ({ ...prev, is_override_active: pendingOverrideState }));
      setShowOverrideModal(false);
      setMsg({
        type: 'success',
        text: pendingOverrideState 
          ? '🚨 Emergency Global LLM Override ACTIVATED. All client and template configs are now bypassed.'
          : '✅ Emergency Global LLM Override DEACTIVATED. Normal client routing restored.',
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
        api_version: globalDefault.api_version || null,
      });
      setGlobalDefaultSaveSuccess(true);
      setTimeout(() => setGlobalDefaultSaveSuccess(false), 3000);
      setMsg({ type: 'success', text: 'Global Default LLM saved successfully in global_default_llm.' });
      const defLlm = await api.getGlobalDefaultLlm();
      if (defLlm) {
        setGlobalDefault((prev) => ({ 
          ...prev, 
          refreshed: defLlm.refreshed,
          is_override_active: !!defLlm.is_override_active,
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
        api_version: globalDefault.api_version?.trim() || undefined,
      });
      const models = res.models || [];
      if (models.length === 0) {
        setMsg({ type: 'error', text: `No active models returned by ${globalDefault.provider.toUpperCase()}.` });
        return;
      }
      setGlobalDefaultFetchedModels(models);
      setGlobalDefault((prev) => ({
        ...prev,
        model_name: models.includes(prev.model_name) ? prev.model_name : models[0],
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
        api_version: availForm.api_version?.trim() || undefined,
      });
      const models = res.models || [];
      if (models.length === 0) {
        setMsg({ type: 'error', text: `No active models returned by ${availForm.provider.toUpperCase()}.` });
        return;
      }
      setAvailFetchedModels(models);
      setAvailForm((prev) => ({
        ...prev,
        model_name: models.includes(prev.model_name) ? prev.model_name : models[0],
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
        api_version: availForm.api_version || null,
      });
      setMsg({ type: 'success', text: `Configuration "${availForm.name}" saved successfully in globally_available_llm_configs.` });
      setAvailForm({
        id: undefined,
        name: '',
        provider: 'groq',
        api_key: '',
        base_url: 'https://api.groq.com/openai/v1',
        model_name: '',
        api_version: '',
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
      setAvailActiveModelsMap((prev) => ({ ...prev, [configId]: modelsList }));
      setGloballyAvailableConfigs((prev) =>
        prev.map((c) => (c.id === configId ? { ...c, refreshed: res.refreshed } : c))
      );
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
      setGloballyAvailableConfigs((prev) => prev.filter((c) => c.id !== id));
      setMsg({ type: 'success', text: 'Configuration deleted successfully.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleEditGloballyAvailable = (config: GloballyAvailableConfig) => {
    setAvailForm({
      id: config.id,
      name: config.name,
      provider: config.provider,
      api_key: config.api_key,
      base_url: config.base_url || '',
      model_name: config.model_name || '',
      api_version: config.api_version || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelAvailEdit = () => {
    setAvailForm({
      id: undefined,
      name: '',
      provider: 'groq',
      api_key: '',
      base_url: 'https://api.groq.com/openai/v1',
      model_name: '',
      api_version: '',
    });
    setAvailFetchedModels([]);
  };

  // ----------------------------------------------------
  // Tab 3: Client LLM Handlers
  // ----------------------------------------------------
  const handleRefreshClientFunction = async (fnKey: string) => {
    const state = clientConfigs[fnKey] || {
      mode: 'global',
      global_config_id: undefined,
      provider: 'groq',
      api_key: '',
      base_url: '',
      model_name: '',
      api_version: '',
    };
    const isCustom = state.mode === 'custom';
    
    if (isCustom && !state.api_key?.trim()) {
      setMsg({ type: 'error', text: 'Enter an API key first to query models from this custom provider.' });
      return;
    }
    
    setFnFetchingModels((prev) => ({ ...prev, [fnKey]: true }));
    setMsg({ type: '', text: '' });
    try {
      const res = await api.refreshClientLlmConfig({
        client_id: selectedClientId,
        caller_function: fnKey,
        global_config_id: isCustom ? null : (state.global_config_id || null),
        provider: isCustom ? state.provider : null,
        api_key: isCustom ? state.api_key : null,
        base_url: isCustom ? (state.base_url || null) : null,
        api_version: isCustom ? (state.api_version || null) : null,
      });
      const list: string[] = res.models || [];
      setFnFetchedModels((prev) => ({ ...prev, [fnKey]: list }));
      setClientConfigs((prev) => ({
        ...prev,
        [fnKey]: {
          ...prev[fnKey],
          refreshed: res.refreshed,
          model_name: prev[fnKey]?.model_name || (list.length > 0 ? list[0] : ''),
        },
      }));
      if (res.global_config_id) {
        setGloballyAvailableConfigs((prev) =>
          prev.map((c) => (c.id === res.global_config_id ? { ...c, refreshed: res.refreshed } : c))
        );
      } else if (!isCustom) {
        setGlobalDefault((prev) => ({ ...prev, refreshed: res.refreshed }));
      }
      setMsg({ type: 'success', text: `Refreshed live models for ${fnKey}. Retrieved ${res.count} available models from ${res.provider.toUpperCase()}.` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to refresh models for this function' });
    } finally {
      setFnFetchingModels((prev) => ({ ...prev, [fnKey]: false }));
    }
  };

  const handleSaveClientFunctionConfig = async (fnKey: string) => {
    if (!selectedClientId) {
      setMsg({ type: 'error', text: 'Please select a client account first.' });
      return;
    }
    const state = clientConfigs[fnKey] || {
      mode: 'global',
      global_config_id: undefined,
      provider: 'groq',
      api_key: '',
      base_url: '',
      model_name: '',
      api_version: '',
    };
    const isCustom = state.mode === 'custom';

    setClientSavingFn(fnKey);
    setMsg({ type: '', text: '' });
    try {
      const payload = {
        client_id: selectedClientId,
        caller_function: fnKey,
        model_name: state.model_name || '',
        global_config_id: isCustom ? null : (state.global_config_id ? Number(state.global_config_id) : null),
        provider: isCustom ? state.provider : null,
        api_key: isCustom ? state.api_key : null,
        base_url: isCustom ? (state.base_url || null) : null,
        api_version: isCustom ? (state.api_version || null) : null,
      };

      await api.setClientLlmConfig(payload);
      setClientSaveSuccess((prev) => ({ ...prev, [fnKey]: true }));
      setTimeout(() => {
        setClientSaveSuccess((prev) => ({ ...prev, [fnKey]: false }));
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
          <p className="text-xs text-muted-foreground mt-1">
            Manage the platform global default, pool of reusable provider templates, and per-client automation use cases.
          </p>
        </div>

        {/* 3-Tab Switcher */}
        <div className="flex items-center gap-1 win11-card p-1 rounded-lg shadow-2xs">
          <button
            type="button"
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
            type="button"
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
            type="button"
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
        <div
          className={`p-3.5 rounded-lg border flex items-center gap-2.5 text-xs font-medium ${
            msg.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
          }`}
        >
          {msg.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* TAB 1: Global Default LLM */}
      {activeTab === 'global_default' && (
        <GlobalDefaultTab
          globalDefault={globalDefault}
          setGlobalDefault={setGlobalDefault}
          savingGlobalDefault={savingGlobalDefault}
          refreshingGlobalDefault={refreshingGlobalDefault}
          showDefaultApiKey={showDefaultApiKey}
          setShowDefaultApiKey={setShowDefaultApiKey}
          globalDefaultFetchedModels={globalDefaultFetchedModels}
          setGlobalDefaultFetchedModels={setGlobalDefaultFetchedModels}
          globalDefaultSaveSuccess={globalDefaultSaveSuccess}
          onSave={handleSaveGlobalDefault}
          onRefresh={handleRefreshGlobalDefault}
          onInitiateOverrideToggle={handleInitiateOverrideToggle}
        />
      )}

      {/* TAB 2: Globally Available Configs */}
      {activeTab === 'globally_available' && (
        <GloballyAvailableTab
          availForm={availForm}
          setAvailForm={setAvailForm}
          savingAvail={savingAvail}
          showAvailFormApiKey={showAvailFormApiKey}
          setShowAvailFormApiKey={setShowAvailFormApiKey}
          availFetchedModels={availFetchedModels}
          setAvailFetchedModels={setAvailFetchedModels}
          refreshingAvailForm={refreshingAvailForm}
          globallyAvailableConfigs={globallyAvailableConfigs}
          refreshingAvailId={refreshingAvailId}
          showApiKeyMap={showApiKeyMap}
          setShowApiKeyMap={setShowApiKeyMap}
          onSave={handleSaveGloballyAvailable}
          onRefreshAvailForm={handleRefreshAvailFormLive}
          onRefreshConfig={handleRefreshGloballyAvailable}
          onDeleteConfig={handleDeleteGloballyAvailable}
          onCancelEdit={handleCancelAvailEdit}
          onEditConfig={handleEditGloballyAvailable}
        />
      )}

      {/* TAB 3: Client LLM Configs */}
      {activeTab === 'client_configs' && (
        <ClientConfigsTab
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          accounts={accounts}
          clientConfigLoading={clientConfigLoading}
          clientConfigs={clientConfigs}
          setClientConfigs={setClientConfigs}
          clientSavingFn={clientSavingFn}
          clientSaveSuccess={clientSaveSuccess}
          fnFetchedModels={fnFetchedModels}
          fnFetchingModels={fnFetchingModels}
          globallyAvailableConfigs={globallyAvailableConfigs}
          globalDefault={globalDefault}
          globalDefaultFetchedModels={globalDefaultFetchedModels}
          availActiveModelsMap={availActiveModelsMap}
          onSaveFunctionConfig={handleSaveClientFunctionConfig}
          onRefreshFunction={handleRefreshClientFunction}
        />
      )}

      {/* Emergency Global Override Modal */}
      <OverrideConfirmModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        pendingOverrideState={pendingOverrideState}
        overrideUpdating={overrideUpdating}
        onConfirm={handleConfirmOverrideToggle}
        globalDefaultProvider={globalDefault.provider}
        globalDefaultModel={globalDefault.model_name}
      />
    </div>
  );
}
