import { BASE_URL, authHeaders, safeJson } from './core';

export const authApi = {
  async register(data: any) {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Registration failed');
  },

  async login(data: any) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Login failed');
  },

  async forgotPasswordSendOtp(email: string) {
    const res = await fetch(`${BASE_URL}/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return safeJson(res, 'Failed to send verification code');
  },

  async forgotPasswordReset(data: { email: string; otp: string; new_password: string }) {
    const res = await fetch(`${BASE_URL}/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Password reset failed');
  },

  async adminResetClientPassword(data: { client_id: string; new_password: string }) {
    const res = await fetch(`${BASE_URL}/admin/reset-client-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Admin password reset failed');
  },

  async setUserStatus(clientId: string, status: 'active' | 'inactive') {
    const res = await fetch(`${BASE_URL}/admin/set-user-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ client_id: clientId, status }),
    });
    return safeJson(res, 'Failed to update user status');
  },

  async logout() {
    await fetch(`${BASE_URL}/logout`, { method: 'POST', headers: authHeaders() });
  },

  async approveRegistration(email: string) {
    const res = await fetch(`${BASE_URL}/admin/approve-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ email }),
    });
    return safeJson(res, 'Failed to approve registration');
  },

  async createClient(data: { 
    name: string; 
    phone_number: string; 
    login_email: string; 
    login_password: string; 
    imap_email?: string; 
    imap_password?: string; 
    score_threshold?: number; 
    response_tone?: string;
    agent_type?: string;
    department_name?: string;
    company_name?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/create-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to create client');
  },

  async getPendingUsers() {
    const res = await fetch(`${BASE_URL}/admin/pending-users`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch pending users');
  },

  async deleteClient(clientId: string) {
    const res = await fetch(`${BASE_URL}/admin/delete-client/${clientId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete client');
  },

  async updateClientProfile(data: { 
    client_id: string; 
    name?: string;
    phone_number?: string;
    login_email?: string;
    imap_email?: string;
    imap_password?: string;
    agent_type?: string; 
    department_name?: string; 
    company_name?: string;
  }) {
    const res = await fetch(`${BASE_URL}/admin/client-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update client profile');
  },

  async updateSelfProfile(data: { 
    client_id: string; 
    department_name?: string; 
    company_name?: string;
    score_threshold?: number;
    agent_type?: string; 
    response_tone?: string;
  }) {
    const res = await fetch(`${BASE_URL}/client/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to update profile');
  },
};
