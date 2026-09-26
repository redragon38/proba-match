export function TrendChart({
  values,
  label,
}: {
  values: { label: string; value: number }[];
  label: string;
}) {
  if (!values.length) return <p className="data-note">Données insuffisantes</p>;
  const max = Math.max(1, ...values.map((v) => v.value));
  const points = values
    .map(
      (v, i) => `${30 + (i * 540) / Math.max(1, values.length - 1)},${165 - (v.value / max) * 125}`,
    )
    .join(' ');
  return (
    <figure className="trend-chart">
      <svg role="img" aria-label={label} viewBox="0 0 600 200">
        <title>{label}</title>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1="30" x2="575" y1={165 - i * 42} y2={165 - i * 42} stroke="var(--line)" />
            <text x="5" y={168 - i * 42} fontSize="10" fill="var(--muted)">
              {((max * i) / 3).toFixed(0)}
            </text>
          </g>
        ))}
        <polygon points={`30,165 ${points} 570,165`} fill="var(--green-light)" />
        <polyline points={points} fill="none" stroke="var(--green)" strokeWidth="3" />
        {values.map((v, i) => (
          <g key={i}>
            <circle
              cx={30 + (i * 540) / Math.max(1, values.length - 1)}
              cy={165 - (v.value / max) * 125}
              r="4"
              fill="var(--green)"
            >
              <title>{`${v.label} : ${v.value}`}</title>
            </circle>
            <text
              x={30 + (i * 540) / Math.max(1, values.length - 1)}
              y="188"
              textAnchor="middle"
              fontSize="9"
              fill="var(--muted)"
            >
              {v.label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
export function RadarChart({
  labels,
  a,
  b,
  names,
}: {
  labels: string[];
  a: number[];
  b: number[];
  names: [string, string];
}) {
  const point = (i: number, v: number) =>
    `${150 + Math.sin((i * Math.PI * 2) / labels.length) * v},${150 - Math.cos((i * Math.PI * 2) / labels.length) * v}`;
  return (
    <figure className="radar-chart">
      <svg
        role="img"
        aria-label={`Comparaison normalisée : ${names.join(' et ')}`}
        viewBox="0 0 300 300"
      >
        <title>Indices normalisés de 0 à 100</title>
        {[25, 50, 75, 100].map((v) => (
          <polygon
            key={v}
            points={labels.map((_, i) => point(i, v)).join(' ')}
            fill="none"
            stroke="var(--line)"
          />
        ))}
        {labels.map((label, i) => {
          const [x, y] = point(i, 125).split(',');
          return (
            <g key={label}>
              <line
                x1="150"
                y1="150"
                x2={point(i, 100).split(',')[0]}
                y2={point(i, 100).split(',')[1]}
                stroke="var(--line)"
              />
              <text x={x} y={y} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {label}
              </text>
            </g>
          );
        })}
        <polygon
          points={a.map((v, i) => point(i, Math.max(0, Math.min(100, v)))).join(' ')}
          fill="#20947825"
          stroke="#209478"
          strokeWidth="2"
        />
        <polygon
          points={b.map((v, i) => point(i, Math.max(0, Math.min(100, v)))).join(' ')}
          fill="#61798d22"
          stroke="#61798d"
          strokeWidth="2"
        />
      </svg>
      <figcaption>
        <span>● {names[0]}</span>
        <span>● {names[1]}</span>
      </figcaption>
    </figure>
  );
}
