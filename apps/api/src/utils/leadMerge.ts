/**
 * A conversation yields at most one lead. The AI re-extracts lead details on every
 * customer message, so later extractions refine the existing lead instead of
 * creating another one.
 */

export interface ExtractedLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  interests: string[];
  budget: string | null;
  timeline: string | null;
  notes: string;
  confidence: number;
}

export interface StoredLeadFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  interests: string[];
  budget: string | null;
  timeline: string | null;
  notes: string | null;
  confidence: number;
}

const clean = (value: string | null | undefined): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
};

/**
 * Fields to write when a new extraction arrives for a conversation that already has
 * a lead. Returns only what actually changes (empty object = nothing to update).
 *
 * - A known value is never erased by an extraction that did not find it again.
 * - A newly extracted value replaces the stored one (the customer corrected it).
 * - Interests accumulate; confidence only goes up.
 */
export function mergeLead(
  existing: StoredLeadFields,
  extracted: ExtractedLead,
): Partial<StoredLeadFields> {
  const changes: Partial<StoredLeadFields> = {};

  for (const field of ['name', 'email', 'phone', 'company', 'budget', 'timeline'] as const) {
    const next = clean(extracted[field]);
    if (next && next !== existing[field]) changes[field] = next;
  }

  const interests = [...existing.interests];
  for (const interest of extracted.interests ?? []) {
    const value = clean(interest);
    if (value && !interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
      interests.push(value);
    }
  }
  if (interests.length !== existing.interests.length) changes.interests = interests;

  const notes = clean(extracted.notes);
  if (notes && notes !== existing.notes) changes.notes = notes;

  if (extracted.confidence > existing.confidence) changes.confidence = extracted.confidence;

  return changes;
}
