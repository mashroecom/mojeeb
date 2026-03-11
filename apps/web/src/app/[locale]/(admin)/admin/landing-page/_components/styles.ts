// ---------------------------------------------------------------------------
// Shared Styles and Utilities for Landing Page Admin
// ---------------------------------------------------------------------------

/**
 * Standard input field styling
 */
export const inputCls =
  'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

/**
 * Textarea field styling (extends inputCls)
 */
export const textareaCls = `${inputCls} resize-none`;

/**
 * Label styling for form fields
 */
export const labelCls = 'text-sm font-medium';

/**
 * Small label styling (for nested or secondary labels)
 */
export const labelSmallCls = 'text-xs font-medium text-muted-foreground';

/**
 * Description/helper text styling
 */
export const descriptionCls = 'text-sm text-muted-foreground mt-0.5';

/**
 * Standard button styling (secondary/outline style)
 */
export const buttonCls =
  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors';

/**
 * Primary button styling
 */
export const buttonPrimaryCls =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50';

/**
 * Danger/delete button styling
 */
export const buttonDangerCls =
  'inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors';

/**
 * Link button styling (text link with hover)
 */
export const linkButtonCls =
  'inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2';

/**
 * Card/section container styling
 */
export const cardCls = 'rounded-xl border bg-card p-6 shadow-sm';

/**
 * Tab container styling
 */
export const tabContainerCls = 'mb-6 flex flex-wrap gap-1 rounded-lg border bg-card p-1';

/**
 * Individual tab button base styling
 */
export const tabButtonBaseCls =
  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors';

/**
 * Active tab styling
 */
export const tabButtonActiveCls = 'bg-background shadow-sm text-foreground';

/**
 * Inactive tab styling
 */
export const tabButtonInactiveCls =
  'text-muted-foreground hover:bg-muted/50 hover:text-foreground';

/**
 * Language tab container styling
 */
export const langTabContainerCls = 'flex gap-1 rounded-lg border bg-muted/50 p-0.5 w-fit mb-4';

/**
 * Language tab button base styling
 */
export const langTabButtonCls = 'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors';

/**
 * Active language tab styling
 */
export const langTabButtonActiveCls = 'bg-background shadow-sm text-foreground';

/**
 * Inactive language tab styling
 */
export const langTabButtonInactiveCls = 'text-muted-foreground hover:text-foreground';

/**
 * Section header border styling
 */
export const sectionHeaderCls = 'flex items-start justify-between gap-4 pb-4 border-b mb-6';

/**
 * File upload label styling
 */
export const fileUploadLabelCls =
  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors';

/**
 * Toggle/status indicator text
 */
export const statusTextCls = 'text-xs font-medium';

/**
 * Narrow input (for numbers, short text)
 */
export const inputNarrowCls =
  'w-24 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

/**
 * Medium width input
 */
export const inputMediumCls =
  'w-32 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

/**
 * Flex container with items center and gap
 */
export const flexItemsCenterCls = 'flex items-center gap-2';

/**
 * Icon wrapper for drag handle
 */
export const dragHandleCls = 'cursor-grab text-muted-foreground hover:text-foreground';
