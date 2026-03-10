/**
 * API Client Configuration
 *
 * Centralized Axios instance for all API requests with:
 * - Automatic JWT token attachment
 * - Transparent token refresh on expiration
 * - Automatic logout on auth failure
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const { data } = await api.get('/endpoint');
 *   const { data } = await api.post('/endpoint', payload);
 */

import axios from 'axios';
import { clearAuthCookie, setAuthCookie } from './auth-cookies';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// ---------------------------------------------------------------------------
// Axios Instance
// ---------------------------------------------------------------------------

/**
 * Configured Axios instance for API requests.
 *
 * Features:
 * - Base URL from environment variable (NEXT_PUBLIC_API_URL)
 * - JSON content type by default
 * - Credentials (cookies) included in requests
 * - Request interceptor for auth token attachment
 * - Response interceptor for automatic token refresh
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in cross-origin requests
});

// ---------------------------------------------------------------------------
// Request Interceptor
// ---------------------------------------------------------------------------

/**
 * Attaches JWT access token to outgoing requests.
 *
 * Reads the access token from localStorage and adds it to the
 * Authorization header. Only runs in browser context (not SSR).
 *
 * Flow:
 * 1. Check if running in browser (window is defined)
 * 2. Retrieve accessToken from localStorage
 * 3. If token exists, add to Authorization header as Bearer token
 */
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response Interceptor
// ---------------------------------------------------------------------------

/**
 * Handles automatic token refresh on expiration.
 *
 * When a request fails with 401 TOKEN_EXPIRED:
 * 1. Retrieves refresh token from localStorage
 * 2. Calls /auth/refresh endpoint to get new tokens
 * 3. Updates localStorage and auth cookies with new tokens
 * 4. Retries the original request with new access token
 *
 * If refresh fails:
 * 1. Clears all auth state (localStorage, cookies, store)
 * 2. Redirects user to /login
 *
 * The _retry flag prevents infinite loops if refresh also fails.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if this is a TOKEN_EXPIRED error and we haven't retried yet
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true; // Prevent infinite retry loop

      try {
        // Attempt to refresh the token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        // Call refresh endpoint with current refresh token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;

        // Update stored tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setAuthCookie(accessToken); // Sync cookie for SSR

        // Retry original request with new access token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        // Token refresh failed - clean up and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        clearAuthCookie();

        // Clear Zustand auth store to avoid stale data
        try {
          const { useAuthStore } = await import('@/stores/authStore');
          useAuthStore.getState().clearAuth();
        } catch {}

        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    // For all other errors, reject as-is
    return Promise.reject(error);
  }
);
