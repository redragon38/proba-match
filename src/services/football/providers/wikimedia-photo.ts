/** Fetch only Commons portraits with a verified reusable licence, during server-side imports. */
export interface LicensedPhoto {
  photo: string;
  photoCredit: string;
  photoSource: string;
  photoLicense: string;
  photoLicenseUrl: string;
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
const string = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;
const field = (value: unknown): string | undefined => string(object(value)?.value);
const plainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
    .slice(0, 180);

export function licensedCommonsPhoto(info: unknown): LicensedPhoto | null {
  const row = object(info);
  const metadata = object(row?.extmetadata);
  const photo = string(row?.thumburl);
  const photoSource = string(row?.descriptionurl);
  const photoLicense = field(metadata?.LicenseShortName);
  const photoLicenseUrl = field(metadata?.LicenseUrl);
  const artist = field(metadata?.Artist);
  if (!photo || !photoSource || !photoLicense || !photoLicenseUrl || !artist) return null;
  if (!/^https:\/\/(?:thumb|upload)\.wikimedia\.org\//.test(photo)) return null;
  if (!photoSource.startsWith('https://commons.wikimedia.org/wiki/File:')) return null;
  if (!/^CC (?:BY|BY-SA) \d\.\d$|^CC0(?: 1\.0)?$/.test(photoLicense)) return null;
  if (
    !/^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/\d\.\d|publicdomain\/zero\/1\.0)\/?$/.test(
      photoLicenseUrl,
    )
  )
    return null;
  const photoCredit = plainText(artist);
  return photoCredit ? { photo, photoCredit, photoSource, photoLicense, photoLicenseUrl } : null;
}

export async function wikimediaPhotos(ids: string[]): Promise<Map<string, LicensedPhoto>> {
  const valid = [...new Set(ids.filter((id) => /^Q[1-9]\d{0,12}$/.test(id)))].slice(0, 30);
  const photos = new Map<string, LicensedPhoto>();
  if (!valid.length) return photos;
  const headers = { 'User-Agent': 'ProbaMatch/1.0 (https://proba-match.vercel.app)' };
  const wikidata = new URL('https://www.wikidata.org/w/api.php');
  wikidata.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: valid.join('|'),
    props: 'claims',
    format: 'json',
  }).toString();
  const entitiesResponse = await fetch(wikidata, {
    headers,
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!entitiesResponse.ok) return photos;
  const entities = object(object(await entitiesResponse.json())?.entities);
  const files = new Map<string, string>();
  for (const id of valid) {
    const claims = object(object(entities?.[id])?.claims);
    const image = Array.isArray(claims?.P18) ? claims.P18[0] : null;
    const title = string(object(object(object(image)?.mainsnak)?.datavalue)?.value);
    if (title?.match(/\.(?:jpe?g|png|webp)$/i)) files.set(`File:${title}`, id);
  }
  if (!files.size) return photos;
  const commons = new URL('https://commons.wikimedia.org/w/api.php');
  commons.search = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '180',
    titles: [...files.keys()].join('|'),
    format: 'json',
  }).toString();
  const commonsResponse = await fetch(commons, {
    headers,
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!commonsResponse.ok) return photos;
  const pages = object(object(object(await commonsResponse.json())?.query)?.pages);
  for (const page of Object.values(pages ?? {})) {
    const value = object(page);
    const id = files.get(string(value?.title) ?? '');
    const imageInfo = Array.isArray(value?.imageinfo) ? value.imageinfo[0] : null;
    const photo = licensedCommonsPhoto(imageInfo);
    if (id && photo) photos.set(id, photo);
  }
  return photos;
}
