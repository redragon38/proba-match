import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const alt = 'Proba Match — Le football, éclairé par les données';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/brand/proba-match-logo-social.png'));
  return new ImageResponse(
    <div
      style={{
        background: '#143c32',
        color: '#f0f5d2',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 80,
        justifyContent: 'space-between',
      }}
    >
      {/* ImageResponse renders PNG bytes directly, without a browser image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${logo.toString('base64')}`}
        width={1040}
        height={197}
        alt="Proba Match"
        style={{ objectFit: 'contain' }}
      />
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, display: 'flex' }}>
        Tout le jeu. Tous les détails.
      </div>
      <div style={{ fontSize: 25, color: '#a2c4b3', display: 'flex' }}>
        STATISTIQUES · MATCHS · PROJECTIONS
      </div>
    </div>,
    size,
  );
}
