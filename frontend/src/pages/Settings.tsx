import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sliders, 
  Loader2, 
  AlertCircle, 
  Building2, 
  ShieldAlert, 
  Sparkles,
  Gauge,
  FileSignature,
  FileText
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
  const [activeTab, setActiveTab] = useState<'general' | 'pause_draft' | 'features' | 'signoff' | 'moderation' | 'disclaimers'>('general');
  
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

  useEffect(() => {
    if (selectedClientId === 'ALL' && activeTab !== 'general') {
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
      console.error("Failed to load features:", err);
    }
  };

  const handleToggleStripDisclaimers = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    const nextVal = !features.feature_strip_disclaimers;
    setStripDisclaimerToggling(true);
    setError('');
    try {
      await api.setClientFeatures({
        ...features,
        client_id: targetClientId,
        feature_strip_disclaimers: nextVal,
      });
      setFeatures(prev => ({ ...prev, feature_strip_disclaimers: nextVal }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update disclaimer stripping toggle');
    } finally {
      setStripDisclaimerToggling(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getEmailAccount(targetClientId);
      if (data) {
        setThreshold(data.score_threshold !== undefined ? data.score_threshold : 80);
        if (targetClientId !== 'ALL') {
          setTone(data.response_tone || 'Formal');
          setAgentType(data.agent_type || 'customer_support');
          setCompanyName(data.company_name || '');
          setDepartmentName(data.department_name || '');
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadModerationData = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    try {
      const kwRes = await api.getBlockedKeywords(targetClientId);
      setKeywords(kwRes.keywords || []);
    } catch (err) {
      console.error("Failed to load moderation settings:", err);
    }
  };

  const loadDisclaimersData = async () => {
    if (!targetClientId || targetClientId === 'ALL') return;
    setDisclaimerLoading(true);
    try {
      const data = await api.getEmailDisclaimers(targetClientId);
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium">Fetching client configuration credentials...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in-50 duration-500 pb-16">
      {/* Settings Top Header */}
      <div className="space-y-4 border-b border-zinc-200 dark:border-white/10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
              <Sliders className="w-8 h-8 text-primary" /> Settings & Policies
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Fine-tune AI confidence thresholds, agent personas, response tones, organization sign-off, blocked keywords, and email disclaimers.
            </p>
          </div>

          {/* Client Switcher (Admin) */}
          {isAdmin && clients.length > 0 && (
            <div className="flex items-center gap-2.5 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2 shrink-0 self-start sm:self-auto">
              <span className="text-xs text-muted-foreground font-medium">Client Scope:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer font-semibold"
              >
                <option value="ALL" className="bg-zinc-900 text-foreground">ALL Clients (Global)</option>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id} className="bg-zinc-900 text-foreground">
                    {c.client_id} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Full-width Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/10">
          <button
            onClick={() => {
              setActiveTab('general');
              setSearchParams({ tab: 'general' });
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span>System Configuration</span>
          </button>

          {/* Pause & Draft Sub-section/Tab */}
          {selectedClientId !== 'ALL' && (
            <button
              onClick={() => {
                setActiveTab('pause_draft');
                setSearchParams({ tab: 'pause_draft' });
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pause_draft'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Pause &amp; Draft</span>
            </button>
          )}

          {/* AI Features & Modules */}
          {selectedClientId !== 'ALL' && (
            <button
              onClick={() => {
                setActiveTab('features');
                setSearchParams({ tab: 'features' });
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'features'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Features &amp; Modules</span>
            </button>
          )}

          {selectedClientId !== 'ALL' && (
            <>
              <button
                onClick={() => {
                  setActiveTab('signoff');
                  setSearchParams({ tab: 'signoff' });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'signoff'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Organization &amp; Sign-Off</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('moderation');
                  setSearchParams({ tab: 'moderation' });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'moderation'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Blocked Keywords</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('disclaimers');
                  setSearchParams({ tab: 'disclaimers' });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'disclaimers'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <FileSignature className="w-4 h-4" />
                <span>Email Disclaimers</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. GENERAL SETTINGS TAB */}
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

      {/* 2. PAUSE & DRAFT TAB */}
      {selectedClientId !== 'ALL' && activeTab === 'pause_draft' && (
        <PauseDraftTab
          targetClientId={targetClientId}
          autoSendEnabled={features.feature_auto_send}
          onToggleAutoSend={(targetVal) => setPendingAutoSendTarget(targetVal)}
        />
      )}

      {/* 3. AI FEATURES & MODULES TAB */}
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

      {/* 4. ORGANIZATION & SIGN-OFF TAB */}
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

      {/* 5. MODERATION SETTINGS TAB */}
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

      {/* 6. EMAIL DISCLAIMERS TAB */}
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

      {/* Global Setting Change Warning & Confirmation Modal */}
      <ConfirmGlobalModal
        isOpen={showGlobalWarningModal}
        threshold={threshold}
        saving={saving}
        onConfirm={executeSave}
        onCancel={() => setShowGlobalWarningModal(false)}
      />

      {/* Pause & Draft / Direct Auto-Send Mode Warning & Confirmation Modal */}
      <ConfirmAutoSendModal
        isOpen={pendingAutoSendTarget !== null}
        pendingTarget={pendingAutoSendTarget}
        targetClientId={targetClientId}
        threshold={threshold}
        loading={toggleAutoSendLoading}
        onConfirm={handleConfirmAutoSendToggle}
        onCancel={() => setPendingAutoSendTarget(null)}
      />

      {/* Master Kill Switch Double Warning & Confirmation Modal */}
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
