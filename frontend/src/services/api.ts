import axios from 'axios';

/** Render (and similar) cold starts after idle can take 30–90s+; Turso from the API is usually fast once awake. */
const parsedTimeout = Number.parseInt(String(import.meta.env.VITE_API_TIMEOUT_MS ?? ''), 10);
const apiTimeoutMs =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 180_000;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  /** Avoids hanging forever on dead connections; long default so cold Render instances can still respond. */
  timeout: apiTimeoutMs,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
