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
 *
 * Token Flow:
 * 1. Request interceptor attaches accessToken from localStorage
 * 2. If request fails with 401 TOKEN_EXPIRED, response interceptor:
 *    a. Calls /auth/refresh with refreshToken
 *    b. Updates stored tokens and cookies
 *    c. Retries original request with new accessToken
 * 3. If refresh fails, clears all auth state and redirects to /login
 *
 * Error Handling:
 * - 401 TOKEN_EXPIRED: Automatic refresh and retry
 * - 401 other: Pass through (e.g., invalid credentials)
 * - Network errors: Pass through for handling by caller
 * - Refresh failure: Logout and redirect to /login
 */

import axios from 'axios';
import { clearAuthCookie, setAuthCookie } from './auth-cookies';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Response structure from /auth/refresh endpoint.
 */
interface RefreshTokenResponse {
  data: {
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
}

/**
 * Error response structure from API.
 */
interface ApiErrorResponse {
  code?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for all API requests.
 * Defaults to http://localhost:4000/api/v1 if NEXT_PUBLIC_API_URL is not set.
 */
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
 *
 * Note: This interceptor skips SSR requests since localStorage is not
 * available on the server. For SSR auth, use cookies instead.
 *
 * @param config - Axios request configuration
 * @returns Modified config with Authorization header if token exists
 */
api.interceptors.request.use((config) => {
  // Only access localStorage in browser context
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
 *
 * @param response - Successful response, passed through unchanged
 * @param error - Error from failed request
 * @returns Promise resolving to response or rejecting with error
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const errorData = error.response?.data as ApiErrorResponse | undefined;

    // Only intercept TOKEN_EXPIRED errors (401 with specific code)
    // Other 401s (e.g., invalid credentials) should pass through
    const isTokenExpired =
      error.response?.status === 401 &&
      errorData?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry;

    if (isTokenExpired) {
      originalRequest._retry = true; // Prevent infinite retry loop

      try {
        // Attempt to refresh the token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        // Call refresh endpoint with current refresh token
        // Note: We use axios directly (not api) to avoid interceptor recursion
        const response = await axios.post<RefreshTokenResponse>(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken }
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;

        // Update stored tokens in localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Sync cookie for SSR compatibility
        setAuthCookie(accessToken);

        // Retry original request with new access token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        // Token refresh failed - perform full logout

        // Clear localStorage tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');

        // Clear auth cookie
        clearAuthCookie();

        // Clear Zustand auth store to avoid stale user data
        // Dynamic import to avoid circular dependencies
        try {
          const { useAuthStore } = await import('@/stores/authStore');
          useAuthStore.getState().clearAuth();
        } catch {
          // Silently fail if store import fails (e.g., SSR context)
        }

        // Redirect to login page (client-side only)
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        return Promise.reject(error);
      }
    }

    // For all other errors (network, 404, 500, etc.), reject as-is
    // This allows callers to handle errors appropriately
    return Promise.reject(error);
  }
);
