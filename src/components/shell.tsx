'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  CircleDot,
  Globe2,
  Menu,
  Moon,
  Search,
  Star,
  Sun,
  Trophy,
  X,
  Zap,
  Users,
  Shield,
} from 'lucide-react';
import { QuickSearch } from './quick-search';
import { emitAnalytics } from '@/lib/analytics';
import { usePreference } from '@/lib/preferences';
const navigation = [
  { href: '/', label: 'Accueil', icon: Globe2 },
  { href: '/matchs', label: 'Tous les matchs', icon: CircleDot },
  { href: '/live', label: 'En direct', icon: Activity },
  { href: '/competitions', label: 'Compétitions', icon: Trophy },
  { href: '/classements', label: 'Classements', icon: Trophy },
  { href: '/equipes', label: 'Équipes', icon: Shield },
  { href: '/joueurs', label: 'Joueurs', icon: Users },
  { href: '/comparateur/equipes', label: 'Comparateur', icon: ArrowLeftRight },
  { href: '/favoris', label: 'Mes favoris', icon: Star },
];
export function Shell({
  children,
  year,
  leagues,
  liveCount = 0,
}: {
  children: React.ReactNode;
  year: number;
  leagues: { flag: string; name: string; slug: string }[];
  liveCount?: number;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = usePreference('matchscore-theme', 'dark');
  const [density] = usePreference('matchscore-density', 'comfortable');
  useEffect(() => {
    if (pathname.startsWith('/match/')) emitAnalytics('match_opened');
    else if (pathname.startsWith('/equipe/')) emitAnalytics('team_opened');
    else if (pathname.startsWith('/joueur/')) emitAnalytics('player_opened');
  }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.density = density;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, density]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  function toggleTheme() {
    const value = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = value ? 'dark' : 'light';
    setTheme(value ? 'dark' : 'light');
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Proba Match — Accueil">
          <Image
            className="brand-logo brand-dark"
            src="/brand/proba-match-logo-dark.webp"
            alt="Proba Match"
            width={676}
            height={128}
            unoptimized
            loading="eager"
          />
          <Image
            className="brand-logo brand-light"
            src="/brand/proba-match-logo-light.webp"
            alt="Proba Match"
            width={558}
            height={134}
            unoptimized
            loading="eager"
          />
          <Image
            className="brand-icon"
            src="/brand/proba-match-icon-192.png"
            alt="Proba Match"
            width={48}
            height={48}
            unoptimized
            loading="eager"
          />
        </Link>
        <nav className="top-nav" aria-label="Navigation principale">
          <Link href="/matchs">Matchs</Link>
          <Link href="/competitions">Compétitions</Link>
          <Link href="/methodologie">Analyses & prédictions</Link>
        </nav>
        <div className="header-actions">
          <QuickSearch />
          <button className="icon-button" onClick={toggleTheme} aria-label="Changer le thème">
            <Sun size={19} className="theme-sun" />
            <Moon size={19} className="theme-moon" />
          </button>
          <Link href="/favoris" className="icon-button" aria-label="Mes favoris">
            <Star size={19} />
          </Link>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-controls="site-sidebar"
            aria-expanded={menu}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div className="app-layout">
        {menu && (
          <button
            className="menu-backdrop"
            aria-label="Fermer le menu"
            onClick={() => setMenu(false)}
          />
        )}
        <aside id="site-sidebar" className={`sidebar ${menu ? 'is-open' : ''}`}>
          <div className="sidebar-label">LE TERRAIN DE JEU</div>
          <nav aria-label="Navigation secondaire">
            {navigation.map((item) => (
              <Link
                key={item.href}
                onClick={() => setMenu(false)}
                className={`side-link ${pathname === item.href ? 'active' : ''}`}
                aria-current={pathname === item.href ? 'page' : undefined}
                href={item.href}
              >
                <item.icon size={18} />
                {item.label}
                {item.href === '/live' && liveCount > 0 && (
                  <span className="count-pill">{liveCount}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-label leagues-label">
            À EXPLORER{' '}
            <Link href="/competitions" aria-label="Voir toutes les compétitions">
              +
            </Link>
          </div>
          <nav aria-label="Compétitions">
            {leagues.map(({ flag, name: label, slug }) => (
              <Link
                key={slug}
                className="league-link"
                href={`/competition/${slug}`}
                onClick={() => setMenu(false)}
              >
                <span>{flag}</span>
                {label}
                <ChevronRight size={13} />
              </Link>
            ))}
          </nav>
          <div className="sidebar-label">LE LABORATOIRE</div>
          <Link className="side-link" href="/methodologie" onClick={() => setMenu(false)}>
            <CircleHelp size={18} />
            Notre méthodologie
          </Link>
          <Link className="side-link" href="/parametres" onClick={() => setMenu(false)}>
            <CircleHelp size={18} />
            Paramètres
          </Link>
          <div className="sidebar-promo">
            <Zap size={20} />
            <h3>
              Le football mérite
              <br />
              plus qu’un score.
            </h3>
            <p>
              Des données, du contexte.
              <br />
              Et un peu d’avance.
            </p>
            <Link href="/methodologie" onClick={() => setMenu(false)}>
              Découvrez notre approche <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="sidebar-bottom">Gratuit. Indépendant. Transparent.</div>
        </aside>
        <main id="main">
          {children}
          <footer>
            <span>© {year} Proba Match · Le football, éclairé par les données.</span>
            <nav>
              <Link href="/a-propos">À propos</Link>
              <Link href="/methodologie">Méthodologie</Link>
              <Link href="/confidentialite">Confidentialité</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/mentions-legales">Mentions légales</Link>
              <Link href="/contact">Contact</Link>
            </nav>
            <p>
              Les projections présentées sont des estimations statistiques et ne garantissent aucun
              résultat sportif.
            </p>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom" aria-label="Navigation mobile">
        <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>
          <Globe2 size={20} />
          Accueil
        </Link>
        <Link href="/matchs" aria-current={pathname === '/matchs' ? 'page' : undefined}>
          <CircleDot size={20} />
          Matchs
        </Link>
        <Link href="/live" aria-current={pathname === '/live' ? 'page' : undefined}>
          <Activity size={20} />
          Direct {liveCount > 0 && <span className="mobile-live-count">{liveCount}</span>}
        </Link>
        <Link href="/recherche" aria-current={pathname === '/recherche' ? 'page' : undefined}>
          <Search size={20} />
          Recherche
        </Link>
        <button onClick={() => setMenu(!menu)} aria-expanded={menu}>
          <Menu size={20} />
          Plus
        </button>
      </nav>
    </>
  );
}
