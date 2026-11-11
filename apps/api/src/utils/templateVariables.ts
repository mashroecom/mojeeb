/**
 * Message-template variables.
 *
 * The dashboard edits variables as `{ key, labelEn, labelAr }` objects, while the
 * `message_templates.variables` column is a `text[]`. Each definition is stored as
 * one JSON string per array element; legacy rows that hold a bare key (`"order_id"`)
 * are still read correctly.
 */

export interface TemplateVariable {
  key: string;
  labelEn: string;
  labelAr: string;
}

export function encodeTemplateVariables(
  variables: Array<{ key: string; labelEn: string; labelAr?: string }>,
): string[] {
  return variables.map((v) =>
    JSON.stringify({ key: v.key, labelEn: v.labelEn, labelAr: v.labelAr ?? '' }),
  );
}

export function decodeTemplateVariables(stored: string[] | null | undefined): TemplateVariable[] {
  return (stored ?? []).map((raw) => {
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as Partial<TemplateVariable>;
        if (typeof parsed.key === 'string' && parsed.key) {
          return {
            key: parsed.key,
            labelEn:
              typeof parsed.labelEn === 'string' && parsed.labelEn ? parsed.labelEn : parsed.key,
            labelAr: typeof parsed.labelAr === 'string' ? parsed.labelAr : '',
          };
        }
      } catch {
        // fall through — treat as a bare key
      }
    }
    return { key: raw, labelEn: raw, labelAr: '' };
  });
}

/** Replace the stored `variables` of a template row with decoded definitions. */
export function withDecodedVariables<T extends { variables: string[] }>(
  template: T,
): Omit<T, 'variables'> & { variables: TemplateVariable[] } {
  return { ...template, variables: decodeTemplateVariables(template.variables) };
}
