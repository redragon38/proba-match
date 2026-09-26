/** Preview builds must never compete with the public production site. */
export function isPreviewDeployment() {
  return (
    ['preview', 'development'].includes(process.env.VERCEL_ENV ?? '') ||
    ['preview', 'staging'].includes(process.env.APP_ENV ?? '')
  );
}
