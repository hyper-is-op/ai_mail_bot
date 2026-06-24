import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Database, Code2, Loader2, Sparkles, X, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function SetupWizard() {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showGetPayloadModal, setShowGetPayloadModal] = useState(false);
  const [showCreatePayloadModal, setShowCreatePayloadModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1 Form: Email / IMAP Credentials
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  
  // Step 2 Form: Get Ticket Payload
  const [getPayloadForm, setGetPayloadForm] = useState({
    url: '',
    paylod: '{\n  "client_key": "YOUR_CLIENT_KEY",\n  "filter": {\n    "docket_no": "ORD12345",\n    "create_date_flag": "true"\n  }\n}'
  });

  // Step 3 Form: Create Ticket Payload
  const [createPayloadForm, setCreatePayloadForm] = useState({
    url: '',
    paylod: '{\n  "client_key": "YOUR_CLIENT_KEY",\n  "ticket": {\n    "from_email": "customer@gmail.com",\n    "subject": "Delay in delivery",\n    "body": "My package ORD98765 has not arrived yet."\n  }\n}'
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const clientId = user?.client_id || '';
  const isClient = user?.role === 'client';

  useEffect(() => {
    if (isClient && clientId) {
      checkSetupStatus();
    }
  }, [clientId, isClient]);

  const checkSetupStatus = async () => {
    try {
      // 1. Check Email Configuration
      let emailConfigured = false;
      try {
        const emailRes = await api.getEmailAccount(clientId);
        if (emailRes && emailRes.email) {
          emailConfigured = true;
        }
      } catch (err) {
        emailConfigured = false;
      }

      if (!emailConfigured) {
        setShowEmailModal(true);
        return;
      }

      // 2. Check Get Webhook Configuration
      let getWebhookConfigured = false;
      try {
        const getRes = await api.getGetPayload(clientId);
        if (getRes && getRes.url) {
          getWebhookConfigured = true;
        }
      } catch (err) {
        getWebhookConfigured = false;
      }

      if (!getWebhookConfigured) {
        setShowGetPayloadModal(true);
        return;
      }

      // 3. Check Create Webhook Configuration
      let createWebhookConfigured = false;
      try {
        const createRes = await api.getCreatePayload(clientId);
        if (createRes && createRes.url) {
          createWebhookConfigured = true;
        }
      } catch (err) {
        createWebhookConfigured = false;
      }

      if (!createWebhookConfigured) {
        setShowCreatePayloadModal(true);
        return;
      }

      // All configurations are active, close any open modal
      setShowEmailModal(false);
      setShowGetPayloadModal(false);
      setShowCreatePayloadModal(false);
    } catch (err) {
      console.error("Error checking setup status:", err);
    }
  };

  // Step 1: Save IMAP
  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.acceptEmail({
        client_id: clientId,
        email: emailForm.email,
        password: emailForm.password
      });
      
      setShowEmailModal(false);
      setTimeout(() => {
        setShowGetPayloadModal(true);
      }, 300); // smooth 300ms transition delay
    } catch (err: any) {
      setError(err.message || 'Failed to save email account.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save Get Ticket Webhook
  const handleSaveGetPayload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(getPayloadForm.paylod);
      } catch (e) {
        throw new Error('Invalid JSON Payload structure.');
      }

      await api.insertGetPayload({
        client_id: clientId,
        url: getPayloadForm.url,
        paylod: parsedPayload
      });

      setShowGetPayloadModal(false);
      setTimeout(() => {
        setShowCreatePayloadModal(true);
      }, 300); // smooth transition delay
    } catch (err: any) {
      setError(err.message || 'Failed to save order/ticket status tracking configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Save Create Ticket Webhook & Finish
  const handleSaveCreatePayload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(createPayloadForm.paylod);
      } catch (e) {
        throw new Error('Invalid JSON Payload structure.');
      }

      await api.insertCreatePayload({
        client_id: clientId,
        url: createPayloadForm.url,
        paylod: parsedPayload
      });

      // Mark onboarding as complete
      localStorage.setItem(`onboarding_complete_${clientId}`, 'true');
      setShowCreatePayloadModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save ticket creation webhook configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {/* POPUP 1: IMAP Credentials Setup */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 p-8 shadow-2xl backdrop-blur-xl"
            >
              <div className="absolute -top-40 -right-40 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
              
              <button 
                onClick={() => setShowEmailModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Step 1: Email Configuration (IMAP)</h2>
                  <p className="text-xs text-muted-foreground">Setup Gmail IMAP credentials to read incoming emails</p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-sm text-primary/80 leading-relaxed mb-6">
                <strong className="text-white block mb-1">Why do we need this?</strong>
                To connect securely to your Gmail support inbox. Our real-time AI model reads incoming customer messages, writes drafts, and forwards unresolved queries to your support helpdesk automatically.
              </div>

              <form onSubmit={handleSaveEmail} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Gmail Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      placeholder="support.company@gmail.com"
                      value={emailForm.email}
                      onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">App Password / Token</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter 16-character App Password"
                      value={emailForm.password}
                      onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword(!showSetupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                    >
                      {showSetupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                    * Generate a secure 16-character "App Password" under your Google Account Security settings.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Next: Get Payload Setup <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* POPUP 2: Get Ticket Payload Setup */}
        {showGetPayloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 p-8 shadow-2xl backdrop-blur-xl"
            >
              <div className="absolute -top-40 -right-40 -z-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
              
              <button 
                onClick={() => setShowGetPayloadModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Step 2: Tracking Webhook (Get Ticket)</h2>
                  <p className="text-xs text-muted-foreground">Setup endpoints to fetch real-time ticket or order status</p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 text-sm text-emerald-400 leading-relaxed mb-6">
                <strong className="text-white block mb-1">Why do we need this?</strong>
                To instantly lookup active orders or tickets. When a customer emails asking about their delivery status or active tickets, the AI queries this webhook and replies with live database information.
              </div>

              <form onSubmit={handleSaveGetPayload} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Tracking Webhook URL</label>
                  <div className="relative">
                    <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="url"
                      required
                      placeholder="https://yourcrm.com/api/v1/get-ticket-status"
                      value={getPayloadForm.url}
                      onChange={(e) => setGetPayloadForm({ ...getPayloadForm, url: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Get Ticket JSON Template</label>
                  <div className="relative">
                    <Code2 className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      required
                      rows={5}
                      value={getPayloadForm.paylod}
                      onChange={(e) => setGetPayloadForm({ ...getPayloadForm, paylod: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-mono resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-black py-3 rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Next: Create Ticket Setup <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* POPUP 3: Create Ticket Payload Setup */}
        {showCreatePayloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 p-8 shadow-2xl backdrop-blur-xl"
            >
              <div className="absolute -top-40 -right-40 -z-10 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
              
              <button 
                onClick={() => setShowCreatePayloadModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Step 3: Webhook Endpoint (Create Ticket)</h2>
                  <p className="text-xs text-muted-foreground">Setup endpoints and templates to register new tickets</p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 text-sm text-indigo-400 leading-relaxed mb-6">
                <strong className="text-white block mb-1">Why do we need this?</strong>
                To automatically create tickets inside your CRM. When our AI detects that a query is too complex or unresolved, it calls this webhook to launch a high-priority ticket instantly!
              </div>

              <form onSubmit={handleSaveCreatePayload} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Create Webhook URL</label>
                  <div className="relative">
                    <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="url"
                      required
                      placeholder="https://yourcrm.com/api/v1/create-new-ticket"
                      value={createPayloadForm.url}
                      onChange={(e) => setCreatePayloadForm({ ...createPayloadForm, url: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Create Ticket JSON Template</label>
                  <div className="relative">
                    <Code2 className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      required
                      rows={5}
                      value={createPayloadForm.paylod}
                      onChange={(e) => setCreatePayloadForm({ ...createPayloadForm, paylod: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Finish Setup & Launch AI Agent <CheckCircle2 className="w-5 h-5" /></>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
