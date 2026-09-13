import React from 'react';
import { Building2, FileSignature, Loader2, Save } from 'lucide-react';

interface SignoffTabProps {
  companyName: string;
  setCompanyName: (val: string) => void;
  departmentName: string;
  setDepartmentName: (val: string) => void;
  handleSave: (e: React.FormEvent) => void;
  saving: boolean;
  success: boolean;
}

export const SignoffTab: React.FC<SignoffTabProps> = ({
  companyName,
  setCompanyName,
  departmentName,
  setDepartmentName,
  handleSave,
  saving,
  success,
}) => {
  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white">Organization &amp; Department Sign-Off</h3>
            <p className="text-xs text-zinc-400">
              Configure the company brand and support team name used by AI when concluding and signing off customer emails.
            </p>
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
              placeholder="e.g. Customer Care &amp; Inquiries Team"
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
  );
};
