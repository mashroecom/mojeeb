import { describe, expect, it } from 'vitest';
import { mergeLead, type ExtractedLead, type StoredLeadFields } from './leadMerge';

const stored: StoredLeadFields = {
  name: null,
  email: 'nour@shop.example',
  phone: null,
  company: null,
  interests: ['delivery'],
  budget: null,
  timeline: null,
  notes: 'shared an email address',
  confidence: 0.7,
};

const extraction = (overrides: Partial<ExtractedLead> = {}): ExtractedLead => ({
  name: null,
  email: null,
  phone: null,
  company: null,
  interests: [],
  budget: null,
  timeline: null,
  notes: '',
  confidence: 0.5,
  ...overrides,
});

describe('mergeLead', () => {
  it('returns no changes when the extraction adds nothing new', () => {
    expect(
      mergeLead(
        stored,
        extraction({ email: 'nour@shop.example', interests: ['delivery'], confidence: 0.7 }),
      ),
    ).toEqual({});
  });

  it('never erases a known value with an empty extraction', () => {
    const changes = mergeLead(stored, extraction({ email: null, notes: '', interests: [] }));
    expect(changes).toEqual({});
  });

  it('adds newly learned fields', () => {
    expect(
      mergeLead(stored, extraction({ phone: '01001234567', name: ' Nour ', company: 'Shop Co' })),
    ).toEqual({ phone: '01001234567', name: 'Nour', company: 'Shop Co' });
  });

  it('replaces a value the customer corrected', () => {
    expect(mergeLead(stored, extraction({ email: 'nour@new.example' }))).toEqual({
      email: 'nour@new.example',
    });
  });

  it('accumulates interests without duplicates (case-insensitive)', () => {
    expect(
      mergeLead(stored, extraction({ interests: ['Delivery', 'wedding cakes', ' '] })),
    ).toEqual({ interests: ['delivery', 'wedding cakes'] });
  });

  it('only raises confidence', () => {
    expect(mergeLead(stored, extraction({ confidence: 0.95 }))).toEqual({ confidence: 0.95 });
    expect(mergeLead(stored, extraction({ confidence: 0.2 }))).toEqual({});
  });

  it('updates notes when they changed', () => {
    expect(mergeLead(stored, extraction({ notes: 'wants 20 cakes by Friday' }))).toEqual({
      notes: 'wants 20 cakes by Friday',
    });
  });
});
