import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import AiProcessing from './pages/AiProcessing';
import Tickets from './pages/Tickets';
import EmailAccounts from './pages/EmailAccounts';
import PayloadConfig from './pages/PayloadConfig';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Logout from './pages/auth/Logout';
import AdminClients from './pages/AdminClients';
import LlmConfigs from './pages/LlmConfigs';
import { Drafts } from './pages/Drafts';

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const basename = (window as any).__APP_CONFIG__?.BASENAME || undefined;

  // A simple router wrapper to demo the SaaS layout
  return (
    <Router basename={basename}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/logout" element={<Logout />} />



        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="home" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="drafts" element={<Drafts />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="ai-processing" element={<AiProcessing />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="accounts" element={<EmailAccounts />} />
          <Route path="payloads" element={<PayloadConfig />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="llm-analytics" element={<Navigate to="/dashboard?tab=llm" replace />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/clients" element={<AdminClients />} />
          <Route path="admin/llm-configs" element={<LlmConfigs />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
