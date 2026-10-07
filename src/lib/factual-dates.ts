/** Reject silent calendar normalization; a missing date must stay missing. */
export function isoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}
export function isoDateTime(value: string | undefined) {
  const parts = value?.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  if (
    !parts ||
    !isoDate(parts[1]) ||
    Number(parts[2]) > 23 ||
    Number(parts[3]) > 59 ||
    Number(parts[4] ?? 0) > 59 ||
    !Number.isFinite(Date.parse(value!))
  )
    return undefined;
  return value;
}
export function playerBirthDate(
  value: string | undefined,
  today = new Date().toISOString().slice(0, 10),
) {
  const date = isoDate(value);
  return date && isoDate(today) && date <= today ? date : undefined;
}
/** Completed calendar years at the dataset reference date, not elapsed days / 365. */
export function playerAge(birthDate: string | undefined, reference: string | undefined) {
  if (
    !birthDate ||
    !isoDate(birthDate) ||
    !reference ||
    !(isoDateTime(reference) ?? isoDate(reference))
  )
    return undefined;
  const at = new Date(reference).toISOString().slice(0, 10);
  if (birthDate > at) return undefined;
  return (
    Number(at.slice(0, 4)) -
    Number(birthDate.slice(0, 4)) -
    (at.slice(5) < birthDate.slice(5) ? 1 : 0)
  );
}
