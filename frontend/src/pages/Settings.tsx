import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Loader2, 
  AlertCircle, 
  Building2, 
  ShieldAlert, 
  Sparkles,
  Gauge,
  FileSignature,
  FileText,
  ArrowLeft,
  Bot,
  Power
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  FeaturesState,
  MasterBotStatus,
  KillSwitchAction,
  DisclaimerItem,
  GeneralTab,
  PauseDraftTab,
  FeaturesTab,
  SignoffTab,
  ModerationTab,
  DisclaimersTab,
  ConfirmGlobalModal,
  ConfirmAutoSendModal,
  ConfirmKillSwitchModal,
} from '@/components/settings';
import { FluentHeroCard, SettingsCard, SettingsRow } from '@/components/fluent';

export default function Settings() {
  const [threshold, setThreshold] = useState(80);
  const [tone, setTone] = useState('Formal');
  const [agentType, setAgentType] = useState('customer_support');
  const [companyName, setCompanyName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'general' | 'pause_draft' | 'features' | 'signoff' | 'moderation' | 'disclaimers' | null>(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam && ['general', 'pause_draft', 'features', 'signoff', 'moderation', 'disclaimers'].includes(tabParam)) {
      return tabParam as any;
    }
    return null;
  });
  
  // Feature Flags States
  const [features, setFeatures] = useState<FeaturesState>({
    feature_ticket_creation: true,
    feature_auto_send: true,
    feature_rag: true,
    feature_order_tracking: true,
    feature_manual_reply: true,
    feature_strip_disclaimers: true,
  });
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [stripDisclaimerToggling, setStripDisclaimerToggling] = useState(false);
  const [pendingAutoSendTarget, setPendingAutoSendTarget] = useState<boolean | null>(null);
  const [toggleAutoSendLoading, setToggleAutoSendLoading] = useState(false);

  // Keyword Moderation States
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Disclaimer Configuration States
  const [disclaimers, setDisclaimers] = useState<DisclaimerItem[]>([]);
  const [newDisclaimerText, setNewDisclaimerText] = useState('');
  const [disclaimerLoading, setDisclaimerLoading] = useState(false);
  const [disclaimerSaving, setDisclaimerSaving] = useState(false);

  // Marketing & Promotional Senders States
  const [marketingSenders, setMarketingSenders] = useState<string[]>([]);
  const [newMarketingSender, setNewMarketingSender] = useState('');
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingSaving, setMarketingSaving] = useState(false);

  // Master Bot Flow Control States
  const [masterBotStatus, setMasterBotStatus] = useState<MasterBotStatus>({
    admin_bot_enabled: true,
    client_bot_enabled: true,
    is_effective_enabled: true,
    is_locked_by_admin: false,
  });
  const [masterBotLoading, setMasterBotLoading] = useState(false);
  const [masterBotToggling, setMasterBotToggling] = useState(false);

  // Kill Switch Double Confirmation Modal States
  const [pendingKillSwitchAction, setPendingKillSwitchAction] = useState<KillSwitchAction | null>(null);
  const [killSwitchStep, setKillSwitchStep] = useState<1 | 2>(1);
  const [killSwitchConfirmText, setKillSwitchConfirmText] = useState('');
  const [killSwitchAck1, setKillSwitchAck1] = useState(false);
  const [killSwitchAck2, setKillSwitchAck2] = useState(false);

  const [showGlobalWarningModal, setShowGlobalWarningModal] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';
  const [selectedClientId, setSelectedClientId] = useState(isAdmin ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['general', 'pause_draft', 'features', 'signoff', 'moderation', 'disclaimers'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    } else if (!tabParam) {
      setActiveTab(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAdmin) {
      api.getAllEmailAccounts()
        .then((data) => setClients(data || []))
        .catch((err) => console.error("Failed to fetch clients in settings:", err));
    }
  }, [isAdmin]);

  const targetClientId = (selectedClientId && selectedClientId !== 'ALL') 
    ? selectedClientId 
    : (isAdmin ? 'ALL' : (user?.client_id || 'SYSTEM'));

  const currentClient = clients.find((c: any) => c.client_id === targetClientId);
  const resolvedCompanyName = companyName || currentClient?.company_name || currentClient?.name || user?.company_name || user?.name;

  useEffect(() => {
    if (selectedClientId === 'ALL' && activeTab && !['general', 'moderation', 'disclaimers'].includes(activeTab)) {
      setActiveTab('general');
      setSearchParams({ tab: 'general' });
    }
  }, [selectedClientId, activeTab, setSearchParams]);

  useEffect(() => {
    if (targetClientId) {
      loadSettings();
      if (targetClientId !== 'ALL') {
        loadFeaturesData();
      }
      loadModerationData();
      loadDisclaimersData();
      loadMarketingSendersData();
      loadMasterBotStatusData();
    }
  }, [targetClientId]);

  const handleConfirmAutoSendToggle = async () => {
    if (pendingAutoSendTarget === null || !targetClientId || targetClientId === 'ALL') return;
    setToggleAutoSendLoading(true);
    setError('');
    try {
      await api.setClientFeatures({
        client_id: targetClientId,
        feature_ticket_creation: features.feature_ticket_creation,
        feature_auto_send: pendingAutoSendTarget,
        feature_rag: features.feature_rag,
        feature_order_tracking: features.feature_order_tracking,
        feature_manual_reply: features.feature_manual_reply,
        feature_strip_disclaimers: features.feature_strip_disclaimers,
      });
      setFeatures(prev => ({ ...prev, feature_auto_send: pendingAutoSendTarget }));
      setPendingAutoSendTarget(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update Pause & Draft mode');
      setPendingAutoSendTarget(null);
    } finally {
      setToggleAutoSendLoading(false);
    }
  };

  const loadFeaturesData = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    try {
      const data = await api.getClientFeatures(targetClientId);
      if (data) {
        setFeatures({
          feature_ticket_creation: data.feature_ticket_creation !== undefined ? Boolean(data.feature_ticket_creation) : true,
          feature_auto_send: data.feature_auto_send !== undefined ? Boolean(data.feature_auto_send) : true,
          feature_rag: data.feature_rag !== undefined ? Boolean(data.feature_rag) : true,
          feature_order_tracking: data.feature_order_tracking !== undefined ? Boolean(data.feature_order_tracking) : true,
          feature_manual_reply: data.feature_manual_reply !== undefined ? Boolean(data.feature_manual_reply) : true,
          feature_strip_disclaimers: data.feature_strip_disclaimers !== undefined ? Boolean(data.feature_strip_disclaimers) : true,
        });
      }
    } catch (err) {
      console.error("Failed to load feature flags:", err);
    }
  };

  const handleToggleStripDisclaimers = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    const newVal = !features.feature_strip_disclaimers;
    setStripDisclaimerToggling(true);
    setError('');
    try {
      await api.setClientFeatures({
        client_id: targetClientId,
        feature_ticket_creation: features.feature_ticket_creation,
        feature_auto_send: features.feature_auto_send,
        feature_rag: features.feature_rag,
        feature_order_tracking: features.feature_order_tracking,
        feature_manual_reply: features.feature_manual_reply,
        feature_strip_disclaimers: newVal,
      });
      setFeatures(prev => ({ ...prev, feature_strip_disclaimers: newVal }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update disclaimer stripping flag');
    } finally {
      setStripDisclaimerToggling(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (targetClientId === 'ALL') {
        setThreshold(80);
        setTone('Formal');
        setAgentType('customer_support');
        setCompanyName('');
        setDepartmentName('');
      } else {
        const client = await api.getEmailAccount(targetClientId);
        if (client) {
          setThreshold(client.score_threshold || 80);
          setTone(client.response_tone || 'Formal');
          setAgentType(client.agent_type || 'customer_support');
          setCompanyName(client.company_name || '');
          setDepartmentName(client.department_name || '');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadModerationData = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    try {
      const data = await api.getBlockedKeywords(targetClientId);
      setKeywords(data.keywords || []);
    } catch (err) {
      console.error("Failed to load keywords:", err);
    }
  };

  const loadDisclaimersData = async () => {
    setDisclaimerLoading(true);
    try {
      const clientToQuery = targetClientId === 'ALL' ? undefined : targetClientId;
      const data = await api.getEmailDisclaimers(clientToQuery);
      setDisclaimers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load email disclaimers:", err);
    } finally {
      setDisclaimerLoading(false);
    }
  };

  const loadMarketingSendersData = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    setMarketingLoading(true);
    try {
      const data = await api.getMarketingSenders(targetClientId);
      setMarketingSenders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load marketing senders:", err);
    } finally {
      setMarketingLoading(false);
    }
  };

  const loadMasterBotStatusData = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    setMasterBotLoading(true);
    try {
      const data = await api.getMasterBotStatus(targetClientId);
      if (data) {
        setMasterBotStatus({
          admin_bot_enabled: data.admin_bot_enabled !== false,
          client_bot_enabled: data.client_bot_enabled !== false,
          is_effective_enabled: data.is_effective_enabled !== false,
          is_locked_by_admin: Boolean(data.is_locked_by_admin),
        });
      }
    } catch (err) {
      console.error("Failed to load master bot status:", err);
    } finally {
      setMasterBotLoading(false);
    }
  };

  const handleToggleClientMasterBot = async (enable: boolean) => {
    if (!targetClientId || targetClientId === 'ALL') return;
    setMasterBotToggling(true);
    setError('');
    try {
      await api.toggleClientMasterBot({
        client_id: targetClientId,
        client_bot_enabled: enable,
      });
      setMasterBotStatus(prev => ({
        ...prev,
        client_bot_enabled: enable,
        is_effective_enabled: prev.admin_bot_enabled && enable,
      }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update Master Bot Switch');
    } finally {
      setMasterBotToggling(false);
    }
  };

  const handleToggleAdminMasterBot = async (enable: boolean) => {
    if (!targetClientId || targetClientId === 'ALL') return;
    setMasterBotToggling(true);
    setError('');
    try {
      await api.toggleAdminMasterBot({
        client_id: targetClientId,
        admin_bot_enabled: enable,
      });
      setMasterBotStatus(prev => ({
        ...prev,
        admin_bot_enabled: enable,
        is_effective_enabled: enable && prev.client_bot_enabled,
        is_locked_by_admin: !enable,
      }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update Admin Master Switch');
    } finally {
      setMasterBotToggling(false);
    }
  };

  const requestKillSwitchToggle = (type: 'client' | 'admin', enable: boolean) => {
    setPendingKillSwitchAction({ type, enable });
    setKillSwitchStep(1);
    setKillSwitchConfirmText('');
    setKillSwitchAck1(false);
    setKillSwitchAck2(false);
  };

  const executeConfirmedKillSwitch = async () => {
    if (!pendingKillSwitchAction || !targetClientId || targetClientId === 'ALL') return;
    const { type, enable } = pendingKillSwitchAction;
    setPendingKillSwitchAction(null);
    if (type === 'client') {
      await handleToggleClientMasterBot(enable);
    } else {
      await handleToggleAdminMasterBot(enable);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClientId === 'ALL') {
      setShowGlobalWarningModal(true);
      return;
    }
    executeSave();
  };

  const executeSave = async () => {
    setShowGlobalWarningModal(false);
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      if (selectedClientId === 'ALL') {
        await api.updateSelfProfile({
          client_id: 'ALL',
          score_threshold: Number(threshold),
        });
      } else {
        await api.updateSelfProfile({
          client_id: targetClientId,
          department_name: departmentName,
          company_name: companyName,
          score_threshold: Number(threshold),
          agent_type: agentType,
          response_tone: tone
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeatures = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClientId || targetClientId === 'ALL') return;
    setFeaturesSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.setClientFeatures({
        client_id: targetClientId,
        feature_ticket_creation: features.feature_ticket_creation,
        feature_auto_send: features.feature_auto_send,
        feature_rag: features.feature_rag,
        feature_order_tracking: features.feature_order_tracking,
        feature_manual_reply: features.feature_manual_reply,
        feature_strip_disclaimers: features.feature_strip_disclaimers,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update feature flags');
    } finally {
      setFeaturesSaving(false);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !targetClientId) return;
    setKeywordSaving(true);
    try {
      await api.addBlockedKeyword(targetClientId, newKeyword.trim());
      setNewKeyword('');
      const kwRes = await api.getBlockedKeywords(targetClientId);
      setKeywords(kwRes.keywords || []);
    } catch (err: any) {
      setError(err.message || 'Failed to add keyword');
    } finally {
      setKeywordSaving(false);
    }
  };

  const handleDeleteKeyword = async (kw: string) => {
    try {
      await api.deleteBlockedKeyword(targetClientId, kw);
      setKeywords(keywords.filter(k => k !== kw));
    } catch (err: any) {
      setError(err.message || 'Failed to remove keyword');
    }
  };

  const handleAddDisclaimer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisclaimerText.trim()) return;
    setDisclaimerSaving(true);
    try {
      const clientToUse = targetClientId === 'ALL' ? 'GLOBAL' : targetClientId;
      await api.addEmailDisclaimer({
        client_id: clientToUse,
        disclaimer_text: newDisclaimerText.trim()
      });
      setNewDisclaimerText('');
      await loadDisclaimersData();
    } catch (err: any) {
      setError(err.message || 'Failed to add disclaimer rule');
    } finally {
      setDisclaimerSaving(false);
    }
  };

  const handleDeleteDisclaimer = async (id: number) => {
    try {
      await api.deleteEmailDisclaimer(id, targetClientId);
      setDisclaimers(disclaimers.filter(d => d.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete disclaimer');
    }
  };

  const handleToggleDisclaimer = async (id: number, currentStatus: boolean) => {
    try {
      await api.toggleEmailDisclaimer(id, !currentStatus, targetClientId);
      setDisclaimers(disclaimers.map(d => d.id === id ? { ...d, is_active: !currentStatus } : d));
    } catch (err: any) {
      setError(err.message || 'Failed to toggle disclaimer');
    }
  };

  const handleAddMarketingSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketingSender.trim() || !targetClientId) return;
    setMarketingSaving(true);
    try {
      await api.markMarketingSender({
        client_id: targetClientId,
        sender_email: newMarketingSender.trim().toLowerCase()
      });
      setNewMarketingSender('');
      await loadMarketingSendersData();
    } catch (err: any) {
      setError(err.message || 'Failed to add marketing sender');
    } finally {
      setMarketingSaving(false);
    }
  };

  const handleDeleteMarketingSender = async (senderEmail: string) => {
    try {
      await api.unmarkMarketingSender({
        client_id: targetClientId,
        sender_email: senderEmail
      });
      await loadMarketingSendersData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove marketing sender');
    }
  };

  const categoryTitles: Record<string, string> = {
    general: 'System Configuration & Flow Control',
    features: 'AI Automation Features & Modules',
    pause_draft: 'Pause & Draft Safety Controls',
    signoff: 'Organization Sign-Off & Persona',
    moderation: 'Keyword Moderation & Sender Rules',
    disclaimers: 'Email Disclaimers & Boilerplates',
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 select-none">
        <Loader2 className="w-9 h-9 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Fetching Windows 11 system policies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 select-none pb-12">
      {/* Windows 11 Settings Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          {activeTab ? (
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab(null);
                  setSearchParams({});
                }}
                className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs font-semibold text-foreground truncate max-w-xs">
                {categoryTitles[activeTab]}
              </span>
            </div>
          ) : (
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Settings &amp; Policies
            </h1>
          )}
          <p className="text-xs text-muted-foreground">
            {activeTab
              ? `Configuring ${categoryTitles[activeTab]} for ${targetClientId}`
              : 'Configure bot personas, confidence levels, safety gates, and integration modules.'}
          </p>
        </div>

        {/* Client Scope Switcher (Admin) */}
        {isAdmin && clients.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-[#2C2C2C] border border-black/[0.08] dark:border-white/[0.08] px-3 py-1.5 rounded-md shadow-2xs self-start sm:self-auto">
            <span className="text-xs text-muted-foreground font-medium">Scope:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-xs text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-card text-foreground">ALL Clients (Global)</option>
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id} className="bg-card text-foreground">
                  {c.client_id} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg border bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Fleet Mode Guidance Banner */}
      {selectedClientId === 'ALL' && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary flex items-start gap-3 shadow-2xs">
          <Building2 className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-foreground">Global Fleet Overview Mode</p>
            <p className="text-muted-foreground">
              You are currently viewing global defaults. To configure and save tenant-specific AI confidence thresholds, auto-send dispatch modes, or custom signoffs, select a specific client from the scope dropdown above.
            </p>
          </div>
        </div>
      )}

      {/* Top Hero Status Banner */}
      <FluentHeroCard
        title={
          selectedClientId === 'ALL'
            ? 'Global Automation Engine (All Clients)'
            : (resolvedCompanyName || `Client ${targetClientId}`)
        }
        subtitle={
          selectedClientId === 'ALL'
            ? `Scope: Global Default Policies | Flow: ${masterBotStatus.is_effective_enabled ? 'Active' : 'Halted'}`
            : `Client ID: ${targetClientId} | Flow: ${masterBotStatus.is_effective_enabled ? 'Active' : 'Halted'}`
        }
        actionLabel={activeTab ? "Back to All Settings" : "Configure Flow"}
        onActionClick={() => {
          if (activeTab) {
            setActiveTab(null);
            setSearchParams({});
          } else {
            setActiveTab('general');
            setSearchParams({ tab: 'general' });
          }
        }}
        status1={{
          icon: Power,
          title: 'Master Kill Switch',
          subtitle: masterBotStatus.is_effective_enabled ? 'Operational (Online)' : 'Halted (Stopped)',
        }}
        status2={{
          icon: Bot,
          title: 'Dispatch Safety Gate',
          subtitle: features.feature_auto_send ? 'Direct Auto-Send' : 'Hold in Drafts',
        }}
      />

      {/* ===================== VIEW 1: TEMPLATE C CATEGORY EXPANDER LIST ===================== */}
      {!activeTab && (
        <div className="space-y-3">
          <SettingsCard
            title="System & Automation Categories"
            description="Select a category to view and adjust operational parameters"
          >
            {/* 1. General Settings & Kill Switch */}
            <SettingsRow
              icon={Gauge}
              title="System Configuration & Bot Persona"
              description={`Agent persona (${agentType}), tone (${tone}), confidence threshold (${threshold}%), and master emergency kill switch`}
              action={
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  masterBotStatus.is_effective_enabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {masterBotStatus.is_effective_enabled ? 'Active' : 'Halted'}
                </span>
              }
              onClick={() => {
                setActiveTab('general');
                setSearchParams({ tab: 'general' });
              }}
            />

            {/* 2. AI Features & Modules */}
            {selectedClientId !== 'ALL' && (
              <SettingsRow
                icon={Sparkles}
                title="AI Automation Features & Modules"
                description="Ticket creation, RAG knowledge lookup, system connector webhooks, and manual reply override"
                action={
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    6 Modules
                  </span>
                }
                onClick={() => {
                  setActiveTab('features');
                  setSearchParams({ tab: 'features' });
                }}
              />
            )}

            {/* 3. Pause & Draft Safety Controls */}
            {selectedClientId !== 'ALL' && (
              <SettingsRow
                icon={FileText}
                title="Pause & Draft Safety Mode"
                description="Autonomous direct email dispatch vs supervisor review staging queue"
                action={
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    features.feature_auto_send
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}>
                    {features.feature_auto_send ? 'Auto-Send' : 'Draft Mode'}
                  </span>
                }
                onClick={() => {
                  setActiveTab('pause_draft');
                  setSearchParams({ tab: 'pause_draft' });
                }}
              />
            )}

            {/* 4. Organization Sign-Off */}
            {selectedClientId !== 'ALL' && (
              <SettingsRow
                icon={FileSignature}
                title="Organization Sign-Off & Brand Persona"
                description={`Company signature name (${companyName || 'C-Zentrix'}), department (${departmentName || 'Support'}), and signoff templates`}
                onClick={() => {
                  setActiveTab('signoff');
                  setSearchParams({ tab: 'signoff' });
                }}
              />
            )}

            {/* 5. Keyword Moderation */}
            <SettingsRow
              icon={ShieldAlert}
              title="Keyword Moderation & Sender Rules"
              description={`Blocked sensitive keywords (${keywords.length} active), spam defense, and marketing email ignore filters`}
              action={
                keywords.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/[0.04] dark:bg-white/[0.08] text-foreground border border-black/[0.08] dark:border-white/[0.08]">
                    {keywords.length} Blocked
                  </span>
                ) : undefined
              }
              onClick={() => {
                setActiveTab('moderation');
                setSearchParams({ tab: 'moderation' });
              }}
            />

            {/* 6. Email Disclaimers */}
            <SettingsRow
              icon={Building2}
              title="Email Disclaimers & Boilerplate Cleaning"
              description={`Legal disclaimer rules (${disclaimers.length} active) and automatic token-saver phrase stripping`}
              action={
                disclaimers.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/[0.04] dark:bg-white/[0.08] text-foreground border border-black/[0.08] dark:border-white/[0.08]">
                    {disclaimers.length} Active
                  </span>
                ) : undefined
              }
              onClick={() => {
                setActiveTab('disclaimers');
                setSearchParams({ tab: 'disclaimers' });
              }}
            />
          </SettingsCard>
        </div>
      )}

      {/* ===================== VIEW 2: CATEGORY DETAIL VIEW ===================== */}
      {activeTab && (
        <div className="space-y-4">
          {/* Windows 11 Horizontal Tab Navigation Pill Bar */}
          <div className="flex flex-wrap items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
            <button
              onClick={() => {
                setActiveTab('general');
                setSearchParams({ tab: 'general' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>General</span>
            </button>

            {selectedClientId !== 'ALL' && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('features');
                    setSearchParams({ tab: 'features' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'features'
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Features</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('pause_draft');
                    setSearchParams({ tab: 'pause_draft' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'pause_draft'
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Pause &amp; Draft</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('signoff');
                    setSearchParams({ tab: 'signoff' });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'signoff'
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <FileSignature className="w-3.5 h-3.5" />
                  <span>Sign-Off</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                setActiveTab('moderation');
                setSearchParams({ tab: 'moderation' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'moderation'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Moderation</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('disclaimers');
                setSearchParams({ tab: 'disclaimers' });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'disclaimers'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Disclaimers</span>
            </button>
          </div>

          {/* Tab Renderers */}
          {activeTab === 'general' && (
            <GeneralTab
              selectedClientId={selectedClientId}
              threshold={threshold}
              setThreshold={setThreshold}
              tone={tone}
              setTone={setTone}
              agentType={agentType}
              setAgentType={setAgentType}
              masterBotStatus={masterBotStatus}
              masterBotLoading={masterBotLoading}
              masterBotToggling={masterBotToggling}
              isAdmin={isAdmin}
              requestKillSwitchToggle={requestKillSwitchToggle}
              handleSave={handleSave}
              saving={saving}
              success={success}
            />
          )}

          {selectedClientId !== 'ALL' && activeTab === 'pause_draft' && (
            <PauseDraftTab
              targetClientId={targetClientId}
              autoSendEnabled={features.feature_auto_send}
              onToggleAutoSend={(targetVal) => setPendingAutoSendTarget(targetVal)}
            />
          )}

          {selectedClientId !== 'ALL' && activeTab === 'features' && (
            <FeaturesTab
              targetClientId={targetClientId}
              features={features}
              setFeatures={setFeatures}
              handleSaveFeatures={handleSaveFeatures}
              featuresSaving={featuresSaving}
              success={success}
            />
          )}

          {selectedClientId !== 'ALL' && activeTab === 'signoff' && (
            <SignoffTab
              companyName={companyName}
              setCompanyName={setCompanyName}
              departmentName={departmentName}
              setDepartmentName={setDepartmentName}
              handleSave={handleSave}
              saving={saving}
              success={success}
            />
          )}

          {activeTab === 'moderation' && (
            <ModerationTab
              keywords={keywords}
              newKeyword={newKeyword}
              setNewKeyword={setNewKeyword}
              keywordSaving={keywordSaving}
              handleAddKeyword={handleAddKeyword}
              handleDeleteKeyword={handleDeleteKeyword}
              marketingSenders={marketingSenders}
              newMarketingSender={newMarketingSender}
              setNewMarketingSender={setNewMarketingSender}
              marketingLoading={marketingLoading}
              marketingSaving={marketingSaving}
              handleAddMarketingSender={handleAddMarketingSender}
              handleDeleteMarketingSender={handleDeleteMarketingSender}
            />
          )}

          {activeTab === 'disclaimers' && (
            <DisclaimersTab
              targetClientId={targetClientId}
              features={features}
              stripDisclaimerToggling={stripDisclaimerToggling}
              handleToggleStripDisclaimers={handleToggleStripDisclaimers}
              newDisclaimerText={newDisclaimerText}
              setNewDisclaimerText={setNewDisclaimerText}
              disclaimerSaving={disclaimerSaving}
              handleAddDisclaimer={handleAddDisclaimer}
              disclaimerLoading={disclaimerLoading}
              disclaimers={disclaimers}
              handleToggleDisclaimer={handleToggleDisclaimer}
              handleDeleteDisclaimer={handleDeleteDisclaimer}
            />
          )}
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmGlobalModal
        isOpen={showGlobalWarningModal}
        threshold={threshold}
        saving={saving}
        onConfirm={executeSave}
        onCancel={() => setShowGlobalWarningModal(false)}
      />

      <ConfirmAutoSendModal
        isOpen={pendingAutoSendTarget !== null}
        pendingTarget={pendingAutoSendTarget}
        targetClientId={targetClientId}
        threshold={threshold}
        loading={toggleAutoSendLoading}
        onConfirm={handleConfirmAutoSendToggle}
        onCancel={() => setPendingAutoSendTarget(null)}
      />

      <ConfirmKillSwitchModal
        isOpen={pendingKillSwitchAction !== null}
        pendingAction={pendingKillSwitchAction}
        targetClientId={targetClientId}
        step={killSwitchStep}
        setStep={setKillSwitchStep}
        confirmText={killSwitchConfirmText}
        setConfirmText={setKillSwitchConfirmText}
        ack1={killSwitchAck1}
        setAck1={setKillSwitchAck1}
        ack2={killSwitchAck2}
        setAck2={setKillSwitchAck2}
        loading={masterBotToggling}
        onConfirm={executeConfirmedKillSwitch}
        onCancel={() => setPendingKillSwitchAction(null)}
      />
    </div>
  );
}
