import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell as BellIcon, Moon as MoonIcon, Sun as SunIcon, ChevronDown, 
  LogOut, Menu, Mail, Send, Ticket, AlertCircle, Check,
  Sliders, Cpu, Users, Code2, ChevronRight, FileText
} from 'lucide-react';
import { api } from '@/lib/api';

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [profileData, setProfileData] = useState<any>(null);
  const [pendingDraftCount, setPendingDraftCount] = useState<number>(0);

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
  interface Notification {
    id: string;
    title: string;
    body: string;
    time: string;
    read: boolean;
    type: 'success' | 'warning' | 'info' | 'error';
  }
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  // Poll pending drafts count
  useEffect(() => {
    if (!user) return;
    const fetchDraftCount = async () => {
      try {
        const res = await api.getPendingDraftsCount(user?.role === 'admin' ? undefined : user.client_id);
        if (res && typeof res.pending_count === 'number') {
          setPendingDraftCount(res.pending_count);
        }
      } catch (err) {
        // silent fallback
      }
    };
    fetchDraftCount();
    const interval = setInterval(fetchDraftCount, 15000);
    return () => clearInterval(interval);
  }, [user?.client_id, user?.role]);

  // Load notifications from API
  useEffect(() => {
    if (!user || !user.client_id) return;

    const fetchNotifications = async () => {
      try {
        const emails = await api.getEmails(user.client_id);
        const recentEmails = emails.slice(0, 5);

        const mapped = recentEmails.map((email: any) => {
          let title = 'New Email Received';
          let body = `Received email from ${email.sender}`;
          let type: 'success' | 'warning' | 'info' | 'error' = 'info';

          const isReplied = email.raw_status === 'sent' || email.raw_status === 'ticket_created_and_sent' || email.status === 'Replied';
          const isTicket = email.raw_status === 'ticket_created' || email.status === 'Ticket_Generated';
          const isFailed = email.raw_status === 'failed' || email.status === 'Failed';

          if (isReplied) {
            title = 'AI Auto-Reply Sent';
            body = `Auto-reply dispatched to ${email.sender} (${email.confidence || '90%'} confidence)`;
            type = 'success';
          } else if (isTicket) {
            title = 'Reference Escalated';
            body = `CRM ticket created for ${email.sender}`;
            type = 'warning';
          } else if (isFailed) {
            title = 'Processing Error';
            body = `Failed to process email from ${email.sender}`;
            type = 'error';
          }

          return {
            id: email.id,
            title,
            body,
            time: email.time || 'Just now',
            read: false,
            type
          };
        });

        const readIds = JSON.parse(localStorage.getItem('read_notif_ids') || '[]');
        const updated = mapped.map((n: any) => ({
          ...n,
          read: readIds.includes(n.id)
        }));

        setNotifications(updated);
        setUnreadCount(updated.filter((n: any) => !n.read).length);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
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

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="win11-topbar h-[64px] px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Title / Menu trigger */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground hover:text-foreground md:hidden transition-all duration-150"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 truncate">
          <span className="text-sm md:text-base font-bold tracking-tight text-foreground truncate">
            Advance Mail Automation & AI Mail Agent
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2.5 md:gap-3 pl-4">
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

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 hidden sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
        </div>

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
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      const updated = notifications.map(n => ({ ...n, read: true }));
                      setNotifications(updated);
                      setUnreadCount(0);
                      localStorage.setItem('read_notif_ids', JSON.stringify(notifications.map(n => n.id)));
                    }}
                    className="text-xs text-primary hover:text-primary-foreground font-medium transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
                {notifications.length > 0 ? (
                  notifications.map((notif) => {
                    let Icon = Mail;
                    let iconColor = 'text-blue-500 bg-blue-500/10 dark:text-blue-400';
                    if (notif.type === 'success') {
                      Icon = Send;
                      iconColor = 'text-green-500 bg-green-500/10 dark:text-green-400';
                    } else if (notif.type === 'warning') {
                      Icon = Ticket;
                      iconColor = 'text-amber-500 bg-amber-500/10 dark:text-amber-400';
                    } else if (notif.type === 'error') {
                      Icon = AlertCircle;
                      iconColor = 'text-rose-500 bg-rose-500/10 dark:text-rose-400';
                    }

                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          localStorage.setItem('selected_email_id', notif.id.toString());
                          setShowNotifDropdown(false);
                          navigate('/inbox');
                        }}
                        className={`p-4 flex gap-3 cursor-pointer transition-colors ${!notif.read ? 'bg-zinc-50 dark:bg-white/5' : 'hover:bg-zinc-50 dark:hover:bg-white/5'
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
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{notif.body}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-zinc-400 dark:text-zinc-500 flex flex-col items-center gap-2">
                    <Check className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                    <span>All caught up! No recent notifications.</span>
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

              {/* Quick Navigation Links */}
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

                {user?.role === 'admin' && (
                  <>
                    <button
                      onClick={() => { setShowDropdown(false); navigate('/admin/llm-configs'); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Cpu className="w-4 h-4 text-zinc-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
                        <span>AI & LLM Configuration</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                    </button>

                    <button
                      onClick={() => { setShowDropdown(false); navigate('/admin/clients'); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-zinc-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                        <span>Clients Management</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => { setShowDropdown(false); navigate('/payloads'); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <Code2 className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
                    <span>System Connector</span>
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
