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
import LlmAnalytics from './pages/LlmAnalytics';
import Settings from './pages/Settings';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Logout from './pages/auth/Logout';
import ApproveRegistration from './pages/auth/ApproveRegistration';
import AdminClients from './pages/AdminClients';

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  // A simple router wrapper to demo the SaaS layout
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/logout" element={<Logout />} />



        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="ai-processing" element={<AiProcessing />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="accounts" element={<EmailAccounts />} />
          <Route path="payloads" element={<PayloadConfig />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="llm-analytics" element={<LlmAnalytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin/clients" element={<AdminClients />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
