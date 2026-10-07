import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  footballTerms,
  glossaryData,
  probabilityQuestions,
  probabilityFaqData,
} from '@/lib/editorial';
import { publicMetadata, searchVerification, matchIndexable, playerIndexable } from '@/lib/seo';
import { createDemoDataset } from '@/services/football/providers/mock';
import { JsonLd } from '@/components/json-ld';
import Glossary from '@/app/lexique-football/page';
import Sources from '@/app/sources-donnees/page';
import Guide from '@/app/comprendre-probabilites/page';

describe('Editorial SEO and machine-readable honesty', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('keeps structured glossary descriptions present in the rendered server content', () => {
    const html = renderToStaticMarkup(createElement(Glossary)).replace(
      /<script[\s\S]*?<\/script>/g,
      '',
    );
    expect(footballTerms).toHaveLength(24);
    expect(new Set(footballTerms.map((t) => t.id)).size).toBe(24);
    const terms = glossaryData().hasDefinedTerm;
    for (const term of terms) {
      const anchor = new URL(term.url).hash.slice(1);
      expect(html).toContain(`id="${anchor}"`);
      expect(html).toContain(term.name.replace(/&/g, '&amp;'));
      const source = footballTerms.find((t) => t.id === anchor)!;
      expect(html).toContain(source.definition);
      expect(html).toContain(source.caution);
    }
  });
  it('publishes FAQ answers visibly and does not invent ratings or accuracy claims', () => {
    const html = renderToStaticMarkup(createElement(Guide)).replace(
      /<script[\s\S]*?<\/script>/g,
      '',
    );
    for (const { question, answer } of probabilityQuestions) {
      expect(html).toContain(question);
      expect(html).toContain(answer);
    }
    expect(probabilityFaqData().mainEntity).toHaveLength(probabilityQuestions.length);
    expect(html).not.toContain('aggregateRating');
    expect(html).toContain('ne certifient pas la précision');
  });
  it('keeps origin, absence and freshness limitations visible without browser JavaScript', () => {
    const html = renderToStaticMarkup(createElement(Sources));
    expect(html).toContain('ne garantit pas les scores en direct');
    expect(html).toContain('Une valeur absente ne devient pas zéro');
    expect(html).toContain('ne délivre aucune licence');
    expect(html).toContain('href="/contact"');
  });
  it('preserves staging noindex even on new editorial routes', () => {
    vi.stubEnv('APP_ENV', 'staging');
    for (const route of ['/lexique-football', '/sources-donnees'])
      expect(publicMetadata(route).robots).toEqual({ index: false, follow: false });
  });
  it('only exposes real optional owner-supplied verification tokens', () => {
    expect(searchVerification({})).toEqual({});
    expect(
      searchVerification({ GOOGLE_SITE_VERIFICATION: ' ', BING_SITE_VERIFICATION: ' token ' }),
    ).toEqual({ other: { 'msvalidate.01': 'token' } });
  });
  it('keeps invalid observations out of indexable match and player pages', () => {
    const m = {
      ...createDemoDataset(new Date('2026-09-11T12:00:00Z')).matches[0],
      status: 'scheduled' as const,
      events: [],
      lineups: [],
      statistics: [{ label: 'Tirs', home: -2, away: null }],
    };
    expect(matchIndexable(m)).toBe(false);
    expect(
      matchIndexable({
        ...m,
        status: 'live',
        statistics: [{ label: 'Possession', home: 110, away: null, unit: '%' }],
      }),
    ).toBe(false);
    expect(
      matchIndexable({
        ...m,
        status: 'live',
        statistics: [{ label: 'Tirs', home: 0, away: null }],
      }),
    ).toBe(true);
    for (const value of [Infinity, NaN, 5.5, -1, null, undefined])
      expect(playerIndexable(value)).toBe(false);
    expect(playerIndexable(5)).toBe(true);
  });
  it('escapes a script-closing sequence inside structured content', () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { value: { name: '</script><script>alert(1)</script>' } }),
    );
    expect((html.match(/<script/g) ?? []).length).toBe(1);
    expect(html).toContain('\\u003c/script>');
  });
});
