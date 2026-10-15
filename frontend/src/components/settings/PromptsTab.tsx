import { useState, useEffect } from 'react';
import {
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Code2,
  Sparkles,
  Info,
  Languages,
  Variable
} from 'lucide-react';
import { api } from '@/lib/api';
import { PromptConfigItem } from '@/lib/api/prompts';

export function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptConfigItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [currentText, setCurrentText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [resettingAll, setResettingAll] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchPrompts = async (preserveSelectedKey?: string) => {
    try {
      setLoading(true);
      const items = await api.getPrompts();
      setPrompts(items);
      const activeKey = preserveSelectedKey || selectedKey || (items[0]?.key ?? '');
      setSelectedKey(activeKey);
      const activeItem = items.find((p) => p.key === activeKey);
      if (activeItem) {
        setCurrentText(activeItem.active_text);
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to load prompts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleSelectPrompt = (key: string) => {
    setSelectedKey(key);
    const item = prompts.find((p) => p.key === key);
    if (item) {
      setCurrentText(item.active_text);
    }
    setStatusMessage(null);
  };

  const selectedItem = prompts.find((p) => p.key === selectedKey);
  const isModifiedFromActive = selectedItem ? currentText !== selectedItem.active_text : false;

  const handleSave = async () => {
    if (!selectedKey) return;
    try {
      setSaving(true);
      setStatusMessage(null);
      await api.updatePrompt(selectedKey, currentText);
      setStatusMessage({ text: 'Prompt updated successfully and saved to database.', type: 'success' });
      await fetchPrompts(selectedKey);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to save prompt', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSingle = async () => {
    if (!selectedKey) return;
    const confirmReset = window.confirm(
      `Reset "${selectedItem?.title || selectedKey}" back to codebase default? This deletes any custom override.`
    );
    if (!confirmReset) return;

    try {
      setResetting(true);
      setStatusMessage(null);
      await api.resetPrompt(selectedKey);
      setStatusMessage({ text: 'Prompt restored to default.', type: 'success' });
      await fetchPrompts(selectedKey);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to reset prompt', type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleResetAll = async () => {
    const confirmAll = window.confirm(
      'Are you sure you want to reset all 4 core prompts to factory defaults? All customizations will be restored to codebase defaults.'
    );
    if (!confirmAll) return;

    try {
      setResettingAll(true);
      setStatusMessage(null);
      await api.resetAllPrompts();
      setStatusMessage({ text: 'All prompts have been reset to factory defaults.', type: 'success' });
      await fetchPrompts();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to reset all prompts', type: 'error' });
    } finally {
      setResettingAll(false);
    }
  };

  const handleInsertVariable = (varName: string) => {
    const placeholder = `{${varName}}`;
    setCurrentText((prev) => `${prev} ${placeholder}`);
  };

  if (loading && prompts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Code2 className="h-5 w-5 animate-pulse text-primary" />
          Loading prompt registry...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#202020] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Prompt Studio &amp; Multilingual Engine
              </h2>
              <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Configure the 4 core AI system prompts governing customer support behavior: Autonomous Agent Brain, Ticket Escalation Notice, Issue Resolved Farewell, and Non-Support Boundary. All conversational responses automatically mirror customer language.
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAll}
            disabled={resettingAll}
            className="flex items-center gap-1.5 self-start sm:self-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resettingAll ? 'Resetting All...' : 'Restore All Defaults'}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-black/[0.06] dark:border-white/[0.06] pt-3 text-xs text-muted-foreground">
          <Languages className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Universal Multilingual Directive enabled across all customer-facing touchpoints</span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-sm ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Grid: Prompts List on Left, Editor on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Navigation Sidebar */}
        <div className="space-y-1.5 lg:col-span-4">
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            System Prompts ({prompts.length})
          </div>
          <div className="max-h-[640px] space-y-1.5 overflow-y-auto pr-1">
            {prompts.map((item) => {
              const isSelected = item.key === selectedKey;
              return (
                <button
                  key={item.key}
                  onClick={() => handleSelectPrompt(item.key)}
                  className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary/40 bg-primary/10 shadow-sm'
                      : 'border-border/40 bg-card/40 hover:border-border hover:bg-card/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground line-clamp-1">
                      {item.title}
                    </span>
                    {item.is_custom ? (
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-500/20">
                        Custom
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor Area */}
        <div className="space-y-4 lg:col-span-8">
          {selectedItem ? (
            <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#202020] p-5 shadow-sm space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.06] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {selectedItem.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        selectedItem.is_custom
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}
                    >
                      {selectedItem.is_custom ? 'Custom Override Active' : 'Codebase Default'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedItem.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetSingle}
                    disabled={resetting || !selectedItem.is_custom}
                    className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to Default
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || (!isModifiedFromActive && selectedItem.is_custom)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Supported Variables Pills */}
              {selectedItem.variables && selectedItem.variables.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Variable className="h-3.5 w-3.5 text-primary" />
                    <span>Click variable to insert into template:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.variables.map((v) => (
                      <button
                        key={v}
                        onClick={() => handleInsertVariable(v)}
                        type="button"
                        className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-medium text-primary hover:bg-primary/20 transition cursor-pointer"
                      >
                        {`{${v}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Code/Template Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Prompt Template</span>
                  <span>{currentText.length} characters</span>
                </div>
                <textarea
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  rows={15}
                  className="w-full rounded-xl border border-black/[0.1] dark:border-white/[0.1] bg-zinc-950 p-4 font-mono text-xs text-zinc-100 shadow-inner focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-y"
                  placeholder="Enter system prompt instructions..."
                  spellCheck={false}
                />
              </div>

              {/* Information Footnote */}
              <div className="flex items-start gap-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-3 text-xs text-muted-foreground border border-black/[0.06] dark:border-white/[0.06]">
                <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>
                  The prompt wrapper automatically enforces backend safety constraints, JSON schema formats, and anti-hallucination guardrails. Resetting to default immediately restores original tested production instructions from the codebase.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed text-muted-foreground text-sm">
              Select a prompt to begin editing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
