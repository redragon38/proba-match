'use client';
import Link from 'next/link';
import { usePreference } from '@/lib/preferences';
import { NotificationSettings } from '@/features/notifications';
import { FavoriteButton } from '@/features/favorites';
export function Settings({
  competitions,
}: {
  competitions: { id: string; name: string; flag: string }[];
}) {
  const [theme, setTheme] = usePreference('matchscore-theme', 'dark');
  const [density, setDensity] = usePreference('matchscore-density', 'comfortable');
  return (
    <div className="page settings-page">
      <span className="eyebrow">À VOTRE FAÇON</span>
      <h1>Paramètres</h1>
      <p className="intro-text">Votre sélection reste sur cet appareil. Aucun compte nécessaire.</p>
      <section className="card padded">
        <h2>Apparence</h2>
        <fieldset className="preference-group">
          <legend>Thème</legend>
          <div className="segmented">
            {[
              ['system', 'Automatique'],
              ['light', 'Clair'],
              ['dark', 'Sombre'],
            ].map(([value, label]) => (
              <button key={value} aria-pressed={theme === value} onClick={() => setTheme(value)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="preference-group">
          <legend>Affichage des matchs</legend>
          <div className="segmented">
            {[
              ['comfortable', 'Confortable'],
              ['compact', 'Compact'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={density === value}
                onClick={() => setDensity(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>
      <section className="card padded">
        <h2>Vos compétitions</h2>
        <p className="data-note">
          Les compétitions favorites apparaissent en priorité dans vos listes.
        </p>
        {competitions.map((c) => (
          <div className="settings-row" key={c.id}>
            <span>
              {c.flag} {c.name}
            </span>
            <FavoriteButton id={`competition:${c.id}`} label={c.name} />
          </div>
        ))}
        <Link className="text-link" href="/favoris">
          Gérer toutes mes équipes, joueurs et matchs favoris →
        </Link>
      </section>
      <section className="card padded">
        <h2>Notifications</h2>
        <NotificationSettings />
      </section>
      <section className="card padded">
        <h2>Langue et horaires</h2>
        <p>Français · Les heures des matchs suivent le fuseau horaire de votre appareil.</p>
      </section>
    </div>
  );
}
