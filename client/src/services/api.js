import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'RequestVerificationToken'
});

const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
};

let csrfPromise = null;
const fetchCsrfToken = async () => {
  if (!csrfPromise) {
    csrfPromise = axios
      .get('/api/antiforgery/token', { withCredentials: true })
      .then((res) => res.data?.token)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
};

// Attach JWT token & Anti-Forgery token to outgoing requests
api.interceptors.request.use(
  async (config) => {
    // 1. JWT Bearer token
    const token = localStorage.getItem('acxiom_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Anti-Forgery Verification Token for state-changing calls
    const isStateChanging = ['post', 'put', 'delete', 'patch'].includes(
      config.method?.toLowerCase()
    );

    if (isStateChanging) {
      let csrfToken = getCookie('.AspNetCore.Antiforgery') || getCookie('XSRF-TOKEN');
      if (!csrfToken) {
        csrfToken = await fetchCsrfToken();
      }
      if (csrfToken) {
        config.headers['RequestVerificationToken'] = csrfToken;
        config.headers['X-CSRF-TOKEN'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or unauthorized
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('acxiom_token');
        localStorage.removeItem('acxiom_user');
        window.location.href = '/login?sessionExpired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
