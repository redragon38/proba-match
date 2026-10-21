export function resumePages(previous, base) {
  if (previous.base !== base || !Array.isArray(previous.pages))
    throw new Error('SEO_RESUME_ORIGIN_MISMATCH');
  const unique = new Map();
  for (const page of previous.pages) {
    if (typeof page.path !== 'string' || !page.path.startsWith('/') || page.path.startsWith('//'))
      throw new Error('SEO_RESUME_INVALID_PATH');
    unique.set(page.path, page);
  }
  return [...unique.values()];
}

export function internalPath(href, path, base) {
  if (href.startsWith('#')) return null;
  try {
    const resolved = new URL(href, new URL(path, base));
    return resolved.origin === new URL(base).origin ? resolved.pathname + resolved.search : null;
  } catch {
    return null;
  }
}
