import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Sliders, 
  Save, 
  Loader2, 
  AlertCircle, 
  Building2, 
  Shield, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles,
  Gauge,
  UserCheck,
  Headphones,
  Wrench,
  CreditCard,
  ShoppingBag,
  Crown,
  CheckCircle2,
  FileSignature,
  Zap,
  Clock,
  FileText,
  ExternalLink,
  Megaphone,
  Power,
  Lock,
  Unlock
} from 'lucide-react';
import { api } from '@/lib/api';

const AGENT_PERSONAS = [
  {
    id: 'customer_support',
    name: 'Customer Support',
    desc: 'Helpful, courteous, and solution-oriented for general inquiries.',
    icon: Headphones,
    color: 'text-blue-500'
  },
  {
    id: 'technical_support',
    name: 'Technical Support',
    desc: 'Diagnostic, analytical, and structured troubleshooting.',
    icon: Wrench,
    color: 'text-amber-500'
  },
  {
    id: 'billing_support',
    name: 'Billing & Invoicing',
    desc: 'Clear, accurate financial and payment processing guidance.',
    icon: CreditCard,
    color: 'text-emerald-500'
  },
  {
    id: 'ecommerce_support',
    name: 'E-Commerce & Orders',
    desc: 'Order tracking, delivery, product questions, and returns.',
    icon: ShoppingBag,
    color: 'text-purple-500'
  },
  {
    id: 'executive_escalation',
    name: 'Executive Escalations',
    desc: 'High-touch, prioritized VIP and sensitive issue care.',
    icon: Crown,
    color: 'text-rose-500'
  }
];

const TONE_OPTIONS = [
  {
    id: 'Formal',
    name: 'Professional & Formal',
    desc: 'Structured, polished, and strictly courteous phrasing.'
  },
  {
    id: 'Friendly',
    name: 'Friendly & Empathetic',
    desc: 'Warm, understanding, and approachable conversational style.'
  },
  {
    id: 'Concise',
    name: 'Concise & Direct',
    desc: 'Brief, clear, and straight to the point without filler.'
  },
  {
    id: 'Casual',
    name: 'Casual & Relaxed',
    desc: 'Modern, informal, everyday conversational tone.'
  }
];

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
  const [features, setFeatures] = useState({
    feature_ticket_creation: true,
    feature_auto_send: true,
    feature_rag: true,
    feature_order_tracking: true,
    feature_manual_reply: true,
  });
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [pendingAutoSendTarget, setPendingAutoSendTarget] = useState<boolean | null>(null);
  const [toggleAutoSendLoading, setToggleAutoSendLoading] = useState(false);

  // Keyword Moderation States
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordSaving, setKeywordSaving] = useState(false);

  // Disclaimer Configuration States
  const [disclaimers, setDisclaimers] = useState<any[]>([]);
  const [newDisclaimerText, setNewDisclaimerText] = useState('');
  const [disclaimerLoading, setDisclaimerLoading] = useState(false);
  const [disclaimerSaving, setDisclaimerSaving] = useState(false);

  // Marketing & Promotional Senders States
  const [marketingSenders, setMarketingSenders] = useState<string[]>([]);
  const [newMarketingSender, setNewMarketingSender] = useState('');
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingSaving, setMarketingSaving] = useState(false);

  // Master Bot Flow Control States
  const [masterBotStatus, setMasterBotStatus] = useState<{
    admin_bot_enabled: boolean;
    client_bot_enabled: boolean;
    is_effective_enabled: boolean;
    is_locked_by_admin: boolean;
  }>({
    admin_bot_enabled: true,
    client_bot_enabled: true,
    is_effective_enabled: true,
    is_locked_by_admin: false,
  });
  const [masterBotLoading, setMasterBotLoading] = useState(false);
  const [masterBotToggling, setMasterBotToggling] = useState(false);

  // Kill Switch Double Confirmation Modal States
  const [pendingKillSwitchAction, setPendingKillSwitchAction] = useState<{
    type: 'client' | 'admin';
    enable: boolean;
  } | null>(null);
  const [killSwitchStep, setKillSwitchStep] = useState<1 | 2>(1);
  const [killSwitchConfirmText, setKillSwitchConfirmText] = useState('');
  const [killSwitchAck1, setKillSwitchAck1] = useState(false);
  const [killSwitchAck2, setKillSwitchAck2] = useState(false);

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
        });
      }
    } catch (err) {
      console.error("Failed to load features:", err);
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

  const [showGlobalWarningModal, setShowGlobalWarningModal] = useState(false);

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

  const PRESET_DISCLAIMERS = [
    {
      title: "Towards Vision Technologies Disclaimer",
      text: "-- \n*DISCLAIMER: *This email and its attachments are confidential and intended solely for the recipient(s). Unauthorized use, disclosure, or distribution is prohibited. If you received this email in error, please notify the sender and delete it. Towards Vision Technologies Limited is not liable for any damage caused by viruses or malware in this email."
    },
    {
      title: "Standard Enterprise Confidentiality Notice",
      text: "Confidentiality Notice: This e-mail message, including any attachments, is for the sole use of the intended recipient(s) and may contain confidential and privileged information. Any unauthorized review, use, disclosure, or distribution is strictly prohibited."
    },
    {
      title: "Virus & Malware Liability Clause",
      text: "WARNING: Computer viruses can be transmitted via email. The recipient should check this email and any attachments for the presence of viruses. The company accepts no liability for any damage caused by any virus transmitted by this email."
    }
  ];

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
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Card 0: Master Automation Flow Control (Kill Switch) */}
          {selectedClientId !== 'ALL' && (
            <div className={`p-6 rounded-2xl border transition-all ${
              !masterBotStatus.admin_bot_enabled
                ? 'bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/20 dark:border-rose-500/30'
                : !masterBotStatus.client_bot_enabled
                ? 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-500/30'
                : 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/10 dark:border-emerald-500/20 glass-panel'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`p-3 rounded-xl shrink-0 ${
                    !masterBotStatus.admin_bot_enabled
                      ? 'bg-rose-500/20 text-rose-500'
                      : !masterBotStatus.client_bot_enabled
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    <Power className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white">Master Kill Switch (All Flow Control)</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                        !masterBotStatus.admin_bot_enabled
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : !masterBotStatus.client_bot_enabled
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {!masterBotStatus.admin_bot_enabled ? (
                          <>
                            <Lock className="w-3 h-3" /> Admin Kill Active (Halted)
                          </>
                        ) : !masterBotStatus.client_bot_enabled ? (
                          <>
                            <Clock className="w-3 h-3" /> Client Kill Active (Halted)
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Flow Active &amp; Running
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                      {!masterBotStatus.admin_bot_enabled
                        ? '⛔ System Administrator has engaged the Master Kill Switch for this account. All Gmail reading, background tasks, auto-replies, and ticket creations are completely stopped.'
                        : !masterBotStatus.client_bot_enabled
                        ? '⏸️ Master Kill Switch is ENGAGED. All incoming email polling and bot processing are completely stopped. Emails remain unread in Gmail.'
                        : '⚡ All bot operations are actively running: background polling, AI classification, draft generation, and auto-dispatch.'}
                    </p>
                  </div>
                </div>

                {/* Controls based on role & admin lock */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0 self-end sm:self-auto">
                  {/* Client Toggle */}
                  <button
                    type="button"
                    disabled={masterBotLoading || masterBotToggling || !masterBotStatus.admin_bot_enabled}
                    onClick={() => requestKillSwitchToggle('client', !masterBotStatus.client_bot_enabled)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:cursor-not-allowed ${
                      !masterBotStatus.admin_bot_enabled
                        ? 'opacity-50 bg-zinc-200 dark:bg-white/10 text-zinc-400 border border-zinc-300 dark:border-white/10'
                        : masterBotStatus.client_bot_enabled
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                    }`}
                    title={!masterBotStatus.admin_bot_enabled ? 'Locked by Administrator. Only an admin can re-enable.' : ''}
                  >
                    {masterBotToggling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : !masterBotStatus.admin_bot_enabled ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : masterBotStatus.client_bot_enabled ? (
                      <Power className="w-3.5 h-3.5" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {!masterBotStatus.admin_bot_enabled
                        ? 'Locked by Admin'
                        : masterBotStatus.client_bot_enabled
                        ? 'Engage Kill Switch (Stop All)'
                        : 'Disengage Kill Switch (Resume All)'}
                    </span>
                  </button>

                  {/* Admin Override Action */}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={masterBotLoading || masterBotToggling}
                      onClick={() => requestKillSwitchToggle('admin', !masterBotStatus.admin_bot_enabled)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        masterBotStatus.admin_bot_enabled
                          ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {masterBotStatus.admin_bot_enabled ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Admin Force Kill</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Admin Unlock</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Card 1: AI Confidence Evaluation & Threshold Slider */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">AI Confidence Score Threshold</h3>
                  <p className="text-xs text-zinc-400">
                    Minimum RAG answer quality score required to automatically dispatch an email reply without human escalation.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-2xl font-black ${
                  threshold >= 85 ? 'text-emerald-400' :
                  threshold >= 70 ? 'text-blue-400' :
                  'text-amber-400'
                }`}>
                  {threshold}%
                </span>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                  {threshold >= 85 ? 'Strict Quality (Conservative)' :
                   threshold >= 70 ? 'Balanced (Recommended)' :
                   'Lenient (High Automation)'}
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {/* Relative container for accurately positioned stop labels */}
              <div className="relative h-6 text-[11px] font-semibold text-muted-foreground select-none">
                <button
                  type="button"
                  onClick={() => setThreshold(50)}
                  className={`absolute left-0 text-left transition-colors cursor-pointer hover:text-foreground ${threshold === 50 ? 'text-primary font-bold' : ''}`}
                >
                  50% <span className="hidden sm:inline font-normal text-[10px]">(More Replies)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThreshold(70)}
                  className={`absolute left-[44.44%] -translate-x-1/2 text-center transition-colors cursor-pointer hover:text-foreground ${threshold === 70 ? 'text-primary font-bold' : ''}`}
                >
                  70% <span className="hidden sm:inline font-normal text-[10px]">(Balanced)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThreshold(80)}
                  className={`absolute left-[66.67%] -translate-x-1/2 text-center transition-colors cursor-pointer hover:text-foreground ${threshold === 80 ? 'text-primary font-bold' : ''}`}
                >
                  80% <span className="hidden sm:inline font-normal text-[10px]">(Standard)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThreshold(95)}
                  className={`absolute right-0 text-right transition-colors cursor-pointer hover:text-foreground ${threshold === 95 ? 'text-primary font-bold' : ''}`}
                >
                  95% <span className="hidden sm:inline font-normal text-[10px]">(High Precision)</span>
                </button>
              </div>

              {/* Slider Input */}
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary z-10"
                />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                When the LLM confidence score is <strong>≥ {threshold}%</strong>, the system executes automated SMTP delivery. If score falls below <strong>{threshold}%</strong>, the message is automatically escalated to the support desk as a ticket.
              </p>
            </div>
          </div>

          {/* Persona & Tone are ONLY shown for individual clients, NOT for ALL Clients (Global) */}
          {selectedClientId !== 'ALL' && (
            <>
              {/* Card 2: Agent Persona / Role (Choice Chips) */}
              <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">Agent Persona / Role</h3>
                    <p className="text-xs text-zinc-400">Select the domain role injected into the LLM system prompt to shape reply knowledge and framing.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {AGENT_PERSONAS.map((persona) => {
                    const isSelected = agentType === persona.id;
                    const IconComponent = persona.icon;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => setAgentType(persona.id)}
                        className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary'
                            : 'bg-white/5 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-foreground'}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-foreground">{persona.name}</span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {persona.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Response Tone Style (Choice Chips) */}
              <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">Response Tone Style</h3>
                    <p className="text-xs text-zinc-400">Select the customer-facing brand tone for phrasing and vocabulary.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  {TONE_OPTIONS.map((item) => {
                    const isSelected = tone === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTone(item.id)}
                        className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground shadow-sm shadow-primary/10 ring-1 ring-primary'
                            : 'bg-white/5 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">{item.name}</span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {success ? 'Configuration Saved!' : (selectedClientId === 'ALL' ? 'Save Global Threshold' : 'Save System Configuration')}
            </button>
          </div>
        </form>
      )}

      {/* 2. PAUSE & DRAFT TAB */}
      {selectedClientId !== 'ALL' && activeTab === 'pause_draft' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/5 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">Pause &amp; Draft Configuration</h3>
                  <p className="text-xs text-muted-foreground">
                    Control automated dispatching and human-in-the-loop email review queue for {targetClientId}.
                  </p>
                </div>
              </div>

              <Link
                to="/drafts"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              >
                <span>Open Pause &amp; Draft Queue</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Main Mode Toggle Card */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm font-bold text-foreground">
                    Pause &amp; Draft Mode
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                    !features.feature_auto_send
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {!features.feature_auto_send ? 'Pause & Draft Active' : 'Direct Auto-Send'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {!features.feature_auto_send
                    ? "Active: All generated AI replies are safely paused and placed into the Pause & Draft queue for manual operator review, editing, and approval before sending via SMTP."
                    : "Disabled (Direct Auto-Send): Confident AI replies (≥ confidence threshold) bypass the draft queue and are dispatched automatically via SMTP without human inspection."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPendingAutoSendTarget(!features.feature_auto_send)}
                className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
                title={!features.feature_auto_send ? "Click to switch to Direct Auto-Send" : "Click to switch to Pause & Draft"}
              >
                {!features.feature_auto_send ? (
                  <ToggleRight className="w-10 h-10 text-amber-500" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                )}
              </button>
            </div>

            {/* Step-by-Step Workflow Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">1</span>
                  <span>Inbound AI Analysis</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Incoming customer emails are evaluated using RAG knowledge bases, sentiment analysis, and confidence scoring.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] space-y-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[10px]">2</span>
                  <span>Draft Review &amp; Quality</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  In Pause &amp; Draft mode, replies wait for human inspection. Agents can tweak phrasing, verify answers, and check attachments.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] space-y-2">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px]">3</span>
                  <span>Batch or Single Dispatch</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Send drafts individually, in custom batches, or discard unwanted responses with full CRM tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. AI FEATURES & MODULES TAB */}
      {selectedClientId !== 'ALL' && activeTab === 'features' && (
        <form onSubmit={handleSaveFeatures} className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-100 dark:border-white/5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">AI Automation Features &amp; Modules</h3>
                <p className="text-xs text-muted-foreground">
                  Enable or disable specialized autonomous capabilities and integration workflows for {targetClientId}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Feature 1: Ticket Creation */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground">Helpdesk Ticket Creation</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Automatically generate tickets and incident references in external CRM when inquiries require human escalation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatures(prev => ({ ...prev, feature_ticket_creation: !prev.feature_ticket_creation }))}
                  className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
                >
                  {features.feature_ticket_creation ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Feature 2: Knowledge Base RAG */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground">Knowledge Base (RAG) Lookup</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Perform semantic search across company documents, FAQs, and product knowledge to ground AI responses.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatures(prev => ({ ...prev, feature_rag: !prev.feature_rag }))}
                  className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
                >
                  {features.feature_rag ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Feature 3: Tools / Order Tracking */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground">System Connector &amp; Tool Invocation</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Execute live API webhooks for dynamic lookups, order tracking, and external CRM updates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatures(prev => ({ ...prev, feature_order_tracking: !prev.feature_order_tracking }))}
                  className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
                >
                  {features.feature_order_tracking ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Feature 4: Manual Reply */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground">Human-in-the-Loop Manual Reply</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Allow support operators to review, edit, and manually send generated drafts from the Inbox interface.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeatures(prev => ({ ...prev, feature_manual_reply: !prev.feature_manual_reply }))}
                  className="text-primary hover:opacity-80 transition-opacity shrink-0 cursor-pointer pt-0.5"
                >
                  {features.feature_manual_reply ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={featuresSaving}
                className="bg-primary text-primary-foreground text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {featuresSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{success ? 'Features Saved!' : 'Save Feature Modules'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. ORGANIZATION & SIGN-OFF TAB */}
      {activeTab === 'signoff' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">Organization & Department Sign-Off</h3>
                <p className="text-xs text-zinc-400">Configure the company brand and support team name used by AI when concluding and signing off customer emails.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Company / Organization Name</label>
                <input
                  type="text"
                  placeholder="e.g. Towards Vision Technologies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white dark:bg-black/40 border border-zinc-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Displayed as the legal or corporate entity name.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Department / Support Team Name</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Care & Inquiries Team"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full bg-white dark:bg-black/40 border border-zinc-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Displayed in greetings and email signature sign-offs.</p>
              </div>
            </div>

            {/* Live Sign-Off Preview Card */}
            <div className="bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
                <FileSignature className="w-4 h-4 text-primary" />
                Live Sign-Off Preview
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-300 space-y-1.5 leading-relaxed">
                <p className="text-zinc-500 italic">-- Email Body Concludes --</p>
                <p className="text-zinc-200 pt-2">Best regards,</p>
                <p className="text-primary font-bold">{departmentName || 'Customer Support Team'}</p>
                <p className="text-zinc-400 font-semibold">{companyName || 'Towards Vision Technologies'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {success ? 'Sign-Off Saved!' : 'Save Sign-Off Details'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. MODERATION SETTINGS TAB */}
      {activeTab === 'moderation' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">Blocked Keywords</h3>
                <p className="text-xs text-zinc-400">
                  Emails containing any of these keywords will be blocked from automated AI replies and routed to the Inbox Blocked tab.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. refund, cancel, payment, legal"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
              <button
                disabled={keywordSaving}
                type="submit"
                className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-primary/90 transition-all shadow-sm"
              >
                Add Keyword
              </button>
            </form>

            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2 max-h-60 overflow-y-auto pr-1">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-zinc-300"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteKeyword(kw)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors text-sm font-bold"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
                No keywords defined. All messages pass through to automated replies.
              </p>
            )}
          </div>

          {/* Marketing & Promotional Senders Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">Marketing & Promotional Senders</h3>
                <p className="text-xs text-zinc-400">
                  Senders or domain patterns added here will be automatically classified as Marketing / Promotional. Incoming emails from these senders will completely bypass AI reply processing, draft creation, and ticket generation.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddMarketingSender} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. newsletter@partner.com, @mail.internshala.com, or promo-alerts"
                value={newMarketingSender}
                onChange={(e) => setNewMarketingSender(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
              <button
                disabled={marketingSaving}
                type="submit"
                className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-primary/90 transition-all shadow-sm"
              >
                {marketingSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Sender
              </button>
            </form>

            {marketingLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : marketingSenders.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2 max-h-60 overflow-y-auto pr-1">
                {marketingSenders.map((sender) => (
                  <span
                    key={sender}
                    className="inline-flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full px-3 py-1 text-xs text-sky-300"
                  >
                    <span>{sender}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteMarketingSender(sender)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors text-sm font-bold ml-1 cursor-pointer"
                      title="Remove Sender"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
                No marketing senders configured. You can add specific email addresses or domains above.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. EMAIL DISCLAIMERS TAB */}
      {activeTab === 'disclaimers' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">Email Disclaimer & Boilerplate Rules</h3>
                  <p className="text-xs text-zinc-400">
                    Define custom email disclaimer phrases, legal signatures, and enterprise confidentiality notices that will be collapsed automatically across the application.
                  </p>
                </div>
              </div>
            </div>

            {/* Add New Disclaimer Form */}
            <form onSubmit={handleAddDisclaimer} className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Add Custom Disclaimer / Signature Pattern
              </label>
              <textarea
                required
                rows={3}
                placeholder="Paste the disclaimer text, confidentiality notice, or legal signature to collapse..."
                value={newDisclaimerText}
                onChange={(e) => setNewDisclaimerText(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:outline-none focus:border-primary leading-relaxed"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Preset Suggestions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-semibold">Presets:</span>
                  {PRESET_DISCLAIMERS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewDisclaimerText(preset.text)}
                      className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-zinc-300 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      {preset.title}
                    </button>
                  ))}
                </div>

                <button
                  disabled={disclaimerSaving}
                  type="submit"
                  className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1 hover:bg-primary/90 transition-all shadow-sm self-end"
                >
                  {disclaimerSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Save Disclaimer Rule
                </button>
              </div>
            </form>

            {/* Disclaimers Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configured Disclaimer Rules</h4>
              {disclaimerLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : disclaimers.length > 0 ? (
                <div className="space-y-3">
                  {disclaimers.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-white/20 transition-all"
                    >
                      <div className="space-y-1.5 flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.client_id === 'GLOBAL' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                            {item.client_id === 'GLOBAL' ? '🌐 Global Rule' : `Client: ${item.client_id}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                            {item.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-zinc-300 leading-relaxed line-clamp-2">
                          {item.disclaimer_text}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleDisclaimer(item.id, item.is_active)}
                          className={`p-2 rounded-lg border transition-colors ${item.is_active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
                          title={item.is_active ? 'Disable Rule' : 'Enable Rule'}
                        >
                          {item.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDisclaimer(item.id)}
                          className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-white/10 rounded-xl">
                  No custom disclaimers configured yet. Built-in defaults are actively used.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Setting Change Warning & Confirmation Modal */}
      {showGlobalWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Confirm Global Policy Change</h3>
                <p className="text-xs text-muted-foreground">
                  You are modifying system-wide defaults under <span className="text-amber-500 font-bold">ALL Clients (Global)</span> scope.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-amber-500/10">
                <span className="text-muted-foreground">New Global Confidence Threshold:</span>
                <span className="font-bold text-amber-500 font-mono text-sm">{threshold}%</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                ⚠️ This update will immediately change the AI auto-reply score threshold for <strong>all client accounts</strong> across the platform that do not have custom overrides.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowGlobalWarningModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Confirm &amp; Apply Globally</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause & Draft / Direct Auto-Send Mode Warning & Confirmation Modal */}
      {pendingAutoSendTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-xl shrink-0 ${
                pendingAutoSendTarget === false
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                  : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
              }`}>
                {pendingAutoSendTarget === false ? (
                  <Clock className="w-6 h-6" />
                ) : (
                  <Zap className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {pendingAutoSendTarget === false
                    ? 'Enable Pause & Draft Mode?'
                    : 'Enable Direct Auto-Send Mode?'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Target Account: <span className="font-semibold text-foreground font-mono">{targetClientId}</span>
                </p>
              </div>
            </div>

            {pendingAutoSendTarget === false ? (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
                <p className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  AI replies will be paused for human review
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  When <strong>Pause &amp; Draft</strong> is active, AI-generated email responses will <strong>not</strong> be automatically sent via SMTP. All replies will be placed into the <strong>Pause &amp; Draft</strong> inbox where operators can inspect, edit wording, and dispatch emails individually or in smart batches.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-2">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Live automated dispatch will be activated
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  ⚠️ <strong>Warning:</strong> AI replies meeting your confidence threshold (≥ {threshold}%) will be <strong>automatically dispatched to customers via SMTP</strong> without prior human review. Please ensure your Knowledge Base and system settings are properly configured.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingAutoSendTarget(null)}
                disabled={toggleAutoSendLoading}
                className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAutoSendToggle}
                disabled={toggleAutoSendLoading}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  pendingAutoSendTarget === false
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {toggleAutoSendLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : pendingAutoSendTarget === false ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>
                  {pendingAutoSendTarget === false
                    ? 'Confirm & Enable Pause & Draft'
                    : 'Confirm & Enable Auto-Send'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Kill Switch Double Warning & Confirmation Modal */}
      {pendingKillSwitchAction !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white dark:bg-zinc-900 border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 ${
            !pendingKillSwitchAction.enable
              ? 'border-rose-500/40 shadow-rose-500/10'
              : 'border-emerald-500/40 shadow-emerald-500/10'
          }`}>
            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-xl shrink-0 ${
                !pendingKillSwitchAction.enable
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500'
              }`}>
                {!pendingKillSwitchAction.enable ? <Power className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {!pendingKillSwitchAction.enable
                      ? killSwitchStep === 1
                        ? 'Critical Warning: Engage Kill Switch (1/2)'
                        : 'Final Verification: Engage Kill Switch (2/2)'
                      : killSwitchStep === 1
                      ? 'Resume Master Automation (1/2)'
                      : 'Final Verification: Resume Automation (2/2)'}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target Account: <span className="font-semibold text-foreground font-mono">{targetClientId}</span>
                  {pendingKillSwitchAction.type === 'admin' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">ADMIN OVERRIDE</span>
                  )}
                </p>
              </div>
            </div>

            {/* STEP 1: WARNING & IMPACT */}
            {killSwitchStep === 1 ? (
              <div className="space-y-4">
                {!pendingKillSwitchAction.enable ? (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-3">
                    <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Warning 1: You are about to initiate a complete platform halt for this client.
                    </p>
                    <ul className="space-y-2 text-zinc-700 dark:text-zinc-300 list-disc list-inside text-[11px] leading-relaxed">
                      <li><strong>Gmail Ingestion will STOP:</strong> Incoming customer emails will NOT be fetched, analyzed, or displayed in the bot stream.</li>
                      <li><strong>Zero AI Processing:</strong> No auto-replies, smart classifications, or AI drafts will be generated.</li>
                      <li><strong>No CRM Sync:</strong> Escalations to Zoho Desk or Shopify will be paused.</li>
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-3">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Step 1: Re-enabling Automated Email Processing
                    </p>
                    <p className="text-zinc-700 dark:text-zinc-300 text-[11px] leading-relaxed">
                      The background listener will immediately reconnect to Gmail, start fetching unread customer emails, and process them through your configured AI pipelines.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setPendingKillSwitchAction(null)}
                    className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setKillSwitchStep(2)}
                    className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      !pendingKillSwitchAction.enable
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    <span>Proceed to Step 2 Verification →</span>
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: STRICT VERIFICATION & CONFIRMATION */
              <div className="space-y-4">
                {!pendingKillSwitchAction.enable ? (
                  <div className="space-y-3.5">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-rose-500/30 text-xs space-y-2.5">
                      <p className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" />
                        Warning 2: Double Confirmation Required
                      </p>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-zinc-300">
                        <input
                          type="checkbox"
                          checked={killSwitchAck1}
                          onChange={(e) => setKillSwitchAck1(e.target.checked)}
                          className="mt-0.5 rounded border-rose-500/40 text-rose-600 focus:ring-rose-500"
                        />
                        <span>I understand that <strong>ALL incoming customer emails</strong> will be left unread in Gmail without automated assistance.</span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-zinc-300">
                        <input
                          type="checkbox"
                          checked={killSwitchAck2}
                          onChange={(e) => setKillSwitchAck2(e.target.checked)}
                          className="mt-0.5 rounded border-rose-500/40 text-rose-600 focus:ring-rose-500"
                        />
                        <span>I confirm that human support agents must manually monitor and answer support mailboxes.</span>
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                        Type <span className="text-rose-400 font-mono">STOP</span> or <span className="text-rose-400 font-mono">KILL</span> to confirm:
                      </label>
                      <input
                        type="text"
                        placeholder="Type STOP or KILL here..."
                        value={killSwitchConfirmText}
                        onChange={(e) => setKillSwitchConfirmText(e.target.value)}
                        className="w-full bg-black/50 border border-rose-500/30 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 uppercase font-mono tracking-widest"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                      <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmation 2: Ready to Resume
                      </p>
                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] text-zinc-300">
                        <input
                          type="checkbox"
                          checked={killSwitchAck1}
                          onChange={(e) => setKillSwitchAck1(e.target.checked)}
                          className="mt-0.5 rounded border-emerald-500/40 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>I confirm that knowledge bases, thresholds, and mail integrations are properly configured for automated processing.</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setKillSwitchStep(1)}
                    className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    ← Back to Step 1
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingKillSwitchAction(null)}
                      className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        masterBotToggling ||
                        (!pendingKillSwitchAction.enable &&
                          (!killSwitchAck1 ||
                            !killSwitchAck2 ||
                            !['STOP', 'KILL'].includes(killSwitchConfirmText.trim().toUpperCase()))) ||
                        (pendingKillSwitchAction.enable && !killSwitchAck1)
                      }
                      onClick={executeConfirmedKillSwitch}
                      className={`px-4 py-2 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white ${
                        !pendingKillSwitchAction.enable
                          ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                      }`}
                    >
                      {masterBotToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : !pendingKillSwitchAction.enable ? (
                        <Power className="w-3.5 h-3.5" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {!pendingKillSwitchAction.enable
                          ? 'Engage Master Kill Switch Now'
                          : 'Confirm & Resume Automation'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
