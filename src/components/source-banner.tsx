import { FlaskConical, CircleCheck } from 'lucide-react';
import type { Dataset } from '@/types/football';
export function SourceBanner({
  data,
}: {
  data: Pick<Dataset, 'source' | 'warning' | 'updatedAt'>;
}) {
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
            <strong>
              Source :{' '}
              {data.source === 'openfootball' ? 'OpenFootball · base Proba Match' : 'API-Football'}
            </strong>
            <span>
              {data.updatedAt
                ? `Synchronisé le ${new Date(data.updatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`
                : 'En attente de synchronisation'}
            </span>
          </>
        )}
      </div>
      {data.warning && (
        <p className="warning" role="status">
          {data.warning}
        </p>
      )}
    </>
  );
}
