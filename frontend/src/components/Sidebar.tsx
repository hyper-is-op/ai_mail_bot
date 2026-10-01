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
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ShieldCheck,
  Cpu,
  FileText,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { useState } from 'react';
import { useAppState } from '@/context/AppStateContext';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  isDrafts?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { pendingDraftCount } = useAppState();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { name: 'Email Operations', href: '/dashboard', icon: LayoutDashboard },
        { name: 'LLM & AI Telemetry', href: '/dashboard?tab=llm', icon: Cpu },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Mail Monitor', href: '/inbox', icon: Inbox },
        { name: 'Drafts & Approvals', href: '/drafts', icon: FileText, isDrafts: true },
        { name: 'Tickets & Escalations', href: '/tickets', icon: Ticket },
        { name: 'AI Pipeline Trace', href: '/ai-processing', icon: BrainCircuit },
      ],
    },
    {
      title: 'Knowledge',
      items: [
        { name: 'Knowledge Base (RAG)', href: '/knowledge', icon: Database },
      ],
    },
    {
      title: isAdmin ? 'Administration' : 'Management',
      items: [
        ...(isAdmin
          ? [
              { name: 'Clients Management', href: '/admin/clients', icon: ShieldCheck },
              { name: 'AI & Models Config', href: '/admin/llm-configs', icon: Cpu },
            ]
          : []),
        { name: 'Mailbox Accounts', href: '/accounts', icon: Users },
        { name: 'Integrations & Webhooks', href: '/payloads', icon: Code2 },
      ],
    },
  ];

  const isItemActive = (href: string) => {
    if (href.includes('?tab=llm')) {
      return location.pathname === '/dashboard' && location.search.includes('tab=llm');
    }
    if (href === '/dashboard') {
      return location.pathname === '/dashboard' && !location.search.includes('tab=llm');
    }
    return location.pathname.startsWith(href);
  };

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      {/* C-Zentrix Logo & Header */}
      <div className="flex items-center justify-between px-4 py-3 h-[56px] border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="https://stg.c-zentrix.com/images/C-Zentrix-logo-white.png" alt="C-Zentrix" className="h-5 object-contain dark:invert-0 invert" />
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

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 space-y-3.5 scrollbar-hide py-2">
        {navSections.map((section, sIdx) => (
          <div key={section.title || sIdx} className="space-y-0.5">
            {section.title && (!collapsed || isMobile) && (
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive = isItemActive(item.href);

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={cn(
                    "group relative flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-120 text-xs font-medium",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold dark:bg-primary/15 before:content-[''] before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-full before:bg-primary"
                      : "text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    {(!collapsed || isMobile) && <span className="whitespace-nowrap truncate">{item.name}</span>}
                  </div>

                  {item.isDrafts && pendingDraftCount > 0 && (!collapsed || isMobile) && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                      {pendingDraftCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Windows 11 Bottom Footer: Get help & Give feedback */}
      {(!collapsed || isMobile) && (
        <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.08] space-y-0.5 shrink-0">
          <a
            href="mailto:support@c-zentrix.com"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Get help</span>
          </a>
          <a
            href="mailto:feedback@c-zentrix.com?subject=Mail%20AI%20Automation%20Feedback"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors text-left"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Give feedback</span>
          </a>
        </div>
      )}

      {!isMobile && (
        <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-all duration-120"
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
