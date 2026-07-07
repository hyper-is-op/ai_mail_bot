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
  TestTube2,
  ActivitySquare,
  Settings,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  BarChart3,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { useState } from 'react';

// const navigation = [
//   { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
//   { name: 'Email Inbox', href: '/inbox', icon: Inbox },
//   { name: 'AI Processing', href: '/ai-processing', icon: BrainCircuit },
//   { name: 'Reference Status', href: '/tickets', icon: Ticket },
//   { name: 'Accounts', href: '/accounts', icon: Users },
//   { name: 'Payloads', href: '/payloads', icon: Code2 },
//   { name: 'RAG Knowledge', href: '/knowledge', icon: Database },
//   { name: 'LLM Analytics', href: '/llm-analytics', icon: BarChart3 },
//   { name: 'Settings', href: '/settings', icon: Settings },
// ];
const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Email Inbox', href: '/inbox', icon: Inbox },
  { name: 'AI Processing', href: '/ai-processing', icon: BrainCircuit },
  { name: 'Reference Status', href: '/tickets', icon: Ticket },
  { name: 'Accounts', href: '/accounts', icon: Users },
  { name: 'Payloads', href: '/payloads', icon: Code2 },
  { name: 'RAG Knowledge', href: '/knowledge', icon: Database },
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

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigation = user?.role === 'admin'
    ? [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'LLM Analytics', href: '/llm-analytics', icon: BarChart3 },
        { name: 'Settings', href: '/settings', icon: Settings },
        { name: 'Admin · Clients', href: '/admin/clients', icon: ShieldCheck },
        { name: 'LLM Configuration', href: '/admin/llm-configs', icon: Cpu }
      ]
    : baseNavigation;

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      <div className="flex items-center justify-between p-6 h-[80px] border-b border-zinc-200/50 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <img src="https://stg.c-zentrix.com/images/C-Zentrix-logo-white.png" alt="C-Zentrix Logo" className="h-8 object-contain dark:invert-0 invert" />
          </div>
        </div>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 scrollbar-hide">
        {navigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 border border-transparent",
                isActive
                  ? "bg-primary/10 text-primary font-medium border-primary/20 shadow-sm shadow-primary/5"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-foreground")} />
              {(!collapsed || isMobile) && <span className="whitespace-nowrap">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {!isMobile && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
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
          "glass-panel hidden md:flex flex-col h-full border-r border-white/10 transition-all duration-300 ease-in-out relative z-20",
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
          "glass-panel fixed top-0 bottom-0 left-0 w-[260px] flex flex-col h-full border-r border-white/10 z-50 md:hidden transition-all duration-300 ease-in-out transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
}
