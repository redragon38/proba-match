import { expect, it } from 'vitest';
import { internalPath, resumePages } from '../scripts/seo-resume.mjs';
it('resolves relative pagination against the current page without crawling external URLs', () => {
  const base = 'https://example.test';
  expect(internalPath('?page=2', '/matchs', base)).toBe('/matchs?page=2');
  expect(internalPath('?saison=2025', '/competition/ligue-1', base)).toBe('/competition/ligue-1?saison=2025');
  expect(internalPath('//another.test/x', '/', base)).toBeNull();
  expect(internalPath('#main', '/', base)).toBeNull();
  expect(internalPath('mailto:test@example.test', '/', base)).toBeNull();
  expect(internalPath('http://[', '/', base)).toBeNull();
});
it('resumes one host only and keeps one saved result per path', () => {
  const base = 'https://example.test';
  expect(
    resumePages(
      {
        base,
        pages: [
          { path: '/', status: 200 },
          { path: '/', status: 503 },
        ],
      },
      base,
    ),
  ).toEqual([{ path: '/', status: 503 }]);
  expect(() => resumePages({ base, pages: [] }, 'https://another.test')).toThrow(
    'SEO_RESUME_ORIGIN_MISMATCH',
  );
  expect(() => resumePages({ base, pages: [{ path: '//another.test' }] }, base)).toThrow(
    'SEO_RESUME_INVALID_PATH',
  );
});
