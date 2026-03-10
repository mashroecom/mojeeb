import { create } from 'zustand';
import { clearAuthCookie } from '@/lib/auth-cookies';
import { useChatStore } from './chatStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Authenticated user information.
 */
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isSuperAdmin?: boolean;
  onboardingCompleted?: boolean;
}

/**
 * Organization information.
 */
interface Organization {
  id: string;
  name: string;
  slug: string;
}

/**
 * User's membership in an organization.
 * Includes role and organization details.
 */
interface Membership {
  id: string;
  role: string;
  org: Organization;
}

/**
 * Authentication store state and actions.
 */
interface AuthState {
  // State
  user: User | null;
  organization: Organization | null;
  organizations: Membership[];
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, organization: Organization, organizations?: Membership[]) => void;
  switchOrganization: (org: Organization) => void;
  clearAuth: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Global authentication store.
 *
 * Manages user authentication state, current organization, and organization switching.
 * Used throughout the app to access authenticated user data and control organization context.
 *
 * Key responsibilities:
 * - Store authenticated user information
 * - Track current organization context
 * - Manage list of user's organization memberships
 * - Handle organization switching
 * - Clear auth state on logout
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  organizations: [],
  isAuthenticated: false,

  /**
   * Set authentication state after successful login.
   * Updates user, organization, and available organizations.
   */
  setAuth: (user, organization, organizations) =>
    set({ user, organization, organizations: organizations ?? [], isAuthenticated: true }),

  /**
   * Switch to a different organization.
   * Updates the current organization context for all org-scoped API calls.
   */
  switchOrganization: (org) => set({ organization: org }),

  /**
   * Clear all authentication state and related data.
   * Removes tokens from localStorage, clears auth cookies, resets chat state,
   * and resets all auth store state to initial values.
   */
  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    clearAuthCookie();
    useChatStore.getState().clearAll();
    set({ user: null, organization: null, organizations: [], isAuthenticated: false });
  },
}));
