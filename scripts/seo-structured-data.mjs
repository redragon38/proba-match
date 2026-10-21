/** Google Event eligibility is stricter than generic JSON syntax or Schema.org typing. */
export function structuredDataIssues(documents) {
  const issues = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.some((type) => ['Event', 'SportsEvent'].includes(type))) {
      if (!value.name || !value.startDate || !value.location?.name || !value.location?.address)
        issues.push('Google Event requires a verified name, startDate and venue with address');
      if (
        value.eventStatus &&
        !/^https?:\/\/schema\.org\/Event(Cancelled|MovedOnline|Postponed|Rescheduled|Scheduled)$/.test(
          value.eventStatus,
        )
      )
        issues.push('Unsupported Schema.org EventStatusType');
    }
    Object.values(value).forEach(visit);
  }
  visit(documents);
  return [...new Set(issues)];
}
