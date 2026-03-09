'use client';

import { useLandingPageContent } from '@/hooks/useLandingPage';

/**
 * CustomStyles component for rendering CMS-provided custom CSS
 *
 * Security: The customCss is sanitized on the backend by cssSanitizer.ts
 * which blocks @import, attribute selectors, javascript: URLs, and other
 * CSS injection vectors before storage. This component renders the
 * pre-sanitized CSS safely.
 */
export function CustomStyles() {
  const { data: cms } = useLandingPageContent();

  // Only render if custom CSS exists
  if (!cms?.customCss) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{ __html: cms.customCss }}
      suppressHydrationWarning
    />
  );
}
