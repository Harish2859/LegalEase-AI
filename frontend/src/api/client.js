import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

export const analyzeContract = async (query, documentId) => {
  const response = await api.post('/analyze', { query, documentId });
  return response.data; // { answer, sources, retryCount }
};

export const getRedFlags = async (documentId) => {
  const response = await api.get(`/documents/${documentId}/red-flags`);
  return response.data;
};

export const scanRedFlags = async (documentId) => {
  const response = await api.post(`/documents/${documentId}/red-flags/scan`);
  return response.data;
};

export const deleteDocument = async (documentId) => {
  const response = await api.delete(`/documents/${documentId}`);
  return response.data;
};
