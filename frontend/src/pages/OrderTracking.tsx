import { useState } from 'react';
import { Package, CreditCard, LifeBuoy, SearchIcon, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type LookupType = 'order' | 'payment' | 'ticket';

export default function OrderTracking() {
  const [lookupType, setLookupType] = useState<LookupType>('order');
  const [queryId, setQueryId] = useState('');
  const [resultData, setResultData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryId) return;
    setLoading(true);
    setError('');
    setResultData(null);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const cid = user?.client_id || 'default';
      let res: any;
      if (lookupType === 'order') {
        res = await api.orderStatus(cid, queryId);
      } else if (lookupType === 'payment') {
        res = await api.paymentStatus(cid, queryId);
      } else {
        res = await api.ticketStatus(cid, queryId);
      }
      setResultData(res.data || res);
    } catch (err: any) {
      setError(err.message || `Failed to fetch ${lookupType} tracking data.`);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
    if (lookupType === 'order') return 'Enter Order ID (e.g. ORD-10294, #1001)';
    if (lookupType === 'payment') return 'Enter Payment / Transaction ID (e.g. pi_3MtwBw, pay_29a)';
    return 'Enter Ticket Reference (e.g. T-260526-00431, 10294)';
  };

  const getTitle = () => {
    if (lookupType === 'order') return 'Order Status';
    if (lookupType === 'payment') return 'Payment Status';
    return 'Ticket Status';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Status Lookup</h2>
          <p className="text-muted-foreground mt-1">Real-time status tracking for customer orders, payment transactions, and support tickets.</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Lookup Mode Switcher */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => { setLookupType('order'); setResultData(null); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              lookupType === 'order' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="w-4 h-4" />
            Orders
          </button>
          <button
            type="button"
            onClick={() => { setLookupType('payment'); setResultData(null); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              lookupType === 'payment' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Payments
          </button>
          <button
            type="button"
            onClick={() => { setLookupType('ticket'); setResultData(null); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              lookupType === 'ticket' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground'
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            Tickets
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-4 max-w-lg mx-auto">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder={getPlaceholder()} 
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
            />
          </div>
          <button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 flex items-center justify-center min-w-[120px]">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lookup'}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl max-w-lg mx-auto text-center">
            {error}
          </div>
        )}

        {resultData && (
          <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">{getTitle()}</p>
                      <h3 className="text-xl font-bold">
                        {resultData.payment_status || resultData.ticket_status || resultData.status || 'Active'}
                      </h3>
                    </div>
                    {lookupType === 'order' && <Package className="w-8 h-8 text-primary opacity-50" />}
                    {lookupType === 'payment' && <CreditCard className="w-8 h-8 text-primary opacity-50" />}
                    {lookupType === 'ticket' && <LifeBuoy className="w-8 h-8 text-primary opacity-50" />}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex justify-between"><span className="font-medium text-foreground">Reference ID:</span> {queryId}</p>
                    {resultData.amount && <p className="flex justify-between"><span className="font-medium text-foreground">Amount:</span> {resultData.amount}</p>}
                    {resultData.transaction_id && <p className="flex justify-between"><span className="font-medium text-foreground">Transaction ID:</span> {resultData.transaction_id}</p>}
                    {resultData.carrier && <p className="flex justify-between"><span className="font-medium text-foreground">Carrier:</span> {resultData.carrier}</p>}
                    {resultData.docket_no && <p className="flex justify-between"><span className="font-medium text-foreground">Docket No:</span> {resultData.docket_no}</p>}
                    {resultData.assignee && <p className="flex justify-between"><span className="font-medium text-foreground">Assignee:</span> {resultData.assignee}</p>}
                    {resultData.tracking_url && (
                      <p className="flex justify-between">
                        <span className="font-medium text-foreground">Tracking URL:</span>
                        <a href={resultData.tracking_url} target="_blank" rel="noreferrer" className="text-primary underline truncate max-w-[200px]">
                          {resultData.tracking_url}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-4">Record Details</h4>
                <div className="glass-panel p-4 rounded-xl border border-white/10 text-xs font-mono overflow-auto max-h-60 bg-black/5 dark:bg-black/30">
                  <pre>{JSON.stringify(resultData, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
