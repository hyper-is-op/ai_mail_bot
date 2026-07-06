import { useState, useEffect } from 'react';
import { Search, Filter, Loader2, Inbox } from 'lucide-react';
import { api } from '@/lib/api';

export default function Tickets() {
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [selectedClientId, setSelectedClientId] = useState(user?.role === 'admin' ? 'ALL' : (user?.client_id || ''));
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.getAllEmailAccounts()
        .then((data) => {
          setClients(data);
        })
        .catch((err) => console.error("Failed to fetch clients for admin tickets:", err));
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchTickets(selectedClientId);
    }
  }, [selectedClientId]);

  const fetchTickets = async (cid = selectedClientId) => {
    if (!cid) return;
    setLoading(true);
    try {
      const data = await api.getTickets(cid);
      setTicketsList(data);
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredTickets = ticketsList.filter(ticket => {
    const matchesSearch = 
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.mailId && ticket.mailId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-zinc-400 font-medium">Fetching reference status from CRM database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Reference Status</h2>
          <p className="text-muted-foreground mt-1">Manage AI tracked reference statuses and automated replies.</p>
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
                <option value="ALL" className="bg-zinc-900 text-foreground">ALL</option>
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id} className="bg-zinc-900 text-foreground">
                    {c.client_id} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search reference IDs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/10 dark:bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary w-[200px]" 
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-black/10 dark:bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          {filteredTickets.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/5 dark:bg-white/5 text-sm text-muted-foreground">
                  <th className="p-4 font-medium">Reference ID</th>
                  <th className="p-4 font-medium">Subject</th>
                  <th className="p-4 font-medium">Mail ID Reference</th>
                  <th className="p-4 font-medium">Priority</th>
                  <th className="p-4 font-medium">Sentiment</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Created Time</th>
                </tr>
              </thead>
              <tbody className="text-sm text-zinc-200">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                    <td className="p-4 font-semibold text-primary">{ticket.id}</td>
                    <td className="p-4 font-medium max-w-[280px] truncate">{ticket.subject}</td>
                    <td className="p-4 text-muted-foreground font-mono text-xs">{ticket.mailId}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border
                        ${ticket.priority === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
                        ${ticket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                        ${ticket.priority === 'Low' ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' : ''}
                        ${ticket.priority === 'Critical' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : ''}
                      `}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border
                        ${ticket.sentiment === 'Angry' ? 'bg-red-500/10 text-rose-400 border-red-500/10' : ''}
                        ${ticket.sentiment === 'Happy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' : ''}
                        ${ticket.sentiment === 'Neutral' || !ticket.sentiment ? 'bg-zinc-500/10 text-zinc-300 border-zinc-500/10' : ''}
                      `}>
                        {ticket.sentiment || 'Neutral'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex w-max items-center gap-1.5
                        ${ticket.status === 'Done_Replied' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'Done_Replied' ? 'bg-green-400 animate-pulse' : 'bg-purple-400 animate-pulse'}`}></span>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{ticket.date_str}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
              <Inbox className="w-12 h-12 text-zinc-500" />
              <h4 className="text-lg font-bold text-white">No Active Reference IDs</h4>
              <p className="text-zinc-400 text-sm max-w-sm">
                No active reference records exist matching your search criteria. Email logs with lower confidence score thresholds are automatically triaged here.
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/10 flex justify-between items-center text-sm text-muted-foreground bg-black/5 dark:bg-white/5">
          <span>Showing {filteredTickets.length} active entries</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 rounded-md border border-white/10 hover:bg-white/10 disabled:opacity-50" disabled>Prev</button>
            <button className="px-3 py-1 rounded-md border border-white/10 bg-primary/20 text-primary">1</button>
            <button className="px-3 py-1 rounded-md border border-white/10 hover:bg-white/10" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
