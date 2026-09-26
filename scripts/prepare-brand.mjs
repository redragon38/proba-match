import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const input = process.argv[2];
if (!input) throw new Error('Provide the official 1536 × 768 brand sheet path.');
const metadata = await sharp(input).metadata();
if (metadata.width !== 1536 || metadata.height !== 768)
  throw new Error('Unexpected brand sheet dimensions.');
await mkdir('public/brand', { recursive: true });
// Extract the supplied variants without redrawing, recolouring or changing their proportions.
const dark = { left: 96, top: 100, width: 1352, height: 256 };
const light = { left: 950, top: 516, width: 558, height: 134 };
const icon = { left: 64, top: 452, width: 280, height: 280 };
await sharp(input)
  .extract(dark)
  .resize(676)
  .webp({ quality: 90 })
  .toFile('public/brand/proba-match-logo-dark.webp');
await sharp(input)
  .extract(light)
  .webp({ quality: 90 })
  .toFile('public/brand/proba-match-logo-light.webp');
await sharp(input)
  .extract(dark)
  .resize(1040)
  .png()
  .toFile('public/brand/proba-match-logo-social.png');
await sharp(input)
  .extract(icon)
  .resize(192, 192)
  .png()
  .toFile('public/brand/proba-match-icon-192.png');
await sharp(input)
  .extract(icon)
  .resize(512, 512)
  .png()
  .toFile('public/brand/proba-match-icon-512.png');
await sharp(input).extract(icon).resize(32, 32).png().toFile('src/app/icon.png');
await sharp(input).extract(icon).resize(180, 180).png().toFile('src/app/apple-icon.png');
