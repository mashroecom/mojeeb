import { useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  /** Skip if the user is typing in an input/textarea */
  ignoreInput?: boolean;
}

/**
 * Register global keyboard shortcuts.
 *
 * @param shortcuts - Array of shortcut definitions
 * @param enabled  - Toggle all shortcuts on/off (default true)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[], enabled = true) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          // Skip if user is focused on an editable element
          if (shortcut.ignoreInput !== false) {
            const tag = (e.target as HTMLElement)?.tagName;
            if (
              tag === 'INPUT' ||
              tag === 'TEXTAREA' ||
              tag === 'SELECT' ||
              (e.target as HTMLElement)?.isContentEditable
            ) {
              // Allow Escape to always fire
              if (shortcut.key.toLowerCase() !== 'escape') continue;
            }
          }

          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Preconfigured dashboard shortcuts.
 * Use in the dashboard layout to enable global navigation.
 */
export function useDashboardShortcuts() {
  const router = useRouter();

  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      handler: () => {
        // Focus the first search input on the page
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="text"][placeholder*="search" i], input[type="text"][placeholder*="بحث"]',
        );
        searchInput?.focus();
      },
    },
    {
      key: 'Escape',
      handler: () => {
        // Close any open modals/drawers by clicking backdrop
        const backdrop = document.querySelector<HTMLElement>(
          '[data-dismiss="modal"], .fixed.inset-0',
        );
        backdrop?.click();
      },
    },
    {
      key: '1',
      alt: true,
      handler: () => router.push('/conversations'),
    },
    {
      key: '2',
      alt: true,
      handler: () => router.push('/agents'),
    },
    {
      key: '3',
      alt: true,
      handler: () => router.push('/analytics'),
    },
    {
      key: '4',
      alt: true,
      handler: () => router.push('/settings'),
    },
  ]);
}
