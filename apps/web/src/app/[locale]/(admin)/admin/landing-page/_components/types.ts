// ---------------------------------------------------------------------------
// Shared Types for Landing Page CMS Sections
// ---------------------------------------------------------------------------

/**
 * Feature item with icon, title, and description in both languages
 */
export interface FeatureItem {
  icon: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
}

/**
 * Footer link with label in both languages and URL
 */
export interface FooterLink {
  label: { en: string; ar: string };
  url: string;
}

/**
 * Trusted by logo with image URL and company name
 */
export interface TrustedByLogo {
  image: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Common Props
// ---------------------------------------------------------------------------

/**
 * Base props shared by all section components
 */
export interface BaseSectionProps {
  /** Callback to mark the form as changed */
  markChanged: () => void;
}

/**
 * Props for sections with enable/disable toggle
 */
export interface ToggleableSectionProps extends BaseSectionProps {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
}

/**
 * Props for sections with bilingual title
 */
export interface BilingualTitleProps {
  title: string;
  titleAr: string;
  setTitle: (value: string) => void;
  setTitleAr: (value: string) => void;
}

/**
 * Props for sections with bilingual subtitle
 */
export interface BilingualSubtitleProps {
  subtitle: string;
  subtitleAr: string;
  setSubtitle: (value: string) => void;
  setSubtitleAr: (value: string) => void;
}
