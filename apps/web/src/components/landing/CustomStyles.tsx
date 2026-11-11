'use client';

import { useLandingPageContent } from '@/hooks/useLandingPage';

interface CustomStylesProps {
  /**
   * Custom CSS already loaded on the server (pass `null` when the CMS has
   * none). When this prop is given the component renders it as-is — it is part
   * of the server HTML, so there is no flash of unstyled content — and does not
   * query the API. Omit it to let the component load the CMS itself.
   */
  css?: string | null;
}

/**
 * CustomStyles component for rendering CMS-provided custom CSS
 *
 * Security: The customCss is sanitized on the backend by cssSanitizer.ts
 * which blocks @import, attribute selectors, javascript: URLs, and other
 * CSS injection vectors before storage. This component renders the
 * pre-sanitized CSS safely.
 */
export function CustomStyles({ css }: CustomStylesProps = {}) {
  const fromServer = css !== undefined;
  const { data: cms } = useLandingPageContent({ enabled: !fromServer });

  const customCss = fromServer ? css : cms?.customCss;

  // Only render if custom CSS exists
  if (!customCss) {
    return null;
  }

  return <style dangerouslySetInnerHTML={{ __html: customCss }} suppressHydrationWarning />;
}
