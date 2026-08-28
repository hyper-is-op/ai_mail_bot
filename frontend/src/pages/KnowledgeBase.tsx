import { useState, useEffect } from 'react';
import { BookOpen, UploadCloud, CheckCircle2, Trash2, Search, Sparkles, Database, RefreshCw, FileText, Loader2, AlertCircle } from 'lucide-react';
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
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Knowledge Base</h2>
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
      <div className="win11-card p-5 rounded-lg flex flex-col md:flex-row gap-4 items-start md:items-center shadow-2xs">
        <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-foreground text-sm">Vector Index Isolation Active</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your custom product documentation, FAQs, and company policies are stored in a client-isolated vector index. When customer emails arrive, the AI performs a real-time semantic query on your database to write exact context-aware drafts!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Column: Upload Knowledge */}
        {user?.role !== 'admin' && (
          <div className="xl:col-span-5 space-y-4">
            <div className="win11-card p-5 rounded-lg shadow-2xs">
              <div className="flex border-b border-black/[0.06] dark:border-white/[0.08] mb-4 pb-1">
                <button 
                  onClick={() => { setActiveTab('text'); setMsg({ type: '', text: '' }); }}
                  className={`flex-1 pb-2 text-xs font-semibold transition-all ${activeTab === 'text' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Paste Text
                </button>
                <button 
                  onClick={() => { setActiveTab('file'); setMsg({ type: '', text: '' }); }}
                  className={`flex-1 pb-2 text-xs font-semibold transition-all ${activeTab === 'file' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Upload File
                </button>
              </div>

              {activeTab === 'text' ? (
                <form onSubmit={handleUpload} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Document Title / Topic</label>
                    <input 
                      type="text" required
                      placeholder="e.g. Return Policy, Pricing FAQ"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-b-2 focus:border-b-primary text-foreground shadow-2xs" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Document Content (Text)</label>
                    <textarea 
                      required rows={6}
                      placeholder="Paste product specifications, FAQs, store hours, or general instructions..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-b-2 focus:border-b-primary text-foreground font-sans resize-none shadow-2xs" 
                    />
                  </div>
                  <button disabled={uploadLoading} type="submit" className="w-full bg-primary text-primary-foreground py-2 rounded-md font-semibold text-xs shadow-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save to Vector Store <Sparkles className="w-3.5 h-3.5" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleFileUpload} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">Supported Formats: PDF, DOC, DOCX, TXT only</label>
                    <div className="border-2 border-dashed border-black/[0.1] dark:border-white/[0.1] hover:border-primary/50 transition-all rounded-lg p-6 flex flex-col items-center justify-center relative cursor-pointer group">
                      <input 
                        type="file" 
                        id="rag-file-input"
                        required
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-all mb-1.5" />
                      <span className="text-xs font-semibold text-foreground">
                        {selectedFile ? selectedFile.name : 'Select or drag your file here'}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Maximum file size 10MB'}
                      </span>
                    </div>
                  </div>
                  <button disabled={fileLoading || !selectedFile} type="submit" className="w-full bg-primary disabled:opacity-50 text-primary-foreground py-2 rounded-md font-semibold text-xs shadow-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    {fileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Process &amp; Upload File <Sparkles className="w-3.5 h-3.5" /></>}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Right Column: RAG Query Sandbox & Active Directory */}
        <div className={user?.role === 'admin' ? "xl:col-span-12 space-y-4" : "xl:col-span-7 space-y-4"}>
          {/* Live RAG Query Sandbox */}
          <div className="win11-card p-5 rounded-lg shadow-2xs">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-foreground">
              <Search className="w-4 h-4 text-primary" /> Semantic Search Sandbox
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Enter queries below to inspect what context our AI will dynamically fetch for incoming emails.</p>

            <form onSubmit={handleSandboxQuery} className="flex gap-2 mb-3">
              <input 
                type="text" required
                placeholder="Ask something, e.g. What is your refund window?"
                value={sandboxQuery}
                onChange={(e) => setSandboxQuery(e.target.value)}
                className="flex-1 bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-b-2 focus:border-b-primary text-foreground shadow-2xs" 
              />
              <button disabled={sandboxLoading} type="submit" className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 text-xs shadow-xs cursor-pointer">
                {sandboxLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch Context'}
              </button>
            </form>

            {sandboxResult && sandboxResult.length > 0 && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto mt-3 pr-1">
                <div className="text-[10px] text-primary uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Retrieved Context chunks ({sandboxResult.length}):
                </div>
                {sandboxResult.map((result, idx) => (
                  <div key={result.id || idx} className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] rounded-lg p-3 space-y-1 hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-foreground truncate pr-2 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-primary shrink-0" />
                        {result.title} (Chunk {idx + 1})
                      </span>
                      <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[10px] shrink-0 font-mono">
                        {(result.score * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">{result.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Knowledge Directory */}
          <div className="win11-card p-5 rounded-lg flex flex-col min-h-60 shadow-2xs">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Active Knowledge Base Directory</h3>
              </div>
              <button onClick={() => fetchDocuments()} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {fetchLoading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-start bg-black/[0.02] dark:bg-white/[0.03] p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.06] hover:border-primary/20 transition-all">
                    <div className="space-y-1 pr-4 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <h4 className="font-semibold text-foreground text-xs">{doc.title}</h4>
                        {doc.chunks_count && (
                          <span className="bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground text-[10px] px-1.5 py-0.2 rounded font-mono">
                            {doc.chunks_count} chunks
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{doc.content}</p>
                      <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-3">
                        <span>Updated: {doc.created_at || 'Recently'}</span>
                        {doc.doc_type && <span className="uppercase text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{doc.doc_type}</span>}
                      </div>
                    </div>
                    {user?.role !== 'admin' && (
                      <button 
                        onClick={() => handleDelete(doc.id)} 
                        className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-all cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Database className="w-8 h-8 mb-2 opacity-30 text-foreground" />
                <p className="text-xs">No documents uploaded yet.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Use the upload tool to populate context for AI reply generation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
