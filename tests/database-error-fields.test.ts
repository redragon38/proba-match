import { describe, expect, it } from 'vitest';
import { databaseErrorFields } from '@/lib/logger';

describe('Database failure diagnostics', () => {
  it('keeps only a known exception type and code', () => {
    expect(
      databaseErrorFields({
        name: 'PrismaClientKnownRequestError',
        code: 'P2021',
        message: 'postgresql://user:secret@host/db',
        meta: { password: 'private' },
      }),
    ).toEqual({ errorType: 'PrismaClientKnownRequestError', code: 'P2021' });
    expect(
      databaseErrorFields({ name: 'PrismaClientInitializationError', errorCode: 'P1001' }),
    ).toEqual({ errorType: 'PrismaClientInitializationError', code: 'P1001' });
  });
  it('does not leak arbitrary error fields or non-error inputs', () => {
    for (const error of [
      null,
      undefined,
      'password',
      { name: 'private-name', code: 'private-code', message: 'secret' },
    ]) {
      expect(databaseErrorFields(error)).toEqual({
        errorType: 'UnknownError',
        code: 'UNCLASSIFIED',
      });
    }
  });
});
