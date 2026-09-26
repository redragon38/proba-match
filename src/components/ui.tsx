import Link from 'next/link';
import { ProviderImage } from './provider-image';
import { ArrowUpRight, Trophy } from 'lucide-react';
import type { Team } from '@/types/football';
import { probabilityPercentages } from '@/lib/probability-format';
import { teamLogo } from '@/lib/team-logo';
export function TeamBadge({
  team,
  size = 30,
}: {
  team: Pick<Team, 'name' | 'short' | 'country' | 'color' | 'logo'>;
  size?: number;
}) {
  const rgb = /^#[0-9a-f]{6}$/i.test(team.color)
    ? team.color
        .slice(1)
        .match(/../g)!
        .map((v) => parseInt(v, 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    : [0, 0, 0];
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const fallback = (
    <span
      aria-hidden="true"
      className="team-badge"
      style={
        {
          '--team-color': team.color,
          color: luminance > 0.179 ? '#000000' : '#ffffff',
          width: size,
          height: size,
          fontSize: size * 0.26,
        } as React.CSSProperties
      }
    >
      {team.short}
    </span>
  );
  const logo = teamLogo(team);
  return logo ? (
    <ProviderImage
      src={logo}
      alt={`Logo de ${team.name}`}
      size={size}
      eager={size >= 64}
      fallback={fallback}
    />
  ) : (
    fallback
  );
}
export function SectionTitle({
  title,
  eyebrow,
  href,
  action = 'Tout voir',
}: {
  title: string;
  eyebrow?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-link">
          {action} <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Empty({
  title = 'Données insuffisantes',
  text = 'Ces informations ne sont pas encore disponibles pour cette sélection.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Trophy size={28} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
export function ProbabilityBar({
  home,
  draw,
  away,
  labels = true,
}: {
  home: number;
  draw: number;
  away: number;
  labels?: boolean;
}) {
  const values = probabilityPercentages(home, draw, away);
  return (
    <div className="probability">
      <div
        className="prob-track"
        role="img"
        aria-label={`Domicile ${values[0]} %, nul ${values[1]} %, extérieur ${values[2]} %`}
      >
        <span style={{ width: `${home * 100}%` }} />
        <span style={{ width: `${draw * 100}%` }} />
        <span style={{ width: `${away * 100}%` }} />
      </div>
      {labels && (
        <div className="prob-labels">
          <span>
            1 <b>{values[0]} %</b>
          </span>
          <span>
            N <b>{values[1]} %</b>
          </span>
          <span>
            2 <b>{values[2]} %</b>
          </span>
        </div>
      )}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function AdSlot() {
  return (
    <div className="ad-slot" role="note" aria-label="Emplacement publicitaire non activé">
      <span>PUBLICITÉ</span>
      <p>Un espace pour nos futurs partenaires</p>
      <small>Votre accès restera gratuit.</small>
    </div>
  );
}
export function Form({ values }: { values: string[] }) {
  return (
    <div className="form-badges">
      {values.map((v, i) => (
        <span
          key={i}
          className={`form-${v}`}
          title={v === 'V' ? 'Victoire' : v === 'N' ? 'Nul' : 'Défaite'}
        >
          {v}
        </span>
      ))}
    </div>
  );
}
