type TimedEvent = { minute: number; extra?: number | null };
export function eventMinute(event: TimedEvent) {
  return `${event.minute}${event.extra != null && event.extra > 0 ? `+${event.extra}` : ''}`;
}
/** Added time orders events within their period, not ahead of the next period. */
export function compareEventTime(a: TimedEvent, b: TimedEvent) {
  return a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0);
}
