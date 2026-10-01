import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell as BellIcon, Moon as MoonIcon, Sun as SunIcon, ChevronDown, 
  LogOut, Menu, Mail, Send, Ticket, AlertCircle, Check,
  Sliders, ChevronRight, FileText,
  Search, ArrowLeft, Zap, Activity, DollarSign, Clock, ShieldAlert
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAppState } from '@/context/AppStateContext';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { 
    theme, 
    toggleTheme, 
    pendingDraftCount,
    selectedClientId,
    setSelectedClientId,
    clients,
    isAdmin
  } = useAppState();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [profileData, setProfileData] = useState<any>(null);

  // Find a feature/page state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const routeTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/inbox': 'Mail Monitor',
    '/drafts': 'Drafts & Approvals',
    '/ai-processing': 'AI Pipeline Trace',
    '/tickets': 'Tickets & Escalations',
    '/accounts': 'Mailbox Accounts',
    '/knowledge': 'Knowledge Base (RAG)',
    '/payloads': 'Integrations & Webhooks',
    '/settings': 'Settings & Policies',
    '/admin/clients': 'Clients Management',
    '/admin/llm-configs': 'AI & Models Configuration',
  };

  const currentTitle = routeTitles[location.pathname] || 'Dashboard';

  const quickSettingsList = [
    { name: 'Email Operations', href: '/dashboard', category: 'Overview' },
    { name: 'LLM & AI Telemetry', href: '/dashboard?tab=llm', category: 'Overview' },
    { name: 'Mail Monitor', href: '/inbox', category: 'Operations' },
    { name: 'Drafts & Approvals', href: '/drafts', category: 'Operations' },
    { name: 'Tickets & Escalations', href: '/tickets', category: 'Operations' },
    { name: 'AI Pipeline Trace', href: '/ai-processing', category: 'Operations' },
    { name: 'Knowledge Base (RAG)', href: '/knowledge', category: 'Knowledge' },
    { name: 'Mailbox Accounts', href: '/accounts', category: 'Administration' },
    { name: 'Integrations & Webhooks', href: '/payloads', category: 'Administration' },
    { name: 'Settings & Policies', href: '/settings', category: 'Settings' },
    { name: 'Clients Management', href: '/admin/clients', category: 'Administration' },
    { name: 'AI & Models Configuration', href: '/admin/llm-configs', category: 'Administration' },
  ];

  const filteredQuickSettings = searchQuery.trim()
    ? quickSettingsList.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Helper for user initials
  const getInitials = (str: string) => {
    if (!str) return 'AD';
    const clean = str.split('@')[0];
    const parts = clean.split(/[._-]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  // Helper to resolve human-readable client name
  const getDisplayName = () => {
    if (profileData?.name && profileData.name.trim()) return profileData.name.trim();
    if (profileData?.company_name && profileData.company_name.trim()) return profileData.company_name.trim();
    if (user?.name && user.name.trim()) return user.name.trim();
    if (user?.company_name && user.company_name.trim()) return user.company_name.trim();
    if (user?.username && user.username.trim()) return user.username.trim();
    if (user?.role === 'admin') return 'Administrator';
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0];
      const formatted = emailPrefix
        .split(/[._-]+/)
        .filter(Boolean)
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(' ');
      if (formatted) return formatted;
    }
    return user?.client_id || 'Client';
  };

  // Notifications state
  interface SystemNotification {
    id: string;
    title: string;
    body: string;
    time: string;
    read: boolean;
    type: 'success' | 'warning' | 'info' | 'error';
    category?: 'budget' | 'infrastructure' | 'mailbox' | 'operations' | 'pipeline' | 'sentiment';
    client_id?: string;
    email_id?: number | string;
    action_url?: string;
  }
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Load user from local storage
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load client profile for name/company resolution
  useEffect(() => {
    if (user?.client_id && user?.role !== 'admin') {
      api.getEmailAccount(user.client_id)
        .then((res) => {
          if (res) setProfileData(res);
        })
        .catch(() => {});
    }
  }, [user?.client_id, user?.role]);

  // Load real system alerts and operational notifications from API
  useEffect(() => {
    const targetClientId = selectedClientId || (isAdmin ? 'ALL' : user?.client_id);
    if (!targetClientId) return;

    const fetchNotifications = async () => {
      try {
        const res = await api.getNotifications(targetClientId);
        const alertsList: any[] = res?.alerts || [];

        const readIds: string[] = JSON.parse(localStorage.getItem('read_system_notif_ids') || '[]');
        const updated: SystemNotification[] = alertsList.map((a: any) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          time: a.time,
          type: a.type || 'info',
          category: a.category,
          client_id: a.client_id,
          email_id: a.email_id,
          action_url: a.action_url,
          read: readIds.includes(a.id)
        }));

        setNotifications(updated);
        setUnreadCount(updated.filter(n => !n.read).length);
      } catch (err) {
        console.error('Failed to load system notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [selectedClientId, isAdmin, user?.client_id]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenNotifDropdown = () => {
    setShowNotifDropdown(!showNotifDropdown);
    if (!showNotifDropdown) {
      const updated = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updated);
      setUnreadCount(0);
      const readIds = notifications.map(n => n.id);
      localStorage.setItem('read_notif_ids', JSON.stringify(readIds));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const canGoBack = location.pathname !== '/dashboard' && location.pathname !== '/';

  return (
    <header className="win11-topbar h-[56px] px-3 md:px-5 flex items-center justify-between sticky top-0 z-20 shadow-xs select-none">
      {/* Left: Navigation Arrow / Breadcrumb Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground md:hidden transition-all duration-150"
          aria-label="Open Navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {canGoBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-all duration-150 hidden md:flex items-center justify-center"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-tight">
          {location.pathname !== '/dashboard' && (
            <>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Home
              </button>
              <span className="text-muted-foreground/60 text-xs font-normal">/</span>
            </>
          )}
          <span className="text-foreground">
            {currentTitle}
          </span>
        </div>
      </div>

      {/* Center: Quick navigation & module search */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-sm lg:max-w-md mx-4 relative" ref={searchRef}>
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search modules, settings, or tools..."
            value={searchQuery}
            onFocus={() => setShowSearchDropdown(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            className="w-full bg-white/70 dark:bg-[#282828] text-xs text-foreground placeholder:text-muted-foreground pl-9 pr-3 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:border-b-2 focus:border-b-primary shadow-2xs transition-all"
          />
        </div>

        {showSearchDropdown && filteredQuickSettings.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#2C2C2C] border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden z-50 py-1 max-h-64 overflow-y-auto">
            {filteredQuickSettings.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  navigate(item.href);
                  setShowSearchDropdown(false);
                  setSearchQuery('');
                }}
                className="w-full px-3.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-between group transition-colors"
              >
                <span className="text-xs font-medium text-foreground">{item.name}</span>
                <span className="text-[10px] text-muted-foreground bg-black/[0.04] dark:bg-white/[0.08] px-2 py-0.5 rounded-full">{item.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-2">
        {pendingDraftCount > 0 && (
          <button
            onClick={() => navigate('/drafts')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-xs transition-all duration-150 animate-in fade-in cursor-pointer"
            title={`${pendingDraftCount} draft(s) awaiting review`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            <span>{pendingDraftCount} Pending Drafts</span>
          </button>
        )}

        {isAdmin && clients.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#2C2C2C] border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1 rounded-md shadow-2xs">
            <span className="text-xs text-muted-foreground font-medium">Tenant:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-xs text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-card text-foreground">ALL</option>
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id} className="bg-card text-foreground">
                  {c.client_id} {c.company_name ? `(${c.company_name})` : (c.email ? `(${c.email})` : '')}
                </option>
              ))}
            </select>
          </div>
        )}

        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
          {theme === 'dark' ? <SunIcon className="w-4.5 h-4.5" /> : <MoonIcon className="w-4.5 h-4.5" />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={handleOpenNotifDropdown}
            className="relative p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
          >
            <BellIcon className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-accent rounded-full border border-background text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-zinc-100 dark:border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">System Alerts</span>
                  {notifications.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-muted-foreground">
                      {notifications.length}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      const updated = notifications.map(n => ({ ...n, read: true }));
                      setNotifications(updated);
                      setUnreadCount(0);
                      localStorage.setItem('read_system_notif_ids', JSON.stringify(notifications.map(n => n.id)));
                    }}
                    className="text-xs text-primary hover:underline font-medium transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
                {notifications.length > 0 ? (
                  notifications.map((notif) => {
                    let Icon = Activity;
                    let iconColor = 'text-blue-500 bg-blue-500/10 dark:text-blue-400';

                    if (notif.category === 'budget') {
                      Icon = DollarSign;
                      iconColor = notif.type === 'error' ? 'text-rose-500 bg-rose-500/10 dark:text-rose-400' : 'text-amber-500 bg-amber-500/10 dark:text-amber-400';
                    } else if (notif.category === 'infrastructure') {
                      Icon = Zap;
                      iconColor = 'text-rose-500 bg-rose-500/10 dark:text-rose-400';
                    } else if (notif.category === 'mailbox') {
                      Icon = Mail;
                      iconColor = 'text-rose-500 bg-rose-500/10 dark:text-rose-400';
                    } else if (notif.category === 'operations') {
                      Icon = Clock;
                      iconColor = 'text-amber-500 bg-amber-500/10 dark:text-amber-400';
                    } else if (notif.category === 'sentiment') {
                      Icon = ShieldAlert;
                      iconColor = 'text-orange-500 bg-orange-500/10 dark:text-orange-400';
                    } else if (notif.type === 'error') {
                      Icon = AlertCircle;
                      iconColor = 'text-rose-500 bg-rose-500/10 dark:text-rose-400';
                    } else if (notif.type === 'warning') {
                      Icon = Ticket;
                      iconColor = 'text-amber-500 bg-amber-500/10 dark:text-amber-400';
                    } else if (notif.type === 'success') {
                      Icon = Send;
                      iconColor = 'text-emerald-500 bg-emerald-500/10 dark:text-emerald-400';
                    }

                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          // Mark as read
                          const readIds: string[] = JSON.parse(localStorage.getItem('read_system_notif_ids') || '[]');
                          if (!readIds.includes(notif.id)) {
                            readIds.push(notif.id);
                            localStorage.setItem('read_system_notif_ids', JSON.stringify(readIds));
                            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                            setUnreadCount(prev => Math.max(0, prev - 1));
                          }
                          // Switch active client if specific to another client
                          if (notif.client_id && notif.client_id !== 'ALL' && notif.client_id !== selectedClientId) {
                            setSelectedClientId(notif.client_id);
                          }
                          if (notif.email_id) {
                            localStorage.setItem('selected_email_id', notif.email_id.toString());
                          }
                          setShowNotifDropdown(false);
                          if (notif.action_url) {
                            navigate(notif.action_url);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                        className={`p-3.5 flex gap-3 cursor-pointer transition-colors ${
                          !notif.read ? 'bg-zinc-50/80 dark:bg-white/[0.04]' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${iconColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{notif.title}</p>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 font-medium">{notif.time}</span>
                          </div>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{notif.body}</p>
                        </div>
                        {!notif.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center"></div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-zinc-400 dark:text-zinc-500 flex flex-col items-center gap-2">
                    <Check className="w-8 h-8 text-emerald-500/70" />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">All systems normal</span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">No active operational alerts or incidents.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1"></div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`group flex items-center gap-2.5 p-1.5 pl-2 pr-3 rounded-full transition-all duration-200 cursor-pointer border ${
              showDropdown
                ? 'bg-zinc-200 dark:bg-white/10 border-primary/40 shadow-sm ring-2 ring-primary/20'
                : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:bg-zinc-200/80 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/20'
            }`}
          >
            {/* Gradient Avatar with Initials and Online Status Indicator */}
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white font-black text-xs tracking-wider shadow-sm ring-1 ring-white/20">
                {getInitials(getDisplayName())}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-950 rounded-full"></span>
            </div>

            {/* Name & Role Text */}
            <div className="hidden md:flex flex-col text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground truncate max-w-[130px]">
                  {getDisplayName()}
                </span>
                {user?.role === 'admin' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground truncate max-w-[140px] font-mono leading-tight">
                {user?.email || 'System Account'}
              </span>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ml-0.5 ${showDropdown ? 'rotate-180 text-primary' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2.5 w-72 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* User Profile Header Card */}
              <div className="p-4 bg-gradient-to-b from-primary/5 dark:from-white/5 to-transparent border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-primary/30 shrink-0">
                    {getInitials(getDisplayName())}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                        {getDisplayName()}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono mt-0.5">
                      {user?.email || 'admin@centrix.ai'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active · {user?.role === 'admin' ? 'Administrator' : (user?.client_id || 'Account')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Account Links */}
              <div className="p-2 space-y-1">
                <button
                  onClick={() => { setShowDropdown(false); navigate('/settings'); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
                    <span>Settings & Policies</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                </button>
              </div>

              {/* Sign Out Footer */}
              <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-black/20">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
