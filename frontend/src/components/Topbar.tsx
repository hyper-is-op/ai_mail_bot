import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Bell as BellIcon, Moon as MoonIcon, Sun as SunIcon, ChevronDown, UserCircle2, LogOut, Menu, Mail, Send, Ticket, AlertCircle, Check } from 'lucide-react';
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
    <header className="glass-panel h-[80px] px-4 md:px-6 flex items-center justify-between border-b border-white/10 sticky top-0 z-10">
      {/* Search and Menu trigger */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground md:hidden transition-all duration-200"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative group flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search emails, reference IDs..."
            className="w-full bg-black/10 dark:bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4 pl-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 hidden sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Live Data</span>
        </div>

        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={handleOpenNotifDropdown}
            className="relative p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BellIcon className="w-5 h-5" />
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

        <div className="h-6 w-px bg-white/10 mx-1"></div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 hover:bg-white/5 p-1 pr-2 rounded-full transition-colors border border-transparent hover:border-white/10"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <UserCircle2 className="w-5 h-5" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none capitalize">{user?.role || 'User'}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[120px] truncate">{user?.email || 'Guest'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-background border border-white/10 rounded-xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-white/10 md:hidden">
                <p className="text-sm font-medium capitalize">{user?.role || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || 'Guest'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-white/5 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
