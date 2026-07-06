import { useState, useEffect } from 'react';
import { Database, Code2, Save, Loader2, CheckCircle, XCircle, Info, Edit3, Settings, HelpCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

export default function PayloadConfig() {
  const [createPayload, setCreatePayload] = useState({ url: '', paylod: '{\n  "key": "value"\n}' });
  const [getPayload, setGetPayload] = useState({ url: '', paylod: '{\n  "key": "value"\n}' });
  
  const [createLoading, setCreateLoading] = useState(false);
  const [getLoading, setGetLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [allCreatePayloads, setAllCreatePayloads] = useState<any[]>([]);
  const [allGetPayloads, setAllGetPayloads] = useState<any[]>([]);

  // Toggles for Edit/View modes
  const [isEditingCreate, setIsEditingCreate] = useState(true);
  const [isEditingGet, setIsEditingGet] = useState(true);
  const [hasExistingCreate, setHasExistingCreate] = useState(false);
  const [hasExistingGet, setHasExistingGet] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
        })
        .catch((err) => console.error("Failed to fetch clients for admin webhook payloads:", err));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadPayloadConfigs(selectedClientId);
    }
  }, [selectedClientId]);

  const loadPayloadConfigs = async (cid = selectedClientId) => {
    if (!cid) return;
    if (cid === 'ALL') {
      try {
        const createRes = await api.getCreatePayload('ALL');
        setAllCreatePayloads(Array.isArray(createRes) ? createRes : []);
      } catch (err) {
        console.error("Failed to fetch all create payloads:", err);
        setAllCreatePayloads([]);
      }
      try {
        const getRes = await api.getGetPayload('ALL');
        setAllGetPayloads(Array.isArray(getRes) ? getRes : []);
      } catch (err) {
        console.error("Failed to fetch all get payloads:", err);
        setAllGetPayloads([]);
      }
      return;
    }

    try {
      const createRes = await api.getCreatePayload(cid);
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
      const getRes = await api.getGetPayload(cid);
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
        client_id: selectedClientId,
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
        client_id: selectedClientId,
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Payload Configurations</h2>
          <p className="text-muted-foreground mt-1">Configure Webhook endpoints and JSON templates dynamically used by the Mail AI agent.</p>
        </div>
        {user?.role === 'admin' && clients.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground font-semibold">Client:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900 text-foreground">ALL</option>
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id} className="bg-zinc-900 text-foreground">
                  {c.client_id} ({c.email})
                </option>
              ))}
            </select>
          </div>
        )}
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

      {selectedClientId === 'ALL' ? (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-accent/5">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent animate-pulse" />
              <h3 className="text-lg font-semibold text-white">All Webhook Configurations</h3>
            </div>
            <button 
              onClick={() => loadPayloadConfigs('ALL')}
              className="text-muted-foreground hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {[...allCreatePayloads, ...allGetPayloads].length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-4 text-left w-[25%]">Client (Email)</th>
                    <th className="py-3 px-4 text-left w-[15%]">Type</th>
                    <th className="py-3 px-4 text-left w-[35%]">Target Endpoint URL</th>
                    <th className="py-3 px-4 text-left w-[25%]">Payload Schema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
                  {[
                    ...allCreatePayloads.map(p => ({ ...p, type: 'Create Reference' })),
                    ...allGetPayloads.map(p => ({ ...p, type: 'Get Status' }))
                  ].sort((a, b) => a.email.localeCompare(b.email)).map((payload, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white break-all">
                        {payload.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          payload.type === 'Create Reference' 
                            ? 'bg-primary/10 text-primary border border-primary/20' 
                            : 'bg-accent/10 text-accent border border-accent/20'
                        }`}>
                          {payload.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-200 break-all select-all">
                        {payload.url}
                      </td>
                      <td className="py-3.5 px-4">
                        <pre className="text-[10px] font-mono text-zinc-400 bg-black/40 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight">
                          {JSON.stringify(payload.paylod, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400 border border-dashed border-white/10 rounded-xl">
              <Code2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-white">No Webhooks Configured</p>
              <p className="text-xs mt-1 text-muted-foreground">Select a specific client from the top filter to configure new webhooks.</p>
            </div>
          )}
        </div>
      ) : (
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

              {selectedClientId === 'ALL' ? (
                <div className="text-center py-12 px-4 text-muted-foreground text-sm space-y-2 border border-white/5 bg-white/5 rounded-xl">
                  <Database className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p>Webhook configuration is disabled when viewing ALL clients.</p>
                  <p className="text-xs text-zinc-500">Please select a specific client from the top dropdown to configure Webhooks.</p>
                </div>
              ) : user?.role === 'admin' ? (
                hasExistingCreate ? (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                      <div className="text-[10px] text-primary uppercase font-bold tracking-wider">Target Endpoint URL:</div>
                      <div className="text-sm font-mono text-white break-all">{createPayload.url}</div>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                      <div className="text-[10px] text-primary uppercase font-bold tracking-wider">JSON Template structure:</div>
                      <pre className="text-xs font-mono text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap">{createPayload.paylod}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 px-4 text-muted-foreground text-sm space-y-2 border border-white/5 bg-white/5 rounded-xl">
                    <Code2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p>No webhook configured for this client.</p>
                  </div>
                )
              ) : hasExistingCreate && !isEditingCreate ? (
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

              {selectedClientId === 'ALL' ? (
                <div className="text-center py-12 px-4 text-muted-foreground text-sm space-y-2 border border-white/5 bg-white/5 rounded-xl">
                  <Database className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p>Webhook configuration is disabled when viewing ALL clients.</p>
                  <p className="text-xs text-zinc-500">Please select a specific client from the top dropdown to configure Webhooks.</p>
                </div>
              ) : user?.role === 'admin' ? (
                hasExistingGet ? (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                      <div className="text-[10px] text-accent uppercase font-bold tracking-wider">Target Endpoint URL:</div>
                      <div className="text-sm font-mono text-white break-all">{getPayload.url}</div>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                      <div className="text-[10px] text-accent uppercase font-bold tracking-wider">JSON Template structure:</div>
                      <pre className="text-xs font-mono text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap">{getPayload.paylod}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 px-4 text-muted-foreground text-sm space-y-2 border border-white/5 bg-white/5 rounded-xl">
                    <Code2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p>No webhook configured for this client.</p>
                  </div>
                )
              ) : hasExistingGet && !isEditingGet ? (
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
      )}
    </div>
  );
}

