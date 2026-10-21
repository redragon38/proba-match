import { createHash } from 'node:crypto';

export function findings(report) {
  const checks =
    report.completed === false
      ? [
          ...report.checks,
          {
            category: 'audit',
            status: 'FAIL',
            detail: 'Audit incomplet : contrôles restants non vérifiés',
          },
        ]
      : report.checks;
  return checks
    .filter((c) => c.status !== 'PASS')
    .map((c) => ({
      ...c,
      priority:
        c.status === 'WARNING' ? 'P2' : /routes|synchronization|SSR/.test(c.category) ? 'P0' : 'P1',
    }));
}
export function monitorState(report, previous = {}) {
  const current = findings(report);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(current.map((c) => [c.priority, c.category, c.detail]).sort()))
    .digest('hex');
  return {
    fingerprint,
    changed: fingerprint !== previous.fingerprint,
    failures: current.filter((c) => c.status === 'FAIL').length,
    warnings: current.filter((c) => c.status === 'WARNING').length,
  };
}
export function markdownReport(report, priority) {
  const selected = findings(report).filter((c) => !priority || c.priority === priority);
  const line = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  return `# Audit SEO\n\nDate : ${report.generatedAt}\n\nSite : ${report.base}\n\n${report.pages.length} pages vérifiées. Exploration ${report.completed === false ? 'en cours ou interrompue' : report.scope.truncated ? 'partielle' : 'complète dans le périmètre découvert'}.\n\nLes mesures navigateur sont des mesures de laboratoire, pas des CWV terrain.\n\n| Priorité | Statut | Contrôle | Détail |\n| --- | --- | --- | --- |\n${selected.map((c) => `| ${c.priority} | ${c.status} | ${line(c.category)} | ${line(c.detail)} |`).join('\n')}\n\n${report.external}\n`;
}
