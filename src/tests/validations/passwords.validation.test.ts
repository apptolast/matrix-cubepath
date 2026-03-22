import { describe, it, expect } from 'vitest';
import {
  passwordMasterBody,
  passwordCreateBody,
  passwordUpdateBody,
  passwordBulkDeleteBody,
  passwordChangeMasterBody,
} from '../../backend/validations/passwords.validation';

describe('passwordMasterBody', () => {
  it('accepts valid master password', () => {
    expect(passwordMasterBody.safeParse({ masterPassword: 'securepass' }).success).toBe(true);
  });

  it('rejects short password (< 8)', () => {
    expect(passwordMasterBody.safeParse({ masterPassword: 'short' }).success).toBe(false);
  });

  it('rejects missing field', () => {
    expect(passwordMasterBody.safeParse({}).success).toBe(false);
  });
});

describe('passwordCreateBody', () => {
  it('accepts valid entry', () => {
    expect(passwordCreateBody.safeParse({ label: 'GitHub', password: 'pass123' }).success).toBe(true);
  });

  it('applies defaults', () => {
    const result = passwordCreateBody.safeParse({ label: 'X', password: 'y' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('other');
      expect(result.data.favorite).toBe(0);
    }
  });

  it('rejects empty label', () => {
    expect(passwordCreateBody.safeParse({ label: '', password: 'pass' }).success).toBe(false);
  });

  it('rejects empty password', () => {
    expect(passwordCreateBody.safeParse({ label: 'X', password: '' }).success).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(passwordCreateBody.safeParse({ label: 'X', password: 'y', category: 'crypto' }).success).toBe(false);
  });
});

describe('passwordUpdateBody', () => {
  it('accepts empty object (all partial)', () => {
    expect(passwordUpdateBody.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    expect(passwordUpdateBody.safeParse({ label: 'New Label' }).success).toBe(true);
    expect(passwordUpdateBody.safeParse({ category: 'dev' }).success).toBe(true);
  });
});

describe('passwordBulkDeleteBody', () => {
  it('accepts valid ids', () => {
    expect(passwordBulkDeleteBody.safeParse({ ids: [1, 2, 3] }).success).toBe(true);
  });

  it('rejects empty array', () => {
    expect(passwordBulkDeleteBody.safeParse({ ids: [] }).success).toBe(false);
  });

  it('rejects non-positive ids', () => {
    expect(passwordBulkDeleteBody.safeParse({ ids: [0] }).success).toBe(false);
    expect(passwordBulkDeleteBody.safeParse({ ids: [-1] }).success).toBe(false);
  });
});

describe('passwordChangeMasterBody', () => {
  it('accepts valid change', () => {
    expect(
      passwordChangeMasterBody.safeParse({
        currentPassword: 'oldpass',
        newPassword: 'newpass12',
      }).success,
    ).toBe(true);
  });

  it('rejects short new password', () => {
    expect(
      passwordChangeMasterBody.safeParse({
        currentPassword: 'oldpass',
        newPassword: 'short',
      }).success,
    ).toBe(false);
  });
});
