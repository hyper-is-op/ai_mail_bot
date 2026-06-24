import { useState } from 'react';
import { Package, CheckCircle, Clock, SearchIcon, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function OrderTracking() {
  const [orderId, setOrderId] = useState('');
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    setLoading(true);
    setError('');
    setOrderData(null);
    try {
      const res = await api.orderStatus(orderId);
      setOrderData(res.data || res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order tracking data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Order Tracking</h2>
          <p className="text-muted-foreground mt-1">Real-time status tracking for customer orders.</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        <form onSubmit={handleSearch} className="flex gap-4 max-w-lg mx-auto">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Enter Order ID (e.g. ORD-12345)" 
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
            />
          </div>
          <button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20 flex items-center justify-center min-w-[120px]">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track Order'}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl max-w-lg mx-auto text-center">
            {error}
          </div>
        )}

        {orderData && (
          <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Order Status</p>
                      <h3 className="text-xl font-bold">{orderData.status || 'Active'}</h3>
                    </div>
                    <Package className="w-8 h-8 text-primary opacity-50" />
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex justify-between"><span className="font-medium text-foreground">Order ID:</span> {orderId}</p>
                    <p className="flex justify-between"><span className="font-medium text-foreground">Details:</span> {JSON.stringify(orderData)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-4">Tracking Timeline</h4>
                <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-primary/50 before:to-transparent">
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-background bg-primary shadow shrink-0 absolute left-0 -translate-x-1/2">
                      <CheckCircle className="w-3 h-3 text-background" />
                    </div>
                    <div className="ml-8 glass-panel p-4 rounded-xl border border-white/10 w-full text-sm">
                      <h5 className="font-bold">Order Received</h5>
                      <p className="text-muted-foreground text-xs mt-1">Your order has been placed.</p>
                    </div>
                  </div>
                  
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-background bg-primary shadow shrink-0 absolute left-0 -translate-x-1/2">
                      <Clock className="w-3 h-3 text-background" />
                    </div>
                    <div className="ml-8 glass-panel p-4 rounded-xl border border-white/10 w-full text-sm">
                      <h5 className="font-bold">Processing</h5>
                      <p className="text-muted-foreground text-xs mt-1">Data fetched from backend.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
