import { BASE_URL, authHeaders, safeJson } from './core';

export const analyticsApi = {
  async getDashboardStats(clientId: string, rangeType: string = "all", startDate?: string, endDate?: string) {
    let url = `${BASE_URL}/dashboard-stats/${clientId}?range_type=${rangeType}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;
    const res = await fetch(url, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch dashboard stats');
  },

  async uploadRagData(data: { client_id: string; title: string; content: string }) {
    const res = await fetch(`${BASE_URL}/upload-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to upload RAG data');
  },

  async getRagDocuments(clientId: string) {
    const res = await fetch(`${BASE_URL}/rag-documents/${clientId}`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch RAG documents');
  },

  async deleteRagDocument(clientId: string, docId: string) {
    const res = await fetch(`${BASE_URL}/rag-documents/${clientId}/${docId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return safeJson(res, 'Failed to delete RAG document');
  },

  async queryRag(data: { client_id: string; query: string }) {
    const res = await fetch(`${BASE_URL}/query-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to query RAG');
  },

  async retrieveRag(data: { client_id: string; query: string; top_k?: number }) {
    const res = await fetch(`${BASE_URL}/retrieve-rag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Failed to retrieve RAG documents');
  },

  async uploadRagFile(clientId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_id', clientId);
    const res = await fetch(`${BASE_URL}/upload-rag-file`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return safeJson(res, 'Failed to upload file');
  },

  async getAdminKnowledgeStats() {
    const res = await fetch(`${BASE_URL}/admin/knowledge-stats`, { headers: authHeaders() });
    return safeJson(res, 'Failed to fetch knowledge stats');
  },
};
