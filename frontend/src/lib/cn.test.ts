import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('handles object notation', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('handles array notation', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles mixed notation', () => {
    expect(cn('foo', { bar: true, baz: false }, ['qux'])).toBe('foo bar qux');
  });

  it('handles all false values', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });

  it('handles complex conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base-class', isActive && 'active', isDisabled && 'disabled')).toBe('base-class active');
  });

  it('deduplicates classes', () => {
    expect(cn('foo bar', 'bar baz')).toBe('foo bar bar baz');
  });
});
