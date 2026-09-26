'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page empty">
      <h1>La connexion a pris une pause.</h1>
      <p>Nous n’avons pas pu charger ces informations.</p>
      <button className="button" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
