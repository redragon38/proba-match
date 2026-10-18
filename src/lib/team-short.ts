const generic = new Set(['fc', 'cf', 'sc', 'ac', 'afc', 'as', 'us', 'rc', 'cd', '1']);

const normalizedWords = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

/** Preserve supplied abbreviations and replace generic prefixes such as "FC ". */
export function identifiableTeamShort(name: string, supplied?: string | null) {
  const existing = supplied?.trim().toUpperCase();
  if (existing && existing.length >= 3 && !generic.has(existing.toLowerCase())) return existing;
  const words = normalizedWords(name);
  const meaningful = words.find((word) => !generic.has(word.toLowerCase())) ?? words[0] ?? 'Club';
  return meaningful.slice(0, 3).toUpperCase();
}
