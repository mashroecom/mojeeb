/**
 * UI State Management Store
 *
 * Global Zustand store for managing application-wide UI state.
 * Currently manages sidebar visibility and can be extended for other UI states.
 *
 * @example
 * ```tsx
 * import { useUIStore } from '@/stores/uiStore';
 *
 * function Sidebar() {
 *   const { sidebarOpen, toggleSidebar } = useUIStore();
 *   return (
 *     <aside className={sidebarOpen ? 'open' : 'closed'}>
 *       <button onClick={toggleSidebar}>Toggle</button>
 *     </aside>
 *   );
 * }
 * ```
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * UI state shape for the global UI store.
 *
 * Manages application-wide UI state including sidebar visibility,
 * modals, and other transient UI states.
 */
interface UIState {
  /**
   * Whether the sidebar is currently open.
   * Defaults to `true` on initial load.
   */
  sidebarOpen: boolean;

  /**
   * Toggle the sidebar between open and closed states.
   * Useful for mobile navigation or hamburger menu interactions.
   */
  toggleSidebar: () => void;

  /**
   * Set the sidebar open state explicitly.
   * @param open - True to open the sidebar, false to close it
   */
  setSidebarOpen: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Global UI state store using Zustand.
 *
 * Provides reactive UI state management for the entire application.
 * Components can subscribe to specific slices of state to minimize re-renders.
 *
 * **State:**
 * - `sidebarOpen`: Boolean indicating if sidebar is visible
 *
 * **Actions:**
 * - `toggleSidebar()`: Toggles sidebar visibility
 * - `setSidebarOpen(open)`: Sets sidebar visibility explicitly
 *
 * @example
 * ```tsx
 * // Subscribe to entire state
 * const { sidebarOpen, toggleSidebar } = useUIStore();
 *
 * // Subscribe to specific slice (better performance)
 * const sidebarOpen = useUIStore((state) => state.sidebarOpen);
 * ```
 */
export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
