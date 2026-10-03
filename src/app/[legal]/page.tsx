import { notFound } from 'next/navigation';
import { legalConfig } from '@/lib/legal';
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
        text: 'L’hébergeur peut traiter des journaux techniques lors des requêtes. Les coordonnées de l’éditeur et la politique de conservation disponibles figurent dans les mentions légales. Une information absente n’est pas remplacée par une identité ou une durée fictive.',
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
        text: 'Les informations de publication effectivement fournies par l’éditeur sont présentées ci-dessous. Les champs manquants sont signalés explicitement ; ils nécessitent une validation par l’exploitant.',
      },
      {
        title: 'Hébergement',
        text: 'Les coordonnées de l’hébergeur figurent ci-dessous lorsqu’elles ont été vérifiées et fournies par l’exploitant.',
      },
      {
        title: 'Sources et droits',
        text: 'Les calendriers et résultats proviennent d’OpenFootball et d’ESPN. ESPN et TheSportsDB fournissent des profils et effectifs ; API-Football / API-Sports peut enrichir les données selon l’abonnement configuré. La diffusion des données, logos et photos dépend des licences applicables et des droits de l’exploitant. Les crédits disponibles sont affichés sur les profils. Les données de démonstration sont réservées au développement et aux tests isolés.',
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
  const config = legalConfig();
  const fields = [
    ['Éditeur', config.editor],
    ['Responsable de publication', config.director],
    ['Adresse de l’éditeur', config.address],
    ['Contact', config.contact],
    ['Immatriculation / forme juridique, si applicable', config.registration],
    ['Hébergeur', config.host],
    ['Adresse de l’hébergeur', config.hostAddress],
    ['Conservation des journaux techniques et exercice des droits', config.retention],
  ];
  const metricsEnabled = process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED === 'true';
  return (
    <article className="page prose">
      <span className="eyebrow">TRANSPARENCE</span>
      <h1>{page.title}</h1>
      {legal === 'confidentialite' && metricsEnabled && (
        <section>
          <h2>Mesures de performance</h2>
          <p>
            Les mesures techniques LCP, INP, CLS, FCP et TTFB sont envoyées à l’API du site et
            inscrites dans les journaux de l’hébergeur. Aucun identifiant visiteur, URL, recherche
            ou cookie de suivi n’est envoyé par ce dispositif. La politique de conservation figure
            dans les mentions légales lorsqu’elle est fournie.
          </p>
        </section>
      )}
      {legal === 'mentions-legales' && (
        <dl>
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? 'Information non fournie par l’éditeur'}</dd>
            </div>
          ))}
        </dl>
      )}
      {page.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p>{s.text}</p>
        </section>
      ))}
    </article>
  );
}
