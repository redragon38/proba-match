import { notFound } from 'next/navigation';
const content: Record<string, { title: string; sections: { title: string; text: string }[] }> = {
  confidentialite: {
    title: 'Confidentialité',
    sections: [
      {
        title: 'Vos données, au minimum',
        text: 'La version actuelle ne demande pas de compte visiteur. Les favoris et le thème sont conservés localement dans votre navigateur. Lors de la consultation des favoris, leurs identifiants sont envoyés à l’API du site pour récupérer les informations correspondantes ; aucune liste de favoris liée à un compte n’est enregistrée côté serveur. Le site ne contient aucun outil publicitaire ni mesure d’audience tiers.',
      },
      {
        title: 'Notifications',
        text: 'Les notifications locales nécessitent une autorisation explicite du navigateur. Elles peuvent être désactivées sur la page Favoris ou dans les paramètres du navigateur. Aucune souscription push distante n’est activée dans cette version.',
      },
      {
        title: 'Données techniques',
        text: 'L’hébergeur peut traiter des journaux techniques lors des requêtes. L’exploitant doit préciser son identité, son contact, les durées de conservation et les modalités d’exercice des droits avant ouverture publique. Aucun contact fictif n’est fourni ici.',
      },
      {
        title: 'Effacer les préférences',
        text: 'Supprimez les données du site dans les paramètres de votre navigateur pour effacer les favoris et les préférences. La clé de session administrateur expire après huit heures.',
      },
    ],
  },
  cookies: {
    title: 'Cookies et stockage local',
    sections: [
      {
        title: 'Stockage fonctionnel',
        text: 'matchscore-favorites conserve vos favoris ; matchscore-theme conserve le thème ; matchscore-density conserve la densité d’affichage ; matchscore-notifications conserve votre choix d’activation des alertes. Ces valeurs restent dans votre navigateur.',
      },
      {
        title: 'Administration',
        text: 'Le cookie ms-admin est réservé à l’authentification de l’administration. Il est HttpOnly, SameSite=Strict, sécurisé en production, et expire après huit heures.',
      },
      {
        title: 'Services tiers',
        text: 'Aucun cookie publicitaire ou analytique n’est déposé par le code de cette version. Les emplacements publicitaires sont inactifs. Un dispositif de consentement approprié devra être ajouté avant l’activation de services qui l’exigent.',
      },
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    sections: [
      {
        title: 'État de publication',
        text: 'Cette installation est une version de développement. L’identité de l’éditeur, sa forme juridique éventuelle, son adresse, son contact et le responsable de publication doivent être renseignés par l’exploitant avant ouverture publique.',
      },
      {
        title: 'Hébergement',
        text: 'Vercel est le prestataire retenu pour le futur hébergement de probamatch.com. Les coordonnées légales de l’hébergeur et les informations de publication doivent être complétées et vérifiées lors du déploiement.',
      },
      {
        title: 'Sources et droits',
        text: 'Les calendriers et résultats proviennent d’OpenFootball. API-Football / API-Sports peut enrichir les données selon l’abonnement configuré. La diffusion des données, logos et photos dépend des licences applicables et des droits de l’exploitant. En mode démonstration, les calendriers et statistiques sont fictifs.',
      },
      {
        title: 'Objet du site',
        text: 'Proba Match est une plateforme d’information et d’analyse sportive gratuite. Les projections sont des estimations statistiques, sans garantie de résultat. Aucun service de prise de pari ni transaction financière n’est intégré.',
      },
    ],
  },
};
export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  if (!content[legal]) notFound();
  return {
    title: content[legal]?.title ?? 'Page introuvable',
    robots: { index: false, follow: true },
  };
}
export default async function Page({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  const page = content[legal];
  if (!page) notFound();
  return (
    <article className="page prose">
      <span className="eyebrow">TRANSPARENCE</span>
      <h1>{page.title}</h1>
      {page.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p>{s.text}</p>
        </section>
      ))}
    </article>
  );
}
