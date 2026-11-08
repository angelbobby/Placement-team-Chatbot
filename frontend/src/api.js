export const API_BASE = 'http://localhost:5000';

const request = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
};

const requestBlob = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.blob();
};

const requestFormData = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
};

export const api = {
  // Chat & Sessions
  listSessions: () => request('/api/sessions'),
  getSessionMessages: (id) => request(`/api/sessions/${id}/messages`),
  createSession: (payload) => request('/api/sessions', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  deleteSession: (id) => request(`/api/sessions/${id}`, { method: 'DELETE' }),
  chat: (payload) => request('/api/chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  
  // Setup & Configuration
  getCompanies: () => request('/api/companies'),
  getHfConfig: () => request('/api/hf-config'),
  getFaqs: () => request('/api/faqs'),
  getTips: () => request('/api/tips'),
  getDocuments: () => request('/api/documents'),
  uploadDocument: (formData) => requestFormData('/api/upload', { method: 'POST', body: formData }),
  testConnection: (payload) => request('/api/test-connection', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  
  // Eligibility & Roadmap
  checkEligibility: (payload) => request('/api/check-eligibility', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  generateRoadmap: (payload) => request('/api/roadmap/generate', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  
  // Tech Interview
  startTechInterview: (payload) => request('/api/tech-interview/start', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  executeTechInterview: (payload) => request('/api/tech-interview/execute', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  nextTechInterview: (payload) => request('/api/tech-interview/next', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  reportTechInterview: (payload) => request('/api/tech-interview/report', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  
  // Mock Interview
  startMockInterview: (payload) => request('/api/interview/start', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  nextMockInterview: (payload) => request('/api/interview/next', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  reportMockInterview: (payload) => request('/api/interview/report', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  
  // Resume Builder
  startResumeSession: () => request('/api/resume/builder/session', { method: 'POST' }),
  chatResumeSession: (payload) => request('/api/resume/builder/chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  deleteResumeSession: (id) => request(`/api/resume/builder/session/${id}`, { method: 'DELETE' }),
  analyzeResume: (formData) => requestFormData('/api/resume/analyze', { method: 'POST', body: formData }),
  optimizeResume: (formData) => requestFormData('/api/resume/optimize', { method: 'POST', body: formData }),
  generateResumePdf: (payload) => requestBlob('/api/resume/generate-pdf', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
  improveResume: (payload) => request('/api/resume/improve', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }),
};
