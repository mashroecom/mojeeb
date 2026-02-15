import { create } from 'zustand';
import { clearAuthCookie } from '@/lib/auth-cookies';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isSuperAdmin?: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Membership {
  id: string;
  role: string;
  org: Organization;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  organizations: Membership[];
  isAuthenticated: boolean;
  setAuth: (user: User, organization: Organization, organizations?: Membership[]) => void;
  switchOrganization: (org: Organization) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  organizations: [],
  isAuthenticated: false,
  setAuth: (user, organization, organizations) =>
    set({ user, organization, organizations: organizations ?? [], isAuthenticated: true }),
  switchOrganization: (org) => set({ organization: org }),
  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    clearAuthCookie();
    set({ user: null, organization: null, organizations: [], isAuthenticated: false });
  },
}));
