import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Inbox,
  BrainCircuit,
  Ticket,
  Users,
  Code2,
  Database,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  BarChart3,
  ShieldCheck,
  Cpu,
  FileText,
  Search
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pause & Draft', href: '/drafts', icon: FileText },
  { name: 'Mail (Monitor/Control)', href: '/inbox', icon: Inbox },
  { name: 'AI Processing', href: '/ai-processing', icon: BrainCircuit },
  { name: 'Reference Status', href: '/tickets', icon: Ticket },
  { name: 'Accounts', href: '/accounts', icon: Users },
  { name: 'System Connector', href: '/payloads', icon: Code2 },
  { name: 'Knowledge Base', href: '/knowledge', icon: Database },
  { name: 'LLM Analytics', href: '/llm-analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<number>(0);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigation = user?.role === 'admin'
    ? [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Mail (Monitor/Control)', href: '/inbox', icon: Inbox },
        { name: 'Pause & Draft', href: '/drafts', icon: FileText },
        { name: 'AI Processing', href: '/ai-processing', icon: BrainCircuit },
        { name: 'Reference Status', href: '/tickets', icon: Ticket },
        { name: 'Mailbox Accounts', href: '/accounts', icon: Users },
        { name: 'System Connector', href: '/payloads', icon: Code2 },
        { name: 'Knowledge Base', href: '/knowledge', icon: Database },
        { name: 'LLM Analytics', href: '/llm-analytics', icon: BarChart3 },
        { name: 'Settings', href: '/settings', icon: Settings },
        { name: 'Clients Management', href: '/admin/clients', icon: ShieldCheck },
        { name: 'AI & LLM Configuration', href: '/admin/llm-configs', icon: Cpu }
      ]
    : baseNavigation;

  useEffect(() => {
    if (!user) return;
    const fetchPending = async () => {
      try {
        const res = await api.getPendingDraftsCount(user?.role === 'admin' ? undefined : user.client_id);
        if (res && typeof res.pending_count === 'number') {
          setPendingDrafts(res.pending_count);
        }
      } catch (e) {
        // silent
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [user?.client_id, user?.role]);

  const [navSearch, setNavSearch] = useState('');

  const filteredNav = navigation.filter(item =>
    item.name.toLowerCase().includes(navSearch.toLowerCase())
  );

  const getInitials = () => {
    const name = user?.name || user?.username || user?.email || 'AD';
    return name.slice(0, 2).toUpperCase();
  };

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      {/* Windows 11 Logo & Header */}
      <div className="flex items-center justify-between px-4 py-3 h-[60px] border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <img src="https://stg.c-zentrix.com/images/C-Zentrix-logo-white.png" alt="Logo" className="h-6 object-contain dark:invert-0 invert" />
          {(!collapsed || isMobile) && (
            <span className="text-xs font-bold text-foreground uppercase tracking-wider opacity-80">Settings</span>
          )}
        </div>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Windows 11 Account Card & Search */}
      {(!collapsed || isMobile) && (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/70 dark:bg-[#282828] border border-black/[0.06] dark:border-white/[0.06] shadow-xs">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {getInitials()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate">{user?.name || user?.email || 'Administrator'}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.role === 'admin' ? 'System Admin' : (user?.client_id || 'Client')}</div>
            </div>
          </div>

          {/* Windows 11 Find a setting box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Find a setting"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              className="w-full bg-white/60 dark:bg-[#282828] text-xs text-foreground placeholder:text-muted-foreground pl-8 pr-2.5 py-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 space-y-0.5 scrollbar-hide py-1">
        {filteredNav.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          const isDrafts = item.href === '/drafts';

          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "group relative flex items-center justify-between px-3 py-2 rounded-md transition-all duration-120 text-xs font-medium",
                isActive
                  ? "bg-black/[0.06] dark:bg-white/[0.08] text-primary font-semibold before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-full before:bg-primary"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive ? "text-primary" : "text-zinc-500 dark:text-zinc-400 group-hover:text-foreground")} />
                {(!collapsed || isMobile) && <span className="whitespace-nowrap truncate">{item.name}</span>}
              </div>

              {isDrafts && pendingDrafts > 0 && (!collapsed || isMobile) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                  {pendingDrafts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!isMobile && (
        <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-all duration-120"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "win11-sidebar hidden md:flex flex-col h-full transition-all duration-300 ease-in-out relative z-20",
          collapsed ? "w-[80px]" : "w-[260px]"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300 ease-in-out"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={cn(
          "win11-sidebar fixed top-0 bottom-0 left-0 w-[260px] flex flex-col h-full z-50 md:hidden transition-all duration-300 ease-in-out transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
}
