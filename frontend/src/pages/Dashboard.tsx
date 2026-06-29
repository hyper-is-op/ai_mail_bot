import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, RefreshCw, Send, Ticket, PackageSearch, Users, AlertCircle, Server, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const getFirstDayOfCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const getLastDayOfCurrentMonth = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    const formattedMonth = String(m).padStart(2, '0');
    const formattedDay = String(lastDay).padStart(2, '0');
    return `${y}-${formattedMonth}-${formattedDay}`;
  };

  const [metrics, setMetrics] = useState({
    total_emails: 0,
    pending_emails: 0,
    ai_replies: 0,
    failed_emails: 0,
    tickets_generated: 0,
    orders_tracked: 0,
    active_accounts: 0,
    avg_confidence: 0,
  });
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [rangeType, setRangeType] = useState('today');
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth());
  const [endDate, setEndDate] = useState(getLastDayOfCurrentMonth());

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.client_id || '');
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
          if (data.length > 0 && !selectedClientId) {
            setSelectedClientId(data[0].client_id);
          }
        })
        .catch((err) => console.error("Failed to fetch clients for admin:", err));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchStats(selectedClientId);
    }
  }, [selectedClientId, rangeType]);

  const fetchStats = async (cid: string = selectedClientId) => {
    if (!cid) return;
    if (rangeType === 'custom' && (!startDate || !endDate)) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const stats = await api.getDashboardStats(cid, rangeType, startDate, endDate);
      setMetrics({
        total_emails: stats.total_emails,
        pending_emails: stats.pending_emails,
        ai_replies: stats.ai_replies,
        failed_emails: stats.failed_emails,
        tickets_generated: stats.tickets_generated,
        orders_tracked: stats.orders_tracked,
        active_accounts: stats.active_accounts,
        avg_confidence: stats.avg_confidence || 0,
      });
      setChartData(stats.chart_data || []);
    } catch (err: any) {
      console.error("Dashboard stats failed to load:", err);
      setErrorMsg('Operational data is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (startDate && endDate && selectedClientId) {
      fetchStats(selectedClientId);
    }
  };

  const statsList = [
    { 
      name: 'Total Emails Processed', 
      value: metrics.total_emails.toLocaleString(), 
      icon: Mail, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10' 
    },
    { 
      name: 'Pending Emails', 
      value: metrics.pending_emails.toLocaleString(), 
      icon: RefreshCw, 
      trend: metrics.total_emails > 0 ? `${Math.round((metrics.pending_emails / metrics.total_emails) * 100)}%` : '0%', 
      trendColor: 'text-amber-500 bg-amber-500/10',
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10' 
    },
    { 
      name: 'AI Replies Sent', 
      value: metrics.ai_replies.toLocaleString(), 
      icon: Send, 
      trend: metrics.total_emails > 0 ? `${Math.round((metrics.ai_replies / metrics.total_emails) * 100)}%` : '0%', 
      trendColor: 'text-green-500 bg-green-500/10',
      color: 'text-green-500', 
      bg: 'bg-green-500/10' 
    },
    { 
      name: 'References Created', 
      value: metrics.tickets_generated.toLocaleString(), 
      icon: Ticket, 
      trend: metrics.total_emails > 0 ? `${Math.round((metrics.tickets_generated / metrics.total_emails) * 100)}%` : '0%', 
      trendColor: 'text-purple-500 bg-purple-500/10',
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10' 
    },
    { 
      name: 'Reference Lookups', 
      value: metrics.orders_tracked.toLocaleString(), 
      icon: PackageSearch, 
      color: 'text-indigo-500', 
      bg: 'bg-indigo-500/10' 
    },
    { 
      name: 'Active Accounts', 
      value: metrics.active_accounts.toLocaleString(), 
      icon: Users, 
      color: 'text-cyan-500', 
      bg: 'bg-cyan-500/10' 
    },
    { 
      name: 'Failed Emails', 
      value: metrics.failed_emails.toLocaleString(), 
      icon: AlertCircle, 
      trend: metrics.total_emails > 0 ? `${Math.round((metrics.failed_emails / metrics.total_emails) * 100)}%` : '0%', 
      trendColor: 'text-rose-500 bg-rose-500/10',
      color: 'text-rose-500', 
      bg: 'bg-rose-500/10' 
    },
    { 
      name: 'Queue Status', 
      value: 'Healthy', 
      icon: Server, 
      trend: 'Stable',
      trendColor: 'text-emerald-500 bg-emerald-500/10',
      color: 'text-emerald-500', 
      bg: 'bg-emerald-500/10' 
    },
  ];

  // Calculate success rates dynamically
  const successRate = metrics.total_emails > 0 ? Math.round((metrics.ai_replies / metrics.total_emails) * 100) : 0;
  const ticketRate = metrics.total_emails > 0 ? Math.round((metrics.tickets_generated / metrics.total_emails) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Gathering real-time database logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Overview</h2>
          <p className="text-muted-foreground mt-1">Real-time insights of your email automation system.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {user?.role === 'admin' && clients.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id} className="bg-zinc-900 text-foreground">
                    {c.client_id} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button onClick={() => fetchStats(selectedClientId)} className="flex self-start sm:self-auto items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh metrics
          </button>
        </div>
      </div>

      {/* Date Filter Panel */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_month', label: 'Current Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'custom', label: 'Custom Range' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setRangeType(r.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold transition-all border",
                rangeType === r.id
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                  : "bg-white/5 dark:bg-black/20 border-zinc-200/50 dark:border-zinc-800/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {rangeType === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 animate-fade-in">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              className="bg-white/5 dark:bg-black/20 border border-zinc-200/50 dark:border-zinc-800/40 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {}
              }}
              className="bg-white/5 dark:bg-black/20 border border-zinc-200/50 dark:border-zinc-800/40 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />
            <button
              onClick={handleApplyCustomRange}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold shadow-lg shadow-primary/25 hover:bg-primary/95 transition-all"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-500 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsList.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            key={stat.name}
            className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition-colors group cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.trend && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.trendColor}`}>
                  {stat.trend}
                </span>
              )}
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
              <p className="text-sm text-muted-foreground font-medium mt-1">{stat.name}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 glass-panel p-6 rounded-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Email Volume & AI Automation</h3>
            <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-zinc-400 font-medium capitalize">
              {rangeType.replace('_', ' ')}
            </span>
          </div>
          <div className="h-[300px] w-full">
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="emails" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorEmails)" name="Total Emails" />
                  <Area type="monotone" dataKey="aiReplied" stroke="hsl(var(--accent))" strokeWidth={2} fillOpacity={1} fill="url(#colorAI)" name="AI Replied" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No telemetry data available for the weekly period.
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-panel p-6 rounded-2xl flex flex-col"
        >
          <h3 className="text-lg font-semibold mb-6 text-white">Processing Insights</h3>
          <div className="space-y-6 flex-1">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Auto Reply Success</span>
                <span className={`font-medium ${successRate > 0 ? 'text-green-500' : 'text-zinc-500'}`}>{successRate > 0 ? `${successRate}%` : 'N/A'}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${successRate || 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Reference Escalation Rate</span>
                <span className={`font-medium ${ticketRate > 0 ? 'text-purple-500' : 'text-zinc-500'}`}>{ticketRate > 0 ? `${ticketRate}%` : 'N/A'}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${ticketRate || 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Avg AI Confidence</span>
                <span className="font-medium text-primary">{metrics.avg_confidence > 0 ? `${metrics.avg_confidence}%` : 'N/A'}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${metrics.avg_confidence || 0}%` }}></div>
              </div>
            </div>
            
            <div className="pt-4 mt-auto border-t border-white/10">
              <h4 className="text-sm font-medium mb-3 text-white">System Categories</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium">Reference Status Check</span>
                <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 text-xs font-medium">Refund/Returns</span>
                <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-medium">Technical Support</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

