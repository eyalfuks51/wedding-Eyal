/**
 * Phone normalization unit tests for normalizePhone and isValidPhone.
 *
 * NOTE on DB vs. frontend normalization:
 * The Supabase `phone_core` function strips all non-digits and returns ONLY core
 * digits (e.g. "521234567" from "0521234567"). That is intentionally different
 * from normalizePhone(), which returns a 972-prefixed international format
 * (e.g. "972521234567"). Both are correct for their respective contexts:
 * - DB phone_core is used for deduplication/matching within Postgres queries
 * - normalizePhone is used client-side before storing phone_numbers[] in invitations
 */

import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone } from './phone';

// ─── normalizePhone ───────────────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('converts 05x prefix to 972 prefix', () => {
    expect(normalizePhone('0521234567')).toBe('972521234567');
  });

  it('passes through already-972-prefixed number', () => {
    expect(normalizePhone('972521234567')).toBe('972521234567');
  });

  it('strips leading + from +972 prefix', () => {
    expect(normalizePhone('+972521234567')).toBe('972521234567');
  });

  it('strips dashes from 052-xxx-xxxx format', () => {
    expect(normalizePhone('052-123-4567')).toBe('972521234567');
  });

  it('strips spaces from 052 xxx xxxx format', () => {
    expect(normalizePhone('052 123 4567')).toBe('972521234567');
  });

  it('strips mixed separators from +972-52 123-4567', () => {
    expect(normalizePhone('+972-52 123-4567')).toBe('972521234567');
  });

  it('passes through 9-digit number without 0 or 972 prefix as-is', () => {
    expect(normalizePhone('521234567')).toBe('521234567');
  });

  it('converts 050 prefix to 972 prefix', () => {
    expect(normalizePhone('0501234567')).toBe('972501234567');
  });

  it('converts 054 prefix to 972 prefix', () => {
    expect(normalizePhone('0541234567')).toBe('972541234567');
  });
});

// ─── isValidPhone ─────────────────────────────────────────────────────────────

describe('isValidPhone', () => {
  it('accepts a 10-digit Israeli mobile number (05x format)', () => {
    expect(isValidPhone('0521234567')).toBe(true);
  });

  it('accepts a 12-digit 972-prefixed number', () => {
    expect(isValidPhone('972521234567')).toBe(true);
  });

  it('accepts a +972 prefixed number (12 digits after stripping +)', () => {
    expect(isValidPhone('+972521234567')).toBe(true);
  });

  it('rejects a number that is too short (5 digits)', () => {
    expect(isValidPhone('12345')).toBe(false);
  });

  it('rejects a number that is too long (13 digits)', () => {
    expect(isValidPhone('1234567890123')).toBe(false);
  });

  it('accepts a number with dashes that resolves to 10 digits', () => {
    expect(isValidPhone('052-123-4567')).toBe(true);
  });
});
