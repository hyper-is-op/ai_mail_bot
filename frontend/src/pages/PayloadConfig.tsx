import { useState, useEffect } from 'react';
import { Database, Code2, Save, Loader2, CheckCircle, XCircle, Info, Edit3, Settings, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function PayloadConfig() {
  const [createPayload, setCreatePayload] = useState({ url: '', paylod: '{\n  "key": "value"\n}' });
  const [getPayload, setGetPayload] = useState({ url: '', paylod: '{\n  "key": "value"\n}' });
  
  const [createLoading, setCreateLoading] = useState(false);
  const [getLoading, setGetLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Toggles for Edit/View modes
  const [isEditingCreate, setIsEditingCreate] = useState(true);
  const [isEditingGet, setIsEditingGet] = useState(true);
  const [hasExistingCreate, setHasExistingCreate] = useState(false);
  const [hasExistingGet, setHasExistingGet] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const clientId = user?.client_id || '';

  useEffect(() => {
    if (clientId) {
      loadPayloadConfigs();
    }
  }, [clientId]);

  const loadPayloadConfigs = async () => {
    try {
      const createRes = await api.getCreatePayload(clientId);
      if (createRes && createRes.url) {
        setCreatePayload({
          url: createRes.url,
          paylod: JSON.stringify(createRes.paylod, null, 2)
        });
        setHasExistingCreate(true);
        setIsEditingCreate(false);
      } else {
        setHasExistingCreate(false);
        setIsEditingCreate(true);
      }
    } catch (err) {
      console.warn("No create payload config found yet:", err);
      setIsEditingCreate(true);
    }

    try {
      const getRes = await api.getGetPayload(clientId);
      if (getRes && getRes.url) {
        setGetPayload({
          url: getRes.url,
          paylod: JSON.stringify(getRes.paylod, null, 2)
        });
        setHasExistingGet(true);
        setIsEditingGet(false);
      } else {
        setHasExistingGet(false);
        setIsEditingGet(true);
      }
    } catch (err) {
      console.warn("No get payload config found yet:", err);
      setIsEditingGet(true);
    }
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const parsedPayload = JSON.parse(createPayload.paylod);
      await api.insertCreatePayload({
        client_id: clientId,
        url: createPayload.url,
        paylod: parsedPayload
      });
      setMsg({ type: 'success', text: 'Create Reference Webhook payload saved successfully.' });
      setHasExistingCreate(true);
      setIsEditingCreate(false);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'JSON Parse error. Please check your payload syntax.' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveGet = async (e: React.FormEvent) => {
    e.preventDefault();
    setGetLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const parsedPayload = JSON.parse(getPayload.paylod);
      await api.insertGetPayload({
        client_id: clientId,
        url: getPayload.url,
        paylod: parsedPayload
      });
      setMsg({ type: 'success', text: 'Get Reference Status Webhook payload saved successfully.' });
      setHasExistingGet(true);
      setIsEditingGet(false);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'JSON Parse error. Please check your payload syntax.' });
    } finally {
      setGetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Payload Configurations</h2>
          <p className="text-muted-foreground mt-1">Configure Webhook endpoints and JSON templates dynamically used by the Mail AI agent.</p>
        </div>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${msg.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
          {msg.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{msg.text}</span>
        </div>
      )}

      {/* Dynamic explanation header block */}
      <div className="bg-accent/5 border border-accent/10 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent border border-accent/20 shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-white">Webhook Templates for Automations</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These webhook templates tell the AI agent how to interact with your internal systems. When the agent processes customer emails, it will dynamically execute HTTP posts matching your payload schema to create or fetch references.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Payload Ticket */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                  <Database className="w-5 h-5 text-primary" /> Create Reference Webhook
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Automated workflow when generating reference entries.</p>
              </div>
              {hasExistingCreate && (
                <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Configured
                </span>
              )}
            </div>

            {hasExistingCreate && !isEditingCreate ? (
              // READ-ONLY SUMMARY CARD WITH EDIT OPTION
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-primary uppercase font-bold tracking-wider">Target Endpoint URL:</div>
                  <div className="text-sm font-mono text-white break-all">{createPayload.url}</div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-primary uppercase font-bold tracking-wider">JSON Template structure:</div>
                  <pre className="text-xs font-mono text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap">{createPayload.paylod}</pre>
                </div>

                <button 
                  onClick={() => setIsEditingCreate(true)}
                  className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Edit3 className="w-4 h-4" /> Edit & Update Configuration
                </button>
              </div>
            ) : (
              // FORM EDITOR VIEW
              <form onSubmit={handleSaveCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Webhook URL</label>
                  <input 
                    type="url" required
                    value={createPayload.url}
                    onChange={(e) => setCreatePayload({...createPayload, url: e.target.value})}
                    placeholder="https://api.thirdparty.com/webhook"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-mono" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">JSON Payload Schema</label>
                  <div className="relative">
                    <Code2 className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <textarea 
                      required
                      value={createPayload.paylod}
                      onChange={(e) => setCreatePayload({...createPayload, paylod: e.target.value})}
                      className="w-full h-40 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-mono resize-none" 
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {hasExistingCreate && (
                    <button 
                      type="button"
                      onClick={() => setIsEditingCreate(false)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    disabled={createLoading} 
                    type="submit" 
                    className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save changes</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Get Payload Ticket */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                  <Database className="w-5 h-5 text-accent" /> Get Reference Status Webhook
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Used by the system to track reference/shipment statuses.</p>
              </div>
              {hasExistingGet && (
                <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Configured
                </span>
              )}
            </div>

            {hasExistingGet && !isEditingGet ? (
              // READ-ONLY SUMMARY CARD WITH EDIT OPTION
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-accent uppercase font-bold tracking-wider">Target Endpoint URL:</div>
                  <div className="text-sm font-mono text-white break-all">{getPayload.url}</div>
                </div>

                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] text-accent uppercase font-bold tracking-wider">JSON Template structure:</div>
                  <pre className="text-xs font-mono text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap">{getPayload.paylod}</pre>
                </div>

                <button 
                  onClick={() => setIsEditingGet(true)}
                  className="w-full bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Edit3 className="w-4 h-4" /> Edit & Update Configuration
                </button>
              </div>
            ) : (
              // FORM EDITOR VIEW
              <form onSubmit={handleSaveGet} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Webhook URL</label>
                  <input 
                    type="url" required
                    value={getPayload.url}
                    onChange={(e) => setGetPayload({...getPayload, url: e.target.value})}
                    placeholder="https://api.thirdparty.com/fetch_webhook"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-white font-mono" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">JSON Payload Schema</label>
                  <div className="relative">
                    <Code2 className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <textarea 
                      required
                      value={getPayload.paylod}
                      onChange={(e) => setGetPayload({...getPayload, paylod: e.target.value})}
                      className="w-full h-40 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-white font-mono resize-none" 
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {hasExistingGet && (
                    <button 
                      type="button"
                      onClick={() => setIsEditingGet(false)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 py-2.5 rounded-lg font-medium transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    disabled={getLoading} 
                    type="submit" 
                    className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {getLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save changes</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

