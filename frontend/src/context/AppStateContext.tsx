import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

type ThemeMode = 'light' | 'dark';

export interface ClientAccount {
  client_id: string;
  name?: string;
  company_name?: string;
  email?: string;
}

interface AppStateContextType {
  pendingDraftCount: number;
  refreshDraftCount: () => Promise<void>;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  selectedClientId: string;
  setSelectedClientId: (clientId: string) => void;
  clients: ClientAccount[];
  refreshClients: () => Promise<void>;
  isAdmin: boolean;
}

const AppStateContext = createContext<AppStateContextType>({
  pendingDraftCount: 0,
  refreshDraftCount: async () => {},
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  selectedClientId: '',
  setSelectedClientId: () => {},
  clients: [],
  refreshClients: async () => {},
  isAdmin: false,
});

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'admin';

  const [pendingDraftCount, setPendingDraftCount] = useState<number>(0);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'dark';
  });

  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [selectedClientId, setSelectedClientIdState] = useState<string>(() => {
    const saved = localStorage.getItem('selected_client_id');
    if (saved && (isAdmin || saved === user?.client_id)) return saved;
    return isAdmin ? 'ALL' : (user?.client_id || '');
  });

  const setSelectedClientId = (id: string) => {
    setSelectedClientIdState(id);
    localStorage.setItem('selected_client_id', id);
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const fetchClients = async () => {
    if (!isAdmin) return;
    try {
      const data = await api.getAllEmailAccounts();
      if (Array.isArray(data)) {
        setClients(data);
      }
    } catch (err) {
      console.error("Failed to load clients list:", err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchClients();
    }
  }, [isAdmin]);

  const fetchDraftCount = async () => {
    try {
      const activeCid = selectedClientId === 'ALL' ? undefined : (selectedClientId || user?.client_id);
      const res = await api.getPendingDraftsCount(activeCid);
      if (res && typeof res.pending_count === 'number') {
        setPendingDraftCount(res.pending_count);
      }
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchDraftCount();
    const interval = setInterval(fetchDraftCount, 15000);
    return () => clearInterval(interval);
  }, [selectedClientId]);

  return (
    <AppStateContext.Provider
      value={{
        pendingDraftCount,
        refreshDraftCount: fetchDraftCount,
        theme,
        setTheme,
        toggleTheme,
        selectedClientId,
        setSelectedClientId,
        clients,
        refreshClients: fetchClients,
        isAdmin,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
