import { createHash } from 'node:crypto';
import type { Match, Prediction } from '@/types/football';
import { regulationResult } from './result-period';
import { eloHistory } from './elo';
import { scoreDistribution } from './poisson';
import { confidenceScore } from './confidence';
import { formIndex } from './form';
import { shrinkExpectedGoals } from './calibration';
import { resultAvailable, resultAt, type AvailabilityMode } from './availability';
export const MODEL_VERSION = 'elo-poisson-1.4.0';
export const MODEL_PARAMETERS = {
  homeAdvantage: 60,
  halfLifeDays: 60,
  formHalfLifeDays: 30,
  formTilt: 0.12,
  goalStrength: 0.8,
  k: 24,
  minMatches: 5,
  maxMatches: 20,
  resultPeriod: 'regulation',
  historyPolicy: 'all-competitions-cross-season-time-decay',
  historicalRatings: 'received-observations-at-each-kickoff',
  minEffectiveMatches: 5,
} as const;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export class PredictionEngine {
  constructor(
    private homeAdvantage = 60,
    private halfLifeDays = 60,
    private goalStrength: number = MODEL_PARAMETERS.goalStrength,
    private modelVersion = MODEL_VERSION,
    private availabilityMode: AvailabilityMode = 'observed',
  ) {}
  predict(
    match: Match,
    allMatches: Match[],
    asOf: string = new Date().toISOString(),
  ): Prediction | null {
    const predictionAt = Date.parse(asOf),
      kickoff = Date.parse(match.kickoff);
    if (
      !Number.isFinite(predictionAt) ||
      !Number.isFinite(kickoff) ||
      predictionAt >= kickoff ||
      match.homeId === match.awayId ||
      (match.kickoffKnown === false && this.availabilityMode !== 'reconstructed') ||
      match.status !== 'scheduled'
    )
      return null;
    const cutoff = new Date(predictionAt).toISOString();
    const eligible = allMatches.flatMap((m) => {
      if (m.id === match.id || !resultAvailable(m, cutoff, this.availabilityMode)) return [];
      const selected = resultAt(m, cutoff, this.availabilityMode);
      const result =
        selected && regulationResult(selected, this.availabilityMode === 'reconstructed');
      return result ? [result] : [];
    });
    const advantage = match.neutralVenue === true ? 0 : this.homeAdvantage;
    if (new Set(eligible.map((m) => m.id)).size !== eligible.length) return null;
    const { ratings, history } = eloHistory(
      eligible,
      cutoff,
      this.homeAdvantage,
      this.availabilityMode,
    );
    const before = new Map(history.map((r) => [`${r.matchId}:${r.teamId}`, r.before]));
    function sampleFor(id: string) {
      return eligible
        .filter((m) => m.homeId === id || m.awayId === id)
        .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff) || a.id.localeCompare(b.id))
        .slice(0, 20);
    }
    const homeMatches = sampleFor(match.homeId),
      awayMatches = sampleFor(match.awayId);
    if (homeMatches.length < 5 || awayMatches.length < 5) return null;
    const aggregate = (id: string, rows: Match[], venue: 'home' | 'away') => {
      let gf = 0,
        ga = 0,
        weight = 0,
        squaredWeight = 0;
      for (const m of rows) {
        const home = m.homeId === id;
        const days = (new Date(cutoff).getTime() - new Date(m.kickoff).getTime()) / 86400_000;
        const w =
          0.5 ** (days / this.halfLifeDays) *
          (match.neutralVenue === true ? 1 : home === (venue === 'home') ? 1 : 0.65);
        const opponent = before.get(`${m.id}:${home ? m.awayId : m.homeId}`) ?? 1500;
        const adjustment = clamp(10 ** ((opponent - 1500) / 1600), 0.75, 1.3);
        gf += (home ? m.homeScore! : m.awayScore!) * w * adjustment;
        ga += ((home ? m.awayScore! : m.homeScore!) * w) / adjustment;
        weight += w;
        squaredWeight += w * w;
      }
      return {
        attack: gf / weight,
        defense: ga / weight,
        effective: (weight * weight) / squaredWeight,
        weight,
      };
    };
    const h = aggregate(match.homeId, homeMatches, 'home'),
      a = aggregate(match.awayId, awayMatches, 'away');
    if (
      ![h.effective, a.effective].every(
        (n) => Number.isFinite(n) && n >= MODEL_PARAMETERS.minEffectiveMatches,
      )
    )
      return null;
    const eloDiff =
      (ratings.get(match.homeId) ?? 1500) - (ratings.get(match.awayId) ?? 1500) + advantage;
    const homeForm = formIndex(
      match.homeId,
      eligible,
      cutoff,
      before,
      30,
      this.homeAdvantage,
      this.availabilityMode,
    )!;
    const awayForm = formIndex(
      match.awayId,
      eligible,
      cutoff,
      before,
      30,
      this.homeAdvantage,
      this.availabilityMode,
    )!;
    const tilt = clamp(
      10 ** (eloDiff / 2000) * Math.exp(((homeForm - awayForm) / 100) * MODEL_PARAMETERS.formTilt),
      0.75,
      1.35,
    );
    const rawHome = clamp((h.attack * 0.6 + a.defense * 0.4) * tilt, 0.15, 4.5),
      rawAway = clamp((a.attack * 0.6 + h.defense * 0.4) / tilt, 0.15, 4.5);
    const { home: expectedHome, away: expectedAway } = shrinkExpectedGoals(
      rawHome,
      rawAway,
      this.goalStrength,
    );
    const distribution = scoreDistribution(expectedHome, expectedAway);
    const sample = Math.min(homeMatches.length, awayMatches.length);
    const daysOld = Math.max(
      ...[homeMatches[0], awayMatches[0]].map(
        (m) => (new Date(cutoff).getTime() - new Date(m.kickoff).getTime()) / 86400_000,
      ),
    );
    const goals = [...homeMatches, ...awayMatches].map((m) => m.homeScore! + m.awayScore!);
    if (daysOld > 180) return null;
    const mean = goals.reduce((a, b) => a + b, 0) / goals.length;
    const variance = goals.reduce((s, n) => s + (n - mean) ** 2, 0) / goals.length;
    // Lineup availability affects information quality only; v1 does not invent player adjustments.
    const lineupConfirmed =
      match.status === 'scheduled' &&
      match.lineups.length === 2 &&
      match.lineups.every((l) => l.confirmed) &&
      new Date(match.updatedAt) <= new Date(cutoff);
    const confidence = confidenceScore({
      sample: Math.min(h.effective, a.effective),
      daysOld,
      lineups: lineupConfirmed,
      injuries: false,
      stability: 1 / (1 + variance / 4),
      coverage: (3 + Number(match.neutralVenue != null) + Number(lineupConfirmed)) / 7,
    });
    const inputArchive: NonNullable<Prediction['inputArchive']> = {
      schemaVersion: 1,
      modelVersion: this.modelVersion,
      parameters: {
        ...MODEL_PARAMETERS,
        homeAdvantage: this.homeAdvantage,
        halfLifeDays: this.halfLifeDays,
        goalStrength: this.goalStrength,
      },
      availabilityMode: this.availabilityMode,
      cutoff,
      resultPeriod: 'regulation',
      target: {
        ...match,
        events: [],
        statistics: [],
        performances: [],
        resultRevisions: [],
        homeScore: null,
        awayScore: null,
        resultObservedAt: undefined,
        scoreBreakdown: undefined,
      },
      matches: eligible.map((m) => ({
        ...m,
        events: [],
        statistics: [],
        lineups: [],
        performances: [],
        resultRevisions: m.resultRevisions?.filter((r) => Date.parse(r.observedAt) < predictionAt),
      })),
    };
    const inputHash = createHash('sha256').update(JSON.stringify(inputArchive)).digest('hex');
    return {
      id: `${match.id}-${this.modelVersion}-${inputHash.slice(0, 12)}`,
      matchId: match.id,
      version: this.modelVersion,
      createdAt: cutoff,
      cutoff,
      home: distribution.home,
      draw: distribution.draw,
      away: distribution.away,
      expectedHome,
      expectedAway,
      likelyScore: `${distribution.scores[0].home}–${distribution.scores[0].away}`,
      scores: distribution.scores.slice(0, 6),
      cleanHome: Math.exp(-expectedAway),
      cleanAway: Math.exp(-expectedHome),
      confidence,
      sample,
      inputHash,
      inputArchive,
      effectiveSample: Math.min(h.effective, a.effective),
      lineupConfirmed,
      factors: [
        {
          label: 'Production offensive récente',
          detail: `Domicile : ${h.attack.toFixed(2)} ; extérieur : ${a.attack.toFixed(2)} buts pondérés par match.`,
          side: h.attack > a.attack + 0.1 ? 'home' : a.attack > h.attack + 0.1 ? 'away' : 'neutral',
        },
        {
          label: 'Résistance défensive récente',
          detail: `Domicile : ${h.defense.toFixed(2)} ; extérieur : ${a.defense.toFixed(2)} buts encaissés pondérés.`,
          side:
            h.defense + 0.1 < a.defense ? 'home' : a.defense + 0.1 < h.defense ? 'away' : 'neutral',
        },
        {
          label: 'Niveau Elo et terrain',
          detail: `Écart ajusté de ${Math.round(eloDiff)} points, dont ${advantage} points d’avantage à domicile.${match.neutralVenue == null ? ' Terrain neutre non renseigné : avantage domicile supposé par défaut.' : match.neutralVenue ? ' Terrain neutre confirmé.' : ''}`,
          side: eloDiff > 25 ? 'home' : eloDiff < -25 ? 'away' : 'neutral',
        },
        {
          label: 'Récence et échantillon',
          detail: `${homeMatches.length} et ${awayMatches.length} matchs ; quantité effective pondérée : ${h.effective.toFixed(1)} et ${a.effective.toFixed(1)} ; demi-vie des poids : ${this.halfLifeDays} jours. Le lieu et la force adverse ajustent les observations.`,
        },
        {
          label: 'Forme ajustée aux adversaires',
          detail: `Domicile : ${Math.round(homeForm)}/100 ; extérieur : ${Math.round(awayForm)}/100. Dix résultats récents au maximum, pondérés sur 30 jours et comparés aux attentes Elo d’avant chaque rencontre. Ajustement des buts volontairement limité.`,
          side: homeForm > awayForm + 5 ? 'home' : awayForm > homeForm + 5 ? 'away' : 'neutral',
        },
      ],
    };
  }
}
export const predictionEngine = new PredictionEngine();
