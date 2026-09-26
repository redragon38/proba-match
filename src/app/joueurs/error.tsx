'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="page">
      <h1>Joueurs temporairement indisponibles</h1>
      <p>Impossible de charger les joueurs. Réessayez dans quelques instants.</p>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
