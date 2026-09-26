export default function Loading() {
  return (
    <div className="page" aria-label="Chargement en cours" role="status">
      <div className="skeleton" style={{ height: 100 }} />
      {[1, 2, 3].map((n) => (
        <div key={n} className="skeleton" style={{ height: 160, marginTop: 20 }} />
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
