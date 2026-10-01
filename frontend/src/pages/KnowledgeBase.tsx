import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  UploadCloud, 
  CheckCircle2, 
  Trash2, 
  Search, 
  Sparkles, 
  Database, 
  RefreshCw, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Plus, 
  X, 
  Eye, 
  Copy, 
  Check, 
  Layers, 
  ShieldCheck, 
  Filter, 
  Cpu
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppState } from '@/context/AppStateContext';
import { cn } from '@/lib/utils';

export default function KnowledgeBase() {
  const { selectedClientId, clients } = useAppState();

  const [documents, setDocuments] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'library' | 'sandbox'>('library');

  // Search & Filter in Library
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'PDF' | 'DOCX' | 'TXT' | 'MD'>('ALL');

  // Add Knowledge Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'file' | 'text'>('file');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Inspect Document Modal
  const [inspectDoc, setInspectDoc] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Notification Toast / Message
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  // Semantic Retrieval Sandbox
  const [sandboxQuery, setSandboxQuery] = useState('');
  const [sandboxResult, setSandboxResult] = useState<any[]>([]);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

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
      setDocuments(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: err.message || 'Failed to fetch knowledge base documents.' });
    } finally {
      setFetchLoading(false);
    }
  };

  // Upload Text
  const handleUploadText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setMsg({ type: 'error', text: 'Please provide both document title and body text.' });
      return;
    }

    const targetCid = selectedClientId === 'ALL' ? (clients[0]?.client_id || 'default') : selectedClientId;

    setActionLoading(true);
    setMsg({ type: '', text: '' });
    try {
      await api.uploadRagData({
        client_id: targetCid,
        title: title.trim(),
        content: content.trim()
      });
      setMsg({ type: 'success', text: `Document "${title.trim()}" successfully indexed into Vector Store!` });
      setTitle('');
      setContent('');
      setShowAddModal(false);
      fetchDocuments(selectedClientId);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to save knowledge document.' });
    } finally {
      setActionLoading(false);
    }
  };

  // File selection & drop handling
  const handleFileChange = (file?: File | null) => {
    if (!file) return;

    const allowedExtensions = ['md', 'markdown', 'txt', 'docx', 'doc', 'pdf'];
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!ext || !allowedExtensions.includes(ext)) {
      setMsg({ 
        type: 'error', 
        text: `Invalid file format (.${ext || 'unknown'}). Allowed: ${allowedExtensions.map(e => `.${e}`).join(', ')}` 
      });
      setSelectedFile(null);
      return;
    }

    setMsg({ type: '', text: '' });
    setSelectedFile(file);
  };

  // Upload File
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setMsg({ type: 'error', text: 'Please select a document file to upload.' });
      return;
    }

    const targetCid = selectedClientId === 'ALL' ? (clients[0]?.client_id || 'default') : selectedClientId;

    setActionLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await api.uploadRagFile(targetCid, selectedFile);
      setMsg({ 
        type: 'success', 
        text: `Parsed and indexed "${res.title || selectedFile.name}" into Vector Store!` 
      });
      setSelectedFile(null);
      setShowAddModal(false);
      fetchDocuments(selectedClientId);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to parse and upload file.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Document
  const handleDelete = async (doc: any) => {
    if (!confirm(`Are you sure you want to permanently delete "${doc.title}" from the knowledge base?`)) return;
    const activeCid = selectedClientId === 'ALL' ? (doc.client_id || clients[0]?.client_id || '') : selectedClientId;
    if (!activeCid) return;

    try {
      await api.deleteRagDocument(activeCid, doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      if (inspectDoc?.id === doc.id) setInspectDoc(null);
      setMsg({ type: 'success', text: `Document "${doc.title}" deleted from knowledge store.` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete document.' });
    }
  };

  // Sandbox Query
  const handleSandboxQuery = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery !== undefined ? customQuery : sandboxQuery;
    if (!query.trim()) return;

    const targetCid = selectedClientId === 'ALL' ? (clients[0]?.client_id || '') : selectedClientId;
    if (!targetCid) {
      setMsg({ type: 'error', text: 'Please select a specific client tenant to test retrieval.' });
      return;
    }

    setSandboxLoading(true);
    setSandboxResult([]);
    setHasQueried(true);
    try {
      const res = await api.retrieveRag({
        client_id: targetCid,
        query: query.trim(),
        top_k: 4
      });
      setSandboxResult(res.results || []);
    } catch (err: any) {
      console.error('RAG query failed:', err);
      setMsg({ type: 'error', text: `Semantic retrieval failed: ${err.message || err}` });
    } finally {
      setSandboxLoading(false);
    }
  };

  // Copy inspect text
  const handleCopyContent = () => {
    if (!inspectDoc?.content) return;
    navigator.clipboard.writeText(inspectDoc.content);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Metrics calculation
  const totalDocs = documents.length;
  const totalEstimatedChunks = useMemo(() => {
    return documents.reduce((acc, doc) => {
      if (doc.chunks_count) return acc + Number(doc.chunks_count);
      const textLen = (doc.content || '').length;
      return acc + Math.max(1, Math.ceil(textLen / 450));
    }, 0);
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = !searchQuery.trim() || 
        (doc.title && doc.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (formatFilter === 'ALL') return true;
      const type = (doc.doc_type || '').toUpperCase();
      const ext = (doc.title?.split('.').pop() || '').toUpperCase();
      if (formatFilter === 'PDF') return type === 'PDF' || ext === 'PDF';
      if (formatFilter === 'DOCX') return type.includes('DOC') || ext.includes('DOC');
      if (formatFilter === 'TXT') return type === 'TXT' || ext === 'TXT';
      if (formatFilter === 'MD') return type.includes('MD') || ext.includes('MD');
      return true;
    });
  }, [documents, searchQuery, formatFilter]);

  const activeTenantName = useMemo(() => {
    if (!selectedClientId || selectedClientId === 'ALL') return 'Fleet (All Clients)';
    const found = clients.find(c => c.client_id === selectedClientId);
    return found?.company_name || found?.email || selectedClientId;
  }, [selectedClientId, clients]);

  return (
    <div className="space-y-5 select-none pb-12">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Database className="w-6 h-6 text-primary" />
            <span>Knowledge Base (RAG)</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {activeTenantName}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Domain business knowledge, product specs, and isolated vector embeddings for automated AI drafting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDocuments()}
            disabled={fetchLoading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md win11-card hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground transition-all cursor-pointer shadow-2xs"
            title="Refresh Knowledge Base"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", fetchLoading && "animate-spin text-primary")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => { setShowAddModal(true); setMsg({ type: '', text: '' }); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Knowledge</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {msg.text && (
        <div className={cn(
          "p-3 rounded-lg border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in duration-150",
          msg.type === 'error'
            ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
        )}>
          <div className="flex items-center gap-2">
            {msg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg({ type: '', text: '' })} className="hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="win11-card p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Indexed Documents</span>
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground mt-1">
            {totalDocs}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Active in current tenant scope
          </div>
        </div>

        <div className="win11-card p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Vector Chunks</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground mt-1">
            {totalEstimatedChunks}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Tokenized for semantic search
          </div>
        </div>

        <div className="win11-card p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Vector Store</span>
            <Cpu className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-foreground">Qdrant Active</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Cosine distance index
          </div>
        </div>

        <div className="win11-card p-3.5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Isolation Scope</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-foreground truncate mt-1">
            {selectedClientId === 'ALL' ? 'Fleet-Wide' : selectedClientId}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            100% Tenant Partitioned
          </div>
        </div>
      </div>

      {/* Main View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.08] pb-1">
        <button
          onClick={() => setViewTab('library')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
            viewTab === 'library'
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
          )}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Knowledge Library ({totalDocs})</span>
        </button>

        <button
          onClick={() => setViewTab('sandbox')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
            viewTab === 'sandbox'
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Retrieval Testing Sandbox</span>
        </button>
      </div>

      {/* View 1: Knowledge Library */}
      {viewTab === 'library' && (
        <div className="space-y-3">
          {/* Search and Filters Toolbar */}
          <div className="win11-card p-2 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search documents by title or content snippet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] text-muted-foreground font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Format:
              </span>
              {(['ALL', 'PDF', 'DOCX', 'TXT', 'MD'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormatFilter(fmt)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                    formatFilter === fmt
                      ? "bg-black/[0.08] dark:bg-white/[0.12] text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Table / Card List */}
          {fetchLoading ? (
            <div className="min-h-[35vh] flex flex-col items-center justify-center space-y-3 win11-card rounded-lg">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Loading vector indexed documents...</p>
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="win11-card rounded-lg border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground font-semibold text-[11px]">
                      <th className="py-2.5 px-4">Document Title</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3">Chunks</th>
                      <th className="py-2.5 px-3">Snippet Preview</th>
                      <th className="py-2.5 px-3">Indexed On</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {filteredDocuments.map(doc => {
                      const ext = (doc.title?.split('.').pop() || doc.doc_type || 'TXT').toUpperCase();
                      const chunkEstimate = doc.chunks_count || Math.max(1, Math.ceil((doc.content || '').length / 450));

                      return (
                        <tr 
                          key={doc.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors group"
                        >
                          <td className="py-3 px-4 font-semibold text-foreground">
                            <div className="flex items-center gap-2.5 max-w-[220px] sm:max-w-xs">
                              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate" title={doc.title}>{doc.title}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-foreground uppercase border border-black/[0.05] dark:border-white/[0.05]">
                              {ext}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                              {chunkEstimate} {chunkEstimate === 1 ? 'chunk' : 'chunks'}
                            </span>
                          </td>

                          <td className="py-3 px-3 max-w-sm text-muted-foreground truncate">
                            <span className="truncate block" title={doc.content}>
                              {doc.content?.slice(0, 100) || 'No snippet available.'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap text-[11px]">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Active'}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectDoc(doc)}
                                className="p-1.5 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                title="Inspect Full Text & Chunks"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(doc)}
                                className="p-1.5 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                                title="Delete Document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="win11-card p-12 rounded-lg text-center flex flex-col items-center justify-center space-y-3">
              <Database className="w-10 h-10 text-muted-foreground/30" />
              <div>
                <h4 className="text-sm font-semibold text-foreground">No knowledge documents found</h4>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  {searchQuery.trim() || formatFilter !== 'ALL'
                    ? 'No documents match your active search and format filters.'
                    : 'Your knowledge base is currently empty. Upload business guidelines, FAQs, or manuals to empower context-aware AI replies.'}
                </p>
              </div>
              <button
                onClick={() => { setShowAddModal(true); setMsg({ type: '', text: '' }); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* View 2: Semantic Retrieval Testing Sandbox */}
      {viewTab === 'sandbox' && (
        <div className="space-y-4">
          <div className="win11-card p-5 rounded-lg border border-black/[0.06] dark:border-white/[0.08] shadow-2xs space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Semantic Retrieval Sandbox</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulate inbound email customer inquiries to inspect the exact context chunks and cosine similarity rankings our AI agent pulls from your vector store.
              </p>
            </div>

            {/* Query Form */}
            <form onSubmit={handleSandboxQuery} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="e.g. What is the return and refund policy? How can I track my shipment?"
                  value={sandboxQuery}
                  onChange={(e) => setSandboxQuery(e.target.value)}
                  className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
                />
              </div>

              <button
                type="submit"
                disabled={sandboxLoading || !sandboxQuery.trim()}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold px-4 py-2 rounded-md text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                {sandboxLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Fetch Vector Context</span>
              </button>
            </form>

            {/* Quick Example Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Try example queries:</span>
              {[
                "What is your refund policy?",
                "How do I track my delivery?",
                "What are your working hours?",
                "Do you ship internationally?",
              ].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setSandboxQuery(q); handleSandboxQuery(undefined, q); }}
                  className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-primary/10 hover:text-primary text-[11px] text-muted-foreground transition-all cursor-pointer border border-black/[0.04] dark:border-white/[0.04]"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Results Display */}
          {sandboxLoading ? (
            <div className="win11-card p-12 rounded-lg text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Running embedding vector search in Qdrant...</p>
            </div>
          ) : hasQueried && sandboxResult.length === 0 ? (
            <div className="win11-card p-10 rounded-lg text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-80" />
              <h4 className="text-sm font-semibold text-foreground">No matching context found</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                The cosine similarity score for this query did not meet the relevance floor. Try rephrasing or upload documentation covering this topic.
              </p>
            </div>
          ) : sandboxResult.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                <span>Top Context Chunks Retrieved ({sandboxResult.length})</span>
                <span className="font-mono text-[11px]">Ranked by Cosine Similarity</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sandboxResult.map((result, idx) => {
                  const matchPct = Math.round((result.score || 0) * 100);
                  const isHighMatch = matchPct >= 75;

                  return (
                    <div 
                      key={result.id || idx}
                      className="win11-card p-4 rounded-lg border border-black/[0.06] dark:border-white/[0.08] space-y-2.5 shadow-2xs hover:border-primary/40 transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-xs text-foreground truncate" title={result.title}>
                              {result.title || 'Untitled Document'}
                            </span>
                          </div>

                          <div className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 border",
                            isHighMatch
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          )}>
                            {matchPct}% Match
                          </div>
                        </div>

                        {/* Progress similarity meter */}
                        <div className="w-full bg-black/[0.06] dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              isHighMatch ? "bg-emerald-500" : "bg-amber-500"
                            )}
                            style={{ width: `${Math.min(100, Math.max(5, matchPct))}%` }}
                          />
                        </div>

                        {/* Chunk Content */}
                        <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] p-3 rounded-md text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {result.content}
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <span>Chunk ID: <span className="font-mono">{result.id ? String(result.id).slice(0, 8) : 'auto'}</span></span>
                        <span>Relevance: {matchPct > 80 ? 'Very High' : matchPct > 65 ? 'Moderate' : 'Low'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Add Knowledge Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="win11-card w-full max-w-xl rounded-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 bg-background">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Add Knowledge to Vector Store</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex border-b border-black/[0.06] dark:border-white/[0.08] px-5 pt-3">
              <button
                type="button"
                onClick={() => setAddMode('file')}
                className={cn(
                  "pb-2.5 px-3 text-xs font-semibold transition-all border-b-2",
                  addMode === 'file'
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Upload File (.pdf, .docx, .txt, .md)
              </button>
              <button
                type="button"
                onClick={() => setAddMode('text')}
                className={cn(
                  "pb-2.5 px-3 text-xs font-semibold transition-all border-b-2",
                  addMode === 'text'
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Paste Plain Text / Markdown
              </button>
            </div>

            <div className="p-5">
              {addMode === 'file' ? (
                <form onSubmit={handleUploadFile} className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                    }}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center relative cursor-pointer transition-all",
                      isDragging 
                        ? "border-primary bg-primary/5" 
                        : "border-black/[0.12] dark:border-white/[0.12] hover:border-primary/50"
                    )}
                  >
                    <input
                      type="file"
                      id="modal-rag-file-input"
                      accept=".md,.markdown,.txt,.docx,.doc,.pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-10 h-10 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-semibold text-foreground">
                      {selectedFile ? selectedFile.name : 'Choose a file or drag & drop here'}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Supports PDF, Word (.docx), TXT, and Markdown (Max 10MB)'}
                    </span>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center justify-between p-2.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-md border border-black/[0.06] dark:border-white/[0.06] text-xs">
                      <span className="truncate max-w-sm text-foreground font-medium">{selectedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading || !selectedFile}
                      className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Index Document</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleUploadText} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Document Title / Topic</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Warranty Policy 2026, Store Locations, Enterprise SLAs"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-b-2 focus:border-b-primary text-foreground shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Content Body</label>
                    <textarea
                      required
                      rows={7}
                      placeholder="Paste return procedures, customer support guidelines, product pricing tables, or troubleshooting steps..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full bg-white dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-b-2 focus:border-b-primary text-foreground resize-none font-mono shadow-2xs leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Save &amp; Vectorize</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inspect Document Modal */}
      {inspectDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="win11-card w-full max-w-2xl rounded-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 bg-background flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-3">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <h3 className="text-sm font-bold text-foreground truncate" title={inspectDoc.title}>
                  {inspectDoc.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyContent}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setInspectDoc(null)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Estimated Chunks</span>
                  <p className="font-bold text-foreground mt-0.5">
                    {inspectDoc.chunks_count || Math.max(1, Math.ceil((inspectDoc.content || '').length / 450))}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Character Count</span>
                  <p className="font-bold text-foreground mt-0.5">{(inspectDoc.content || '').length.toLocaleString()} chars</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Document Format</span>
                  <p className="font-bold text-foreground mt-0.5 uppercase">{inspectDoc.doc_type || 'Text / MD'}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">Full Extracted Content</label>
                <div className="p-3.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {inspectDoc.content}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.08] flex justify-between items-center bg-black/[0.01] dark:bg-white/[0.01] shrink-0">
              <button
                onClick={() => handleDelete(inspectDoc)}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Document</span>
              </button>
              <button
                onClick={() => setInspectDoc(null)}
                className="bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] text-foreground text-xs font-medium px-4 py-1.5 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
