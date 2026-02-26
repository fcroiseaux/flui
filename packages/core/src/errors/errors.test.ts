import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ErrorCategory, FluiErrorCode } from './index';
import {
  ERROR_CODE_DESCRIPTIONS,
  err,
  error,
  FLUI_E001,
  FLUI_E002,
  FLUI_E003,
  FLUI_E004,
  FLUI_E005,
  FLUI_E006,
  FLUI_E007,
  FLUI_E008,
  FLUI_E009,
  FLUI_E010,
  FLUI_E011,
  FLUI_E012,
  FLUI_E013,
  FLUI_E014,
  FLUI_E015,
  FLUI_E016,
  FLUI_E017,
  FLUI_E018,
  FLUI_E019,
  FLUI_E020,
  FluiError,
  isError,
  isOk,
  ok,
  Result,
} from './index';
import type { Result as ResultType } from './result';

describe('errors', () => {
  describe('FluiError', () => {
    it('extends Error', () => {
      const error = new FluiError('FLUI_E001', 'config', 'test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('is identifiable via instanceof', () => {
      const error = new FluiError('FLUI_E001', 'config', 'test message');
      expect(error).toBeInstanceOf(FluiError);
    });

    it('sets name to FluiError', () => {
      const error = new FluiError('FLUI_E001', 'config', 'test message');
      expect(error.name).toBe('FluiError');
    });

    it('sets code, category, and message correctly', () => {
      const error = new FluiError('FLUI_E003', 'validation', 'Invalid intent provided');
      expect(error.code).toBe('FLUI_E003');
      expect(error.category).toBe('validation');
      expect(error.message).toBe('Invalid intent provided');
    });

    it('sets all properties from constructor options', () => {
      const cause = new Error('original');
      const context = { field: 'username', value: 42 };
      const error = new FluiError('FLUI_E004', 'validation', 'Type mismatch', {
        context,
        cause,
      });
      expect(error.code).toBe('FLUI_E004');
      expect(error.category).toBe('validation');
      expect(error.message).toBe('Type mismatch');
      expect(error.context).toStrictEqual(context);
      expect(error.cause).toBe(cause);
    });

    it('creates without optional properties', () => {
      const error = new FluiError('FLUI_E001', 'config', 'no extras');
      expect(error.context).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('wraps a cause error', () => {
      const original = new TypeError('cannot read property');
      const error = new FluiError('FLUI_E008', 'config', 'Init failed', {
        cause: original,
      });
      expect(error.cause).toBe(original);
      expect(error.cause).toBeInstanceOf(TypeError);
    });

    it('includes structured context record', () => {
      const context = { componentName: 'DataTable', registrySize: 12 };
      const error = new FluiError('FLUI_E006', 'generation', 'Component not found', {
        context,
      });
      expect(error.context).toStrictEqual(context);
      expect(error.context?.componentName).toBe('DataTable');
      expect(error.context?.registrySize).toBe(12);
    });

    it('serializes to JSON with code, category, message, and context', () => {
      const context = { key: 'value' };
      const error = new FluiError('FLUI_E005', 'validation', 'Schema failed', { context });
      const json = error.toJSON();
      expect(json).toStrictEqual({
        name: 'FluiError',
        code: 'FLUI_E005',
        category: 'validation',
        message: 'Schema failed',
        context: { key: 'value' },
      });
    });

    it('serializes to JSON without cause stack traces', () => {
      const cause = new Error('secret internal error');
      const error = new FluiError('FLUI_E008', 'config', 'Init failed', { cause });
      const json = error.toJSON();
      expect(json).not.toHaveProperty('cause');
      expect(json).not.toHaveProperty('stack');
      expect(JSON.stringify(json)).not.toContain('secret internal error');
    });

    it('has readonly properties', () => {
      const error = new FluiError('FLUI_E001', 'config', 'test');
      // TypeScript enforces readonly at compile time; verify values are stable
      expect(error.code).toBe('FLUI_E001');
      expect(error.category).toBe('config');
      expect(error.name).toBe('FluiError');
    });

    it('produces a stack trace', () => {
      const error = new FluiError('FLUI_E001', 'config', 'stack test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('stack test');
    });

    it('works with each error category', () => {
      const categories: ErrorCategory[] = [
        'validation',
        'generation',
        'cache',
        'connector',
        'config',
        'context',
      ];
      for (const category of categories) {
        const error = new FluiError('FLUI_E001', category, `test ${category}`);
        expect(error.category).toBe(category);
      }
    });
  });

  describe('error codes', () => {
    const allCodes = [
      FLUI_E001,
      FLUI_E002,
      FLUI_E003,
      FLUI_E004,
      FLUI_E005,
      FLUI_E006,
      FLUI_E007,
      FLUI_E008,
      FLUI_E009,
      FLUI_E010,
      FLUI_E011,
      FLUI_E012,
      FLUI_E013,
      FLUI_E014,
      FLUI_E015,
      FLUI_E016,
      FLUI_E017,
      FLUI_E018,
      FLUI_E019,
      FLUI_E020,
    ] as const;

    it('exports all 20 error code constants', () => {
      expect(allCodes).toHaveLength(20);
    });

    it('all codes have correct FLUI_EXXX format', () => {
      for (const code of allCodes) {
        expect(code).toMatch(/^FLUI_E0\d{2}$/);
      }
    });

    it('codes are sequential from FLUI_E001 to FLUI_E020', () => {
      const expected = Array.from(
        { length: 20 },
        (_, i) => `FLUI_E${String(i + 1).padStart(3, '0')}`,
      );
      expect([...allCodes]).toStrictEqual(expected);
    });

    it('ERROR_CODE_DESCRIPTIONS has entries for all defined codes', () => {
      for (const code of allCodes) {
        expect(ERROR_CODE_DESCRIPTIONS[code]).toBeDefined();
        expect(typeof ERROR_CODE_DESCRIPTIONS[code]).toBe('string');
        expect(ERROR_CODE_DESCRIPTIONS[code].length).toBeGreaterThan(0);
      }
    });

    it('ERROR_CODE_DESCRIPTIONS has exactly 20 entries', () => {
      expect(Object.keys(ERROR_CODE_DESCRIPTIONS)).toHaveLength(20);
    });

    it('ErrorCategory type accepts all valid categories', () => {
      const categories: ErrorCategory[] = [
        'validation',
        'generation',
        'cache',
        'connector',
        'config',
        'context',
      ];
      expect(categories).toHaveLength(6);
      for (const cat of categories) {
        expectTypeOf(cat).toMatchTypeOf<ErrorCategory>();
      }
    });

    it('FluiErrorCode type matches exported constants', () => {
      expectTypeOf(FLUI_E001).toMatchTypeOf<FluiErrorCode>();
      expectTypeOf(FLUI_E005).toMatchTypeOf<FluiErrorCode>();
      expectTypeOf(FLUI_E010).toMatchTypeOf<FluiErrorCode>();
    });

    it('ErrorCategory rejects invalid values at compile time', () => {
      // @ts-expect-error invalid category must fail type-checking
      const invalidCategory: ErrorCategory = 'network';
      expect(invalidCategory).toBe('network');
    });

    it('FluiErrorCode supports reserved range through FLUI_E099', () => {
      const reservedCode: FluiErrorCode = 'FLUI_E099';
      expect(reservedCode).toBe('FLUI_E099');
    });
  });

  describe('ok', () => {
    it('creates success result with ok: true', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result).toStrictEqual({ ok: true, value: 42 });
    });

    it('preserves the value type', () => {
      const result = ok({ name: 'test', count: 5 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toStrictEqual({ name: 'test', count: 5 });
      }
    });

    it('works with string values', () => {
      const result = ok('hello');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('hello');
      }
    });
  });

  describe('err', () => {
    it('creates failure result with ok: false', () => {
      const error = new FluiError('FLUI_E001', 'config', 'bad config');
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result).toStrictEqual({ ok: false, error });
    });

    it('preserves the FluiError instance', () => {
      const error = new FluiError('FLUI_E003', 'validation', 'bad intent');
      const result = err(error);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error).toBeInstanceOf(FluiError);
        expect(result.error.code).toBe('FLUI_E003');
      }
    });
  });

  describe('error', () => {
    it('creates failure result with ok: false', () => {
      const failure = new FluiError('FLUI_E002', 'config', 'missing required config');
      const result = error(failure);
      expect(result.ok).toBe(false);
      expect(result).toStrictEqual({ ok: false, error: failure });
    });
  });

  describe('Result factory object', () => {
    it('creates success with Result.ok(value)', () => {
      const result = Result.ok('done');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('done');
      }
    });

    it('creates failure with Result.error(error)', () => {
      const failure = new FluiError('FLUI_E003', 'validation', 'invalid intent');
      const result = Result.error(failure);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(failure);
      }
    });
  });

  describe('compile-time misconfiguration checks', () => {
    it('rejects missing fallback in config-like type', () => {
      type RequiresFallback = { fallback: string };
      const validConfig: RequiresFallback = { fallback: 'fallback-ui' };
      expect(validConfig.fallback).toBe('fallback-ui');

      // @ts-expect-error fallback is required
      const invalidConfig: RequiresFallback = {};
      expect(invalidConfig).toStrictEqual({});
    });
  });

  describe('isOk', () => {
    it('returns true for ok results', () => {
      const result: ResultType<number> = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it('returns false for error results', () => {
      const error = new FluiError('FLUI_E001', 'config', 'fail');
      const result: ResultType<number> = err(error);
      expect(isOk(result)).toBe(false);
    });

    it('narrows type after guard check', () => {
      const result: ResultType<string> = ok('value');
      if (isOk(result)) {
        expectTypeOf(result.value).toBeString();
        expect(result.value).toBe('value');
      }
    });
  });

  describe('isError', () => {
    it('returns true for error results', () => {
      const error = new FluiError('FLUI_E001', 'config', 'fail');
      const result: ResultType<number> = err(error);
      expect(isError(result)).toBe(true);
    });

    it('returns false for ok results', () => {
      const result: ResultType<number> = ok(42);
      expect(isError(result)).toBe(false);
    });

    it('narrows type after guard check', () => {
      const error = new FluiError('FLUI_E005', 'validation', 'schema failed');
      const result: ResultType<string> = err(error);
      if (isError(result)) {
        expectTypeOf(result.error).toMatchTypeOf<FluiError>();
        expect(result.error.code).toBe('FLUI_E005');
      }
    });
  });

  describe('Result type narrowing', () => {
    it('narrows correctly after if (result.ok) check', () => {
      const result: ResultType<number> = ok(42);
      if (result.ok) {
        expect(result.value).toBe(42);
        expectTypeOf(result.value).toBeNumber();
      } else {
        // Should not reach here
        expect.unreachable('Expected ok result');
      }
    });

    it('narrows correctly after if (!result.ok) check', () => {
      const error = new FluiError('FLUI_E001', 'config', 'fail');
      const result: ResultType<number> = err(error);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expectTypeOf(result.error).toMatchTypeOf<FluiError>();
      } else {
        expect.unreachable('Expected error result');
      }
    });

    it('works with complex generic types', () => {
      interface User {
        id: string;
        name: string;
      }
      const user: User = { id: '1', name: 'Alice' };
      const result: ResultType<User> = ok(user);
      if (result.ok) {
        expect(result.value.id).toBe('1');
        expect(result.value.name).toBe('Alice');
      }
    });
  });
});
