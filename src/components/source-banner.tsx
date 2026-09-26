import { FlaskConical, CircleCheck } from 'lucide-react';
import { lateResultsWarning } from '@/services/football/freshness';
import type { Dataset } from '@/types/football';
export function SourceBanner({
  data,
}: {
  data: Pick<Dataset, 'source' | 'warning' | 'updatedAt'>;
}) {
  const warning = data.warning
    ?.replace('Source OpenFootball. Statistiques avancées indisponibles sans enrichissement.', '')
    .replace('Classements calculés sur les résultats disponibles.', '')
    .replace('Les classements sont calculés à partir des résultats disponibles.', '')
    .replace(lateResultsWarning, 'Certains résultats sont encore en attente de confirmation.')
    .trim();
  return (
    <>
      <div className={`source-banner ${data.source === 'demo' ? 'demo' : ''}`}>
        {data.source === 'demo' ? (
          <>
            <FlaskConical size={14} />
            <strong>Mode démonstration</strong>
            <span>Matchs, effectifs et statistiques fictifs pour explorer la plateforme.</span>
          </>
        ) : (
          <>
            <CircleCheck size={14} />
            <strong>Données football</strong>
            <span>
              {data.updatedAt
                ? `Synchronisé le ${new Date(data.updatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`
                : 'En attente de synchronisation'}
            </span>
          </>
        )}
      </div>
      {warning && (
        <p className="warning" role="status">
          {warning}
        </p>
      )}
    </>
  );
}
