import { isoDate, isoDateTime } from './factual-dates';
import type { Match } from '@/types/football';
import { validResult } from '@/prediction-engine/availability';
import { isAwaitingResult } from '@/services/football/match-selection';
import type { Dataset } from '@/types/football';

export function matchDateLabel(
  match: Pick<Match, 'kickoff' | 'kickoffKnown' | 'sourceDate'>,
  long = true,
) {
  const rawDate = match.kickoffKnown === false ? match.sourceDate : match.kickoff;
  const confirmed =
    match.kickoffKnown === false ? isoDate(rawDate) : (isoDateTime(rawDate) ?? isoDate(rawDate));
  if (!confirmed) return null;
  return new Date(confirmed).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: long ? 'numeric' : '2-digit',
    month: long ? 'long' : '2-digit',
    year: 'numeric',
  });
}
export function matchFactSummary(match: Match, home: string, away: string, competition: string) {
  const date = matchDateLabel(match);
  const time = matchTimeLabel(match);
  const subject = `${home} – ${away}, ${competition}${date ? `, le ${date}${time ? ` à ${time}` : ''}` : ', date à confirmer'}.`;
  if (validResult(match))
    return `${subject} Score enregistré : ${match.homeScore}–${match.awayScore}. Match terminé.`;
  const status =
    match.status === 'finished'
      ? 'Rencontre signalée terminée ; score confirmé indisponible.'
      : match.status === 'postponed'
        ? 'Match reporté ; nouvelle date à confirmer.'
        : match.status === 'cancelled'
          ? 'Match annulé.'
          : match.status === 'abandoned'
            ? 'Match abandonné ; résultat définitif non confirmé.'
            : match.status === 'live'
              ? 'Rencontre en cours ; les données peuvent être retardées.'
              : isAwaitingResult(match)
                ? 'Résultat en attente de confirmation par la source.'
                : match.kickoffKnown === false
                  ? 'Heure du coup d’envoi non confirmée.'
                  : 'Rencontre programmée.';
  return `${subject} ${status}`;
}

function matchTimeLabel(match: Match) {
  if (match.kickoffKnown === false || !isoDateTime(match.kickoff)) return null;
  return new Date(match.kickoff).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
  });
}

export function matchSeoCopy(match: Match, data: Dataset, hasPrediction = false) {
  const home = data.teams.find((team) => team.id === match.homeId)?.name ?? 'Domicile';
  const away = data.teams.find((team) => team.id === match.awayId)?.name ?? 'Extérieur';
  const competition =
    data.competitions.find((item) => item.id === match.competitionId)?.name ?? 'Football';
  const fixture = `${home}–${away}`;
  const time = matchTimeLabel(match);
  const date = `${matchDateLabel(match) ?? 'date à confirmer'}${time ? ` à ${time}` : ''}`;
  const summary = matchFactSummary(match, home, away, competition);

  if (validResult(match))
    return {
      title: `${fixture} : résultat ${match.homeScore}–${match.awayScore}, ${competition}, ${date}`,
      description: summary,
    };
  if (match.status === 'live')
    return {
      title: `${fixture} en direct — ${competition}, ${date}`,
      description: `${summary} Score et événements affichés selon les dernières données reçues.`,
    };
  if (match.status === 'scheduled')
    return {
      title: hasPrediction
        ? `${fixture} : analyse et probabilités du ${date}`
        : `${fixture} : match du ${date}`,
      description: hasPrediction
        ? `${summary} Consultez l’analyse et les probabilités archivées avant le coup d’envoi.`
        : `${summary} Consultez l’horaire, la forme disponible et les informations confirmées.`,
    };
  const state =
    match.status === 'postponed'
      ? 'match reporté'
      : match.status === 'cancelled'
        ? 'match annulé'
        : 'match abandonné';
  return { title: `${fixture} : ${state} — ${competition}, ${date}`, description: summary };
}
