import { useState, useEffect } from 'react';
import { BookOpen, UploadCloud, CheckCircle2, Trash2, Search, Sparkles, Database, HelpCircle, RefreshCw, FileText, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResult, setSandboxResult] = useState<any[]>([]);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
        })
        .catch((err) => console.error("Failed to fetch clients for admin knowledge base:", err));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchDocuments(selectedClientId);
    }
  }, [selectedClientId]);

  const fetchDocuments = async (cid = selectedClientId) => {
    if (!cid) return;
    setFetchLoading(true);
    try {
      const res = await api.getRagDocuments(cid);
      setDocuments(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setMsg({ type: 'error', text: 'Please fill out both the title and knowledge content.' });
      return;
    }

    setUploadLoading(true);
    setMsg({ type: '', text: '' });
    try {
      await api.uploadRagData({
        client_id: selectedClientId,
        title: title.trim(),
        content: content.trim()
      });
      setMsg({ type: 'success', text: 'Knowledge base updated successfully!' });
      setTitle('');
      setContent('');
      fetchDocuments(selectedClientId);
      fetchAdminStats();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to upload knowledge base.' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['pdf', 'doc', 'docx', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !allowedExtensions.includes(ext)) {
      setMsg({ 
        type: 'error', 
        text: `Invalid file format. Only ${allowedExtensions.map(e => `.${e}`).join(', ')} files are allowed.` 
      });
      setSelectedFile(null);
      return;
    }

    setMsg({ type: '', text: '' });
    setSelectedFile(file);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setMsg({ type: 'error', text: 'Please select a valid document to upload.' });
      return;
    }

    setFileLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await api.uploadRagFile(selectedClientId, selectedFile);
      setMsg({ 
        type: 'success', 
        text: `Successfully parsed and loaded "${res.title}" into Vector Store!` 
      });
      setSelectedFile(null);
      const fileInput = document.getElementById('rag-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      fetchDocuments(selectedClientId);
      fetchAdminStats();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to upload and parse file.' });
    } finally {
      setFileLoading(false);
    }
  };

  const handleDelete = async (doc: any) => {
    if (!confirm('Are you sure you want to delete this knowledge document?')) return;
    const activeCid = selectedClientId === "ALL" ? (doc.client_id || '') : selectedClientId;
    if (!activeCid) return;
    try {
      await api.deleteRagDocument(activeCid, doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setMsg({ type: 'success', text: 'Document deleted from knowledge base.' });
      fetchAdminStats();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete document.' });
    }
  };

  const handleSandboxQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxQuery.trim()) return;

    setSandboxLoading(true);
    setSandboxResult([]);
    try {
      const res = await api.retrieveRag({
        client_id: selectedClientId,
        query: sandboxQuery.trim(),
        top_k: 3
      });
      setSandboxResult(res.results || []);
    } catch (err: any) {
      console.error("RAG search failed:", err);
      setMsg({ type: 'error', text: `Search failed: ${err.message || err}` });
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">RAG Knowledge Base</h2>
          <p className="text-muted-foreground mt-1">Upload and test custom business knowledge isolated for your AI agent.</p>
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
          {msg.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span className="font-medium text-sm">{msg.text}</span>
        </div>
      )}

      {/* Intro Box */}
      <div className="bg-accent/5 border border-accent/10 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent border border-accent/20 shrink-0">
          <Database className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-white">Vector Index Isolation Active</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your custom product documentation, FAQs, and company policies are stored in a client-isolated vector index. When customer emails arrive, the AI performs a real-time semantic query on your database to write exact context-aware drafts!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Upload Knowledge */}
        {user?.role !== 'admin' && (
          <div className="xl:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <div className="flex border-b border-white/10 mb-4 pb-1">
                <button 
                  onClick={() => { setActiveTab('text'); setMsg({ type: '', text: '' }); }}
                  className={`flex-1 pb-2 text-sm font-semibold transition-all ${activeTab === 'text' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                  Paste Text
                </button>
                <button 
                  onClick={() => { setActiveTab('file'); setMsg({ type: '', text: '' }); }}
                  className={`flex-1 pb-2 text-sm font-semibold transition-all ${activeTab === 'file' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
                >
                  Upload File
                </button>
              </div>

              {activeTab === 'text' ? (
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-300">Document Title / Topic</label>
                    <input 
                      type="text" required
                      placeholder="e.g. Return Policy, Pricing FAQ"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-300">Document Content (Text)</label>
                    <textarea 
                      required rows={6}
                      placeholder="Paste product specifications, FAQs, store hours, or general instructions..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white font-sans resize-none" 
                    />
                  </div>
                  <button disabled={uploadLoading} type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                    {uploadLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Save to Vector Store <Sparkles className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300 block">Supported Formats: PDF, DOC, DOCX, TXT only</label>
                    <div className="border-2 border-dashed border-white/10 hover:border-primary/50 transition-all rounded-xl p-8 flex flex-col items-center justify-center relative cursor-pointer group">
                      <input 
                        type="file" 
                        id="rag-file-input"
                        required
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-all mb-2" />
                      <span className="text-sm font-semibold text-white">
                        {selectedFile ? selectedFile.name : 'Select or drag your file here'}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Maximum file size 10MB'}
                      </span>
                    </div>
                  </div>
                  <button disabled={fileLoading || !selectedFile} type="submit" className="w-full bg-primary disabled:opacity-50 text-primary-foreground py-2.5 rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
                    {fileLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Process & Upload File <Sparkles className="w-4 h-4" /></>}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Right Column: RAG Query Sandbox & Active Directory */}
        <div className={user?.role === 'admin' ? "xl:col-span-12 space-y-6" : "xl:col-span-7 space-y-6"}>
          {/* Live RAG Query Sandbox */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-accent/5">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-white">
              <Search className="w-5 h-5 text-accent" /> Semantic Search Sandbox
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Enter queries below to inspect what context our AI will dynamically fetch for incoming emails.</p>

            <form onSubmit={handleSandboxQuery} className="flex gap-2 mb-4">
              <input 
                type="text" required
                placeholder="Ask something, e.g. What is your refund window?"
                value={sandboxQuery}
                onChange={(e) => setSandboxQuery(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 text-white" 
              />
              <button disabled={sandboxLoading} type="submit" className="bg-accent text-accent-foreground px-4 rounded-lg font-medium hover:bg-accent/90 transition-all flex items-center gap-2 text-sm">
                {sandboxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Context'}
              </button>
            </form>

            {sandboxResult && sandboxResult.length > 0 && (
              <div className="space-y-3 max-h-80 overflow-y-auto mt-4 pr-1">
                <div className="text-[10px] text-accent uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Retrieved Context chunks ({sandboxResult.length}):
                </div>
                {sandboxResult.map((result, idx) => (
                  <div key={result.id || idx} className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-1.5 hover:border-accent/20 transition-all">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-zinc-200 truncate pr-2 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-accent shrink-0" />
                        {result.title} (Chunk {idx + 1})
                      </span>
                      <span className="bg-accent/15 text-accent border border-accent/20 px-2 py-0.5 rounded text-[10px] shrink-0 font-mono">
                        {(result.score * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">{result.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Active Knowledge Directory */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col min-h-60">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-white">Active Knowledge Base Directory</h3>
              </div>
              <button onClick={fetchDocuments} className="text-muted-foreground hover:text-white p-1 rounded hover:bg-white/5 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {fetchLoading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-start bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                    <div className="space-y-1 pr-4 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <h4 className="font-semibold text-white text-sm">{doc.title}</h4>
                        {doc.chunks_count && (
                          <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                            {doc.chunks_count} chunks
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{doc.content}</p>
                    </div>
                    <button 
                      onClick={() => handleDelete(doc)}
                      className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded-xl text-muted-foreground">
                <HelpCircle className="w-10 h-10 mb-2 opacity-25" />
                <p className="text-sm font-medium">No custom knowledge loaded yet.</p>
                <p className="text-xs text-center mt-1">Use the form on the left to start feeding your AI model.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
