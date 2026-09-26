'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <h1>Matchs temporairement indisponibles</h1>
      <p>Impossible de charger le calendrier. Réessayez dans quelques instants.</p>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
