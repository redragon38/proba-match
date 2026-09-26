# Sécurité pré-lancement — 20 septembre 2026

Périmètre : authentification administrateur, frontières API/cron, entrées, secrets et headers. Aucun test destructeur ni appel de synchronisation réelle pendant ce sous-audit. Les tests HTTP portent sur localhost ; les tests de routes isolent les services avec des doublures.

| Contrôle | Statut | Preuve / limite |
| --- | --- | --- |
| Autorisation admin / cron | PASS | 13 contrôles HTTP locaux sans échec : cinq cron refusent les requêtes anonymes (401), mutations admin anonymes refusées, CSRF login/logout refusé (403), écran privé non rendu anonymement. |
| Sessions / cookies / CSRF | PASS | Signature HMAC, durée 8 h, secret ≥ 32 caractères, comparaison constante, HttpOnly/Secure/SameSite strict en production. Tests de falsification, expiration, origine et logout. |
| Force brute admin | PASS | Limite atomique PostgreSQL existante de 10 tentatives / 10 minutes ; bucket Vercel par adresse de confiance, bucket global hors Vercel. Échec fermé si DB indisponible, 429 + Retry-After testé. |
| Validation / corps JSON | PASS | Corps admin bornés à 4 096 octets, y compris en streaming sans Content-Length fiable ; schémas Zod stricts, date civile valide, provider et booléens contrôlés avant synchronisation. |
| Secrets locaux / assets navigateur | PASS | 432 fichiers publiables et 29 assets navigateur inspectés ; aucune occurrence des secrets locaux connus ni formats courants de tokens/clés privées. `security-secrets.json`. Seule variable publique trouvée : NEXT_PUBLIC_SITE_URL. |
| Git ignore | PASS | .env, .env.local, .env.production et journaux .local ignorés. .env.example contient des exemples / champs vides, aucun secret réel constaté. |
| XSS / injections / SSRF | PASS | Rendu React, unique injection HTML JSON-LD échappant `<` ; aucune API SQL Unsafe ni exécution de commande dans src. Fournisseurs à hôtes constants, paramètres URL encodés ; images distantes Next limitées à media.api-sports.io. Inspection ciblée, pas preuve exhaustive d'absence de vulnérabilité. |
| CORS / erreurs / logs | PASS | Aucun CORS privé `*` constaté ; erreurs de refus génériques ; logger limité aux codes, compteurs, durées et identifiants de runs, sans credentials. |
| Headers | WARNING | Configuration CSP compatible Next, HSTS conditionnel HTTPS, nosniff, DENY, Referrer/Permissions Policy testés. Vérification HTTP des nouveaux headers à effectuer sur le build final avec `node scripts/verify-security.mjs`. |
| Dépendances | PASS | Audit npm effectué par l'agent principal : 0 vulnérabilité signalée sur 565 dépendances. |
| Défense contre abus publics | WARNING | Recherche bornée et endpoints de lecture limités/cache existant ; pas de protection WAF/distribuée anti-abus public vérifiée. Les visiteurs ne peuvent pas déclencher les endpoints admin/cron. |
| Production distante / historique distant | NON TESTÉ | Secrets Vercel, certificat, headers réellement déployés, WAF et ancien historique Git distant non vérifiés par ce sous-audit. NON VÉRIFIÉ EXTERNEMENT. |

## Corrections

- `src/lib/auth.ts` : refuse les suffixes ajoutés à une session signée, l'expiration exacte et les origines absentes/opaques ; configuration d'origine invalide refusée sans exception.
- `src/lib/request-body.ts`, routes `api/admin/{session,mapping,sync}` : lecture JSON bornée et validée ; réponses 400/413/415 adaptées ; paramètres invalides ne déclenchent aucun fournisseur.
- `next.config.ts` : CSP de base (`object-src`, `base-uri`, `form-action`, `frame-ancestors`) ; HSTS 1 an uniquement pour une origine HTTPS en production ; noindex global en preview ; redirection permanente limitée à www.probamatch.com vers https://probamatch.com, conformément au domaine confirmé.
- Tests `auth`, `request-body`, `api-security`, `security-headers` et script HTTP reproductible `scripts/verify-security.mjs`. Ce dernier couvre également le nouveau health protégé sur le build final.

## Priorités restantes

- **P0 : aucun identifié dans le périmètre local testé.** Cela ne certifie pas le déploiement distant.
- **P1 avant lancement :** relancer le script HTTP sur le build final, puis vérifier les véritables variables secrètes et headers sur Vercel. Ne pas publier des secrets depuis un autre environnement non inspecté.
- **P2 :** vérifier/configurer la protection anti-abus de l'hébergeur ; une CSP de scripts à nonce/hash serait un durcissement complémentaire nécessitant des tests SSR/ISR spécifiques. La CSP ajoutée ne prétend pas bloquer tous les XSS. La session administrateur reste stateless : logout efface le cookie, une copie volée reste valide jusqu'à expiration ou rotation de ADMIN_SECRET.

## Tests exécutés

- 16/16 tests ciblés auth/corps/routes ; 4/4 tests headers/preview/redirect : PASS.
- 13/13 probes HTTP sur le build local précédent : PASS (`security-http-baseline.json`). Le nouveau script sans `--baseline` contrôle aussi la CSP et /api/health.
- Lint ciblé : PASS. Typecheck global et contrôle après build consolidés par l'agent principal.
- Le premier lancement Vitest a rencontré `spawn EPERM` dans la sandbox ; relance autorisée hors sandbox : PASS. Aucun résultat de test n'a été déduit de cette première erreur.

## Complément final — 21 septembre 2026

Les tests HTTP du nouveau build sont terminés : 14/14 PASS. Connexion administrateur réelle, vue authentifiée, cookie HttpOnly/Secure/SameSite Strict, déconnexion et retour au formulaire anonyme PASS (`prelaunch-admin-session.json`). Les 11 probes d’entrées et redirection sont PASS (`prelaunch-inputs.json`). Scan final actualisé : 449 fichiers publiables et 29 assets, aucun secret détecté ; aucun secret configuré dans les 27 JS du build final. Les vérifications de production restent NON TESTÉ. Le rapport `PRELAUNCH-AUDIT.md` consolide le verdict.
