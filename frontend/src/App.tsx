import { Link, NavLink, Outlet, Route, Routes, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost, apiPut } from './lib/api'

type LoginResponse        = { needs2fa: boolean; pendingToken: string; email: string; devCode?: string }
type TokenResponse        = { accessToken: string }
type RegisterResponse     = { userId: number; email: string; role: string }
type PreRegisterResponse  = { pendingToken: string }
type PendingData          = { token: string; email: string; devCode?: string }

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function decodeJwt(token: string): { email?: string; role?: string; sub?: string } | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('vernet_access_token'),
  )
  return useMemo(() => {
    const c = accessToken ? decodeJwt(accessToken) : null
    return {
      accessToken,
      role:   c?.role   ?? null,
      email:  c?.email  ?? null,
      userId: c?.sub    ? Number(c.sub) : null,
      setAccessToken: (t: string | null) => {
        setAccessToken(t)
        if (t) localStorage.setItem('vernet_access_token', t)
        else   localStorage.removeItem('vernet_access_token')
      },
    }
  }, [accessToken])
}
type AuthCtx = ReturnType<typeof useAuth>

// ─── Sidebar nav items ────────────────────────────────────────────────────────

type NavItem = { icon: string; title: string; link: string }

const SIDEBAR_CLIENT: NavItem[] = [
  { icon: '', title: 'Tableau de bord',   link: '/dashboard' },
  { icon: '', title: 'Mon dossier',        link: '/mon-dossier' },
  { icon: '', title: 'Suivi poids / IMC',  link: '/suivi-poids' },
  { icon: '', title: 'Messagerie',          link: '/messagerie' },
  { icon: '', title: 'Notifications',       link: '/notifications' },
  { icon: '', title: 'Rendez-vous',         link: '/planning' },
  { icon: '', title: 'Mon programme',        link: '/mon-programme' },
  { icon: '', title: 'Catalogue',           link: '/catalogue' },
  { icon: '', title: 'Mon profil',          link: '/profil' },
]
const SIDEBAR_STAFF: NavItem[] = [
  { icon: '', title: 'Tableau de bord',  link: '/dashboard' },
  { icon: '', title: 'Mes clients',      link: '/mes-clients' },
  { icon: '', title: 'Suivi clients',    link: '/suivi-clients' },
  { icon: '', title: 'Messagerie',       link: '/messagerie' },
  { icon: '', title: 'Notifications',    link: '/notifications' },
  { icon: '', title: 'Planning',         link: '/planning' },
  { icon: '', title: 'Catalogue',        link: '/catalogue' },
  { icon: '', title: 'Rapports',         link: '/rapports' },
  { icon: '', title: 'Mon profil',       link: '/profil' },
]
const SIDEBAR_ADMIN: NavItem[] = [
  ...SIDEBAR_STAFF,
  { icon: '', title: 'Utilisateurs',    link: '/utilisateurs' },
  { icon: '', title: 'Journal',         link: '/journal' },
  { icon: '', title: 'Centre',          link: '/centre' },
]
const SIDEBAR_ADMIN_REGULAR: NavItem[] = [
  ...SIDEBAR_STAFF,
  { icon: '', title: 'Centre', link: '/centre' },
]

// ─── Role helpers ─────────────────────────────────────────────────────────────

function roleLabel(role: string | null) {
  const m: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin',
    SECRETARY: 'Secrétaire', COACH: 'Coach',
    NUTRITIONIST: 'Nutritionniste', CLIENT: 'Client',
  }
  return role ? (m[role] ?? role) : 'Invité'
}
function roleBadgeClass(role: string | null) {
  if (role === 'SUPER_ADMIN')   return 'role-badge super-admin'
  if (role === 'ADMIN')         return 'role-badge admin'
  if (role === 'COACH')         return 'role-badge coach'
  if (role === 'NUTRITIONIST')  return 'role-badge nutritionist'
  if (role === 'SECRETARY')     return 'role-badge secretary'
  return 'role-badge client'
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ auth }: { auth: AuthCtx }) {
  return (
    <header className="app-header">
      <Link to={auth.accessToken ? '/dashboard' : '/'} className="brand">
        <div className="brand-logos" aria-hidden="true">
          <img className="brand-logo" src="/media/logos/logo-centre-du-vernet-1.jpeg" alt="" />
          <img className="brand-logo" src="/media/logos/logo-amincissement-centre-du-vernet-methode-laurand.jpg" alt="" />
        </div>
        <div>
          <div className="brand-title">Centre du Vernet</div>
          <div className="brand-sub">Agree Méthode Laurand — Douala</div>
        </div>
      </Link>

      <nav className="nav">
        {auth.accessToken ? (
          /* ── Nav connecté ── */
          <>
            <Link to="/dashboard">Tableau de bord</Link>
            <Link to="/messagerie">Messagerie</Link>
            <Link to="/notifications">Notifications</Link>
            <Link to="/catalogue">Catalogue</Link>
            <span className={roleBadgeClass(auth.role)}>{roleLabel(auth.role)}</span>
          </>
        ) : (
          /* ── Nav public ── */
          <>
            <Link to="/">Accueil</Link>
            <Link to="/vitrine">Vitrine</Link>
            <Link to="/login">Connexion</Link>
            <Link to="/register" className="btn primary btn-sm">S'inscrire</Link>
          </>
        )}
      </nav>
    </header>
  )
}

// ─── Formatage date/heure ────────────────────────────────────────────────────

function fmtAppt(dt: string | null | undefined) {
  if (!dt) return ''
  const [date, time] = dt.split('T')
  if (!time) return date
  const [h, m] = time.split(':')
  return `${date} à ${h}H${m}`
}

// ─── Back button ─────────────────────────────────────────────────────────────

function BackBtn() {
  const nav = useNavigate()
  return (
    <button type="button" className="btn btn-sm back-btn" onClick={() => nav(-1)}>
      ← Retour
    </button>
  )
}

// ─── Auth layout (sidebar) ───────────────────────────────────────────────────

function AuthLayout({ auth }: { auth: AuthCtx }) {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen]     = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!auth.accessToken) nav('/login', { replace: true })
  }, [auth.accessToken])

  function fetchUnread() {
    if (!auth.accessToken) return
    apiGet<any>('/api/notifications/unread-count', auth.accessToken)
      .then(r => setUnreadCount(r.unread ?? 0))
      .catch(() => {})
  }

  // Polling notifications toutes les 30 secondes
  useEffect(() => {
    if (!auth.accessToken) return
    fetchUnread()
    const id = setInterval(fetchUnread, 30000)
    return () => clearInterval(id)
  }, [auth.accessToken])

  if (!auth.accessToken) return null

  const navItems = auth.role === 'CLIENT'     ? SIDEBAR_CLIENT
    : auth.role === 'SUPER_ADMIN'             ? SIDEBAR_ADMIN
    : auth.role === 'ADMIN'                   ? SIDEBAR_ADMIN_REGULAR
    : SIDEBAR_STAFF

  return (
    <div className={`app-shell${menuOpen ? ' nav-open' : ''}`}>
      {/* Overlay mobile */}
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className="app-sidebar">
        <Link to="/dashboard" className="sidebar-brand" onClick={() => setMenuOpen(false)}>
          <div className="sidebar-logos">
            <img className="sidebar-logo" src="/media/logos/logo-centre-du-vernet-1.jpeg" alt="" />
            <img className="sidebar-logo" src="/media/logos/logo-amincissement-centre-du-vernet-methode-laurand.jpg" alt="" />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">Centre du Vernet</div>
            <div className="sidebar-brand-sub">Méthode Laurand</div>
          </div>
        </Link>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.link}
              to={item.link}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.title}</span>
              {item.link === '/notifications' && unreadCount > 0 && (
                <span className="sidebar-notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-email" title={auth.email ?? ''}>{auth.email}</div>
          <span className={roleBadgeClass(auth.role)}>{roleLabel(auth.role)}</span>
          <button className="btn btn-sm sidebar-logout" onClick={() => auth.setAccessToken(null)}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="app-main">
        {/* Barre mobile */}
        <div className="mobile-topbar">
          <button className="hamburger-btn" onClick={() => setMenuOpen(v => !v)}>☰</button>
          <div className="mobile-brand">Centre du Vernet</div>
          <span className={roleBadgeClass(auth.role)} style={{ fontSize: 11 }}>{roleLabel(auth.role)}</span>
        </div>
        <Outlet context={{ refreshUnread: fetchUnread }} />
      </div>
    </div>
  )
}

// ─── Landing page (vitrine publique) ─────────────────────────────────────────

const IMG_V = `?v=${Date.now()}`

const HERO_SLIDES = [
  '/media/backgrounds/slim-girl-big-jeans.png',
  '/media/salles/salle-de-fitness-1.png',
  "/media/salles/salle-d'aquagym.png",
  '/media/backgrounds/salon-travail-mobilite-amincissement-laurand.jpg',
  '/media/salles/salle-de-consultation.png',
  '/media/salles/salle-de-massage-hammam-1.png',
  '/media/salles/salle-du-spa-jet.png',
  "/media/salles/salle-d'electrostimulation-et-ultrasons-1.jpeg",
].map(s => s + IMG_V)

const GALLERY_ROOMS = [
  { name: "Salle d'accueil",                     file: "salle-d'acceuil.png" },
  { name: 'Salle de consultation',               file: 'salle-de-consultation.png' },
  { name: 'Salle de fitness',                    file: 'salle-de-fitness-1.png' },
  { name: 'Aquagym',                             file: "salle-d'aquagym.png" },
  { name: 'Électrostimulation & ultrasons',      file: "salle-d'electrostimulation-et-ultrasons-1.jpeg" },
  { name: 'Massage & Hammam',                    file: 'salle-de-massage-hammam-1.png' },
  { name: 'Spa Jet',                             file: 'salle-du-spa-jet.png' },
  { name: 'Perfect Body',                        file: 'salle-du-perfect-body.png' },
  { name: 'Cryolipolyse & Pressothérapie',       file: 'salle-de-cryolipolyse-et-pressotherapie(sonare-japonais).png' },
  { name: 'Jacuzzi',                             file: 'jaccuzi.png' },
  { name: 'Salle de restauration',               file: 'salle-de-restauration.png' },
  { name: 'Sièges de relaxation',                file: 'sieges-de-relaxation.png' },
]

const SERVICES = [
  { title: 'Aquagym',                         desc: 'Séances en piscine adaptées pour muscler sans impact articulaire.' },
  { title: 'Électrostimulation & Ultrasons',  desc: 'Technologies de pointe pour affiner et raffermir en profondeur.' },
  { title: 'Massage & Hammam',                desc: 'Soins drainants et relaxants pour éliminer toxines et stress.' },
  { title: 'Fitness guidé',                   desc: 'Programmes cardio personnalisés encadrés par nos coachs.' },
  { title: 'Spa Jet & Perfect Body',          desc: 'Hydromassage ciblé pour sculpter et tonifier la silhouette.' },
  { title: 'Consultation diététique',         desc: 'Rééquilibrage alimentaire progressif avec notre nutritionniste.' },
  { title: 'Cryolipolyse & Pressothérapie',  desc: 'Technologie Sonarê Japonais pour éliminer les graisses localisées sans chirurgie.' },
  { title: 'Jacuzzi & Relaxation',            desc: 'Balnéothérapie et sièges de relaxation pour une récupération optimale.' },
]

function LandingPage() {
  const [slide, setSlide]             = useState(0)
  const [galleryPreview, setGalleryPreview] = useState<{ file: string; name: string } | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!galleryPreview) return
      const idx = GALLERY_ROOMS.findIndex(r => r.file === galleryPreview.file)
      if (e.key === 'Escape') setGalleryPreview(null)
      if (e.key === 'ArrowRight' && idx < GALLERY_ROOMS.length - 1) setGalleryPreview(GALLERY_ROOMS[idx + 1])
      if (e.key === 'ArrowLeft'  && idx > 0)                        setGalleryPreview(GALLERY_ROOMS[idx - 1])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [galleryPreview])

  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="landing">

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <header className="pub-header">
        <div className="pub-header-inner">
          <Link to="/" className="brand">
            <div className="brand-logos">
              <img className="brand-logo" src="/media/logos/logo-centre-du-vernet-1.jpeg" alt="Centre du Vernet" />
              <img className="brand-logo" src="/media/logos/logo-amincissement-centre-du-vernet-methode-laurand.jpg" alt="Méthode Laurand" />
            </div>
            <div>
              <div className="brand-title">Centre du Vernet</div>
              <div className="brand-sub">Agréé Méthode Laurand — Douala</div>
            </div>
          </Link>
          <nav className="pub-nav">
            <a href="#services">Services</a>
            <a href="#methode">Méthode</a>
            <a href="#galerie">Espaces</a>
            <a href="#contact">Contact</a>
            <Link to="/login" className="btn btn-sm">Connexion</Link>
            <Link to="/register" className="btn btn-sm primary">S'inscrire</Link>
          </nav>
        </div>
      </header>

      {/* ══ HERO SLIDESHOW ══════════════════════════════════════ */}
      <section className="pub-hero">
        {/* Slides en fondu enchaîné */}
        {HERO_SLIDES.map((src, i) => (
          <div key={src} className={`pub-hero-slide${i === slide ? ' active' : ''}`}
            style={{ backgroundImage: `url('${src}')` }} />
        ))}
        <div className="pub-hero-overlay">
          <div className="pub-hero-content">
            <span className="pub-hero-badge">Agréé Méthode Laurand</span>
            <h1>Retrouvez votre silhouette idéale</h1>
            <p>Suivi personnalisé d'amaigrissement au Centre du Vernet. Coaching, nutrition et soins bien-être pour un résultat durable.</p>
            <div className="pub-hero-actions">
              <Link to="/register" className="btn pub-btn-primary">Créer mon espace santé</Link>
              <a href="#services" className="btn pub-btn-secondary">Découvrir nos services</a>
            </div>
            <div className="pub-hero-meta">
              <span>Douala, Bonapriso</span>
              <span>Lun–Ven 07:00–17:00</span>
              <span>Suivi individuel</span>
            </div>
            {/* Points de navigation */}
            <div className="pub-hero-dots">
              {HERO_SLIDES.map((_, i) => (
                <button key={i}
                  className={`pub-hero-dot${i === slide ? ' active' : ''}`}
                  onClick={() => setSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ═══════════════════════════════════════════ */}
      <div className="pub-stats-bar">
        <div className="pub-container pub-stats-grid">
          <div className="pub-stat"><div className="pub-stat-n">40+</div><div className="pub-stat-l">Ans d'expertise</div></div>
          <div className="pub-stat"><div className="pub-stat-n">6</div><div className="pub-stat-l">Services spécialisés</div></div>
          <div className="pub-stat"><div className="pub-stat-n">100%</div><div className="pub-stat-l">Suivi personnalisé</div></div>
          <div className="pub-stat"><div className="pub-stat-n">Agréé</div><div className="pub-stat-l">Méthode Laurand</div></div>
        </div>
      </div>

      {/* ══ SERVICES ════════════════════════════════════════════ */}
      <section id="services" className="pub-section">
        <div className="pub-container">
          <div className="pub-section-head">
            <span className="pub-label">Ce que nous offrons</span>
            <h2>Nos services</h2>
            <p>Un accompagnement complet pour un amaigrissement durable et sain</p>
          </div>
          <div className="pub-services-grid">
            {SERVICES.map(s => (
              <div key={s.title} className="pub-service-card">
                <div className="pub-service-title">{s.title}</div>
                <div className="pub-service-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MÉTHODE LAURAND ══════════════════════════════════════ */}
      <section id="methode" className="pub-section pub-section-alt">
        <div className="pub-container pub-split">
          <div className="pub-split-text">
            <span className="pub-label">Notre approche</span>
            <h2>La Méthode Laurand</h2>
            <p>Forte de plus de 40 ans d'expertise, la Méthode Laurand propose une solution minceur efficace et durable dans le plus strict respect de votre capital santé.</p>
            <ul className="pub-list">
              <li>Rééquilibrage alimentaire progressif</li>
              <li>Soins corporels ciblés et adaptés</li>
              <li>Accompagnement personnalisé au quotidien</li>
              <li>Suivi régulier pour pérenniser les résultats</li>
            </ul>
            <Link to="/register" className="btn primary" style={{ marginTop: 24, display: 'inline-block' }}>
              Commencer mon suivi →
            </Link>
          </div>
          <div className="pub-split-img" style={{ backgroundImage: "url('/media/salles/salle-de-consultation.png')" }} />
        </div>
      </section>

      {/* ══ GALERIE ══════════════════════════════════════════════ */}

      {/* Lightbox galerie */}
      {galleryPreview && (() => {
        const idx = GALLERY_ROOMS.findIndex(r => r.file === galleryPreview.file)
        const prev = idx > 0 ? GALLERY_ROOMS[idx - 1] : null
        const next = idx < GALLERY_ROOMS.length - 1 ? GALLERY_ROOMS[idx + 1] : null
        return (
          <div className="lightbox-overlay" onClick={() => setGalleryPreview(null)}>
            <div className="lightbox-content gallery-lightbox" onClick={e => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setGalleryPreview(null)}>✕</button>
              <div className="lightbox-filename">{galleryPreview.name}</div>
              <img
                src={`/media/salles/${galleryPreview.file.replace(/"/g, '%22')}`}
                alt={galleryPreview.name}
                className="lightbox-img"
              />
              {/* Navigation précédent / suivant */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <button className="btn btn-sm" disabled={!prev}
                  onClick={() => prev && setGalleryPreview(prev)}>
                  Précédent
                </button>
                <span className="muted" style={{ fontSize: 13 }}>
                  {idx + 1} / {GALLERY_ROOMS.length}
                </span>
                <button className="btn btn-sm" disabled={!next}
                  onClick={() => next && setGalleryPreview(next)}>
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <section id="galerie" className="pub-section">
        <div className="pub-container">
          <div className="pub-section-head">
            <span className="pub-label">Nos installations</span>
            <h2>Nos espaces</h2>
            <p>Cliquez sur une photo pour l'agrandir</p>
          </div>
          <div className="pub-gallery">
            {GALLERY_ROOMS.map(r => (
              <div key={r.file} className="pub-gallery-item pub-gallery-item-clickable"
                style={{ backgroundImage: `url("/media/salles/${r.file.replace(/"/g, '%22')}")` }}
                onClick={() => setGalleryPreview(r)}>
                <div className="pub-gallery-label">{r.name}</div>
                <div className="pub-gallery-zoom">Voir en grand</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══════════════════════════════════════════════ */}
      <section id="contact" className="pub-section pub-section-alt">
        <div className="pub-container">
          <div className="pub-section-head">
            <span className="pub-label">Venez nous voir</span>
            <h2>Nous trouver</h2>
            <p>Prenez rendez-vous ou passez directement nous rendre visite</p>
          </div>
          <div className="pub-contact-grid">
            <div className="pub-contact-card">
              <div className="pub-contact-title">Adresse</div>
              <p>Cameroun, Douala<br />Bonapriso, Rue 1.042<br />Villa 162</p>
            </div>
            <div className="pub-contact-card">
              <div className="pub-contact-title">Horaires d'ouverture</div>
              <p><strong>Lundi – Vendredi</strong><br />07:00 – 17:00</p>
              <p style={{ marginTop: 10 }}><strong>Samedi</strong><br />08:00 – 14:00</p>
            </div>
            <div className="pub-contact-card pub-contact-cta">
              <div className="pub-contact-title">Espace client</div>
              <p>Créez votre compte pour accéder à votre suivi personnalisé, communiquer avec votre coach et consulter vos rapports.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <Link to="/register" className="btn primary">Créer un compte</Link>
                <Link to="/login" className="btn">Se connecter</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════ */}
      <footer className="pub-footer">
        <div className="pub-container">
          <div className="pub-footer-grid">
            <div className="pub-footer-col">
              <div className="pub-footer-brand">Centre du Vernet</div>
              <p>Agréé Méthode Laurand — Suivi d'amaigrissement personnalisé à Douala, Cameroun.</p>
            </div>
            <div className="pub-footer-col">
              <div className="pub-footer-title">Adresse</div>
              <p>Douala, Cameroun<br />Bonapriso, Rue 1.042<br />Villa 162</p>
            </div>
            <div className="pub-footer-col">
              <div className="pub-footer-title">Horaires</div>
              <p>Lun – Ven : 07:00 – 17:00<br />Samedi : 08:00 – 14:00<br />Dimanche : Fermé</p>
            </div>
            <div className="pub-footer-col">
              <div className="pub-footer-title">Navigation</div>
              <div className="pub-footer-links">
                <a href="#services">Nos services</a>
                <a href="#methode">Méthode Laurand</a>
                <a href="#galerie">Nos espaces</a>
                <a href="#contact">Contact</a>
                <Link to="/login">Connexion</Link>
                <Link to="/register">S'inscrire</Link>
              </div>
            </div>
          </div>
          <div className="pub-footer-bottom">
            © 2026 Centre du Vernet · Agréé Méthode Laurand · Douala, Cameroun
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Register ─────────────────────────────────────────────────────────────────

const REGISTER_ERRORS: Record<string, string> = {
  EMAIL_ALREADY_EXISTS:      'Cet email est déjà utilisé.',
  INVALID_EMAIL_DOMAIN:      'Ce domaine email n\'existe pas. Vérifiez l\'adresse saisie.',
  PHONE_REQUIRED:            'Veuillez entrer votre numéro WhatsApp.',
  SEND_FAILED:               'Impossible d\'envoyer le code. Vérifiez votre adresse / numéro.',
  INVALID_CODE:              'Code incorrect. Vérifiez et réessayez.',
  CODE_EXPIRED:              'Code expiré. Recommencez l\'inscription.',
  INVALID_OR_EXPIRED_TOKEN:  'Session expirée. Recommencez l\'inscription.',
}

function Register() {
  // Champs du formulaire
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [gender, setGender]       = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [channel, setChannel]     = useState<'EMAIL' | 'WHATSAPP'>('EMAIL')
  const [phone, setPhone]         = useState('')

  // Étapes
  const [step, setStep]           = useState<'form' | 'verify' | 'done'>('form')
  const [pendingToken, setPendingToken] = useState('')
  const [devCode, setDevCode]     = useState<string | null>(null)
  const [sentAt, setSentAt]       = useState<string | null>(null)
  const [code, setCode]           = useState('')

  const [showPwd, setShowPwd]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)

  const photoUrl = "url('/media/salles/salle-de-consultation.png')"

  // ── Étape finale : succès ──────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <main className="auth-page">
        <div className="auth-photo-side" style={{ backgroundImage: photoUrl }} />
        <div className="auth-form-side">
          <div className="auth-card panel">
            <div className="totp-success-icon">✓</div>
            <h1>Compte créé !</h1>
            <p className="muted">
              Bienvenue <strong>{firstName} {lastName}</strong> !<br />Votre espace santé est prêt.
            </p>
            <p className="muted" style={{ marginTop: 8 }}>
              À chaque connexion, un <strong>code à 6 chiffres</strong> sera envoyé
              à votre email pour sécuriser votre accès.
            </p>
            <Link className="btn primary" to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
              Se connecter →
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // ── Étape 2 : saisie du code ───────────────────────────────────────────────
  if (step === 'verify') {
    const channelLabel = channel === 'WHATSAPP'
      ? `WhatsApp (${phone})`
      : email
    return (
      <main className="auth-page">
        <div className="auth-photo-side" style={{ backgroundImage: photoUrl }} />
        <div className="auth-form-side">
          <div className="auth-card panel">
            <h1>Vérification</h1>
            <p className="muted">
              Un code à 6 chiffres a été envoyé à<br />
              <strong>{channelLabel}</strong>
              {sentAt && <span style={{ color: 'var(--muted)', fontSize: 12 }}> · envoyé à {sentAt}</span>}
            </p>
            {devCode && (
              <div className="dev-code-box">
                <span className="dev-code-label">Mode développement</span>
                <span className="dev-code-value">{devCode}</span>
                <span className="dev-code-hint">En production, ce code arriverait uniquement par email</span>
              </div>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              ⚠️ Si vous avez plusieurs emails, utilisez le <strong>plus récent</strong>.
            </p>
            <div className="form" style={{ marginTop: 16 }}>
              <label>Code reçu
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456" maxLength={6}
                  style={{ textAlign: 'center', fontSize: 28, letterSpacing: 10, fontWeight: 700 }}
                  onKeyDown={e => { if (e.key === 'Enter') document.getElementById('btn-verify-reg')?.click() }}
                  autoFocus
                />
              </label>
              {error && <div className="error">{error}</div>}
              <button id="btn-verify-reg" className="btn primary" disabled={loading || code.length !== 6}
                onClick={async () => {
                  setError(null); setLoading(true)
                  try {
                    await apiPost<RegisterResponse>('/api/auth/register', { pendingToken, code })
                    setStep('done')
                  } catch (e: any) {
                    setError(REGISTER_ERRORS[e?.error] ?? e?.error ?? 'Code invalide')
                    if (e?.error === 'CODE_EXPIRED' || e?.error === 'INVALID_OR_EXPIRED_TOKEN') {
                      setStep('form'); setCode('')
                    }
                  } finally { setLoading(false) }
                }}>
                {loading ? 'Vérification…' : 'Confirmer et créer mon compte'}
              </button>

              {/* Renvoyer */}
              <button className="btn" disabled={loading}
                style={{ marginTop: 4 }}
                onClick={async () => {
                  setError(null); setLoading(true); setCode('')
                  try {
                    const res = await apiPost<PreRegisterResponse>('/api/auth/pre-register', {
                      firstName: firstName.trim(), lastName: lastName.trim(),
                      gender, email, password, channel,
                      phone: channel === 'WHATSAPP' ? phone.trim() : undefined,
                    })
                    setPendingToken(res.pendingToken)
                    setDevCode(res.devCode ?? null)
                    setSentAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
                  } catch (e: any) {
                    setError(REGISTER_ERRORS[e?.error] ?? 'Erreur d\'envoi')
                  } finally { setLoading(false) }
                }}>
                {loading ? 'Envoi…' : '↩ Renvoyer le code'}
              </button>

              <p className="auth-switch" style={{ marginTop: 8 }}>
                <button className="link-btn" onClick={() => { setStep('form'); setCode(''); setError(null) }}>
                  ← Modifier mes informations
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Étape 1 : formulaire ───────────────────────────────────────────────────
  const canSubmit = firstName.trim() && lastName.trim() && gender && email && password &&
    (channel === 'EMAIL' || (channel === 'WHATSAPP' && phone.trim()))

  return (
    <main className="auth-page">
      <div className="auth-photo-side" style={{ backgroundImage: photoUrl }} />
      <div className="auth-form-side">
        <div className="auth-card panel">
          <h1>Créer un compte</h1>
          <p className="muted">Rejoignez le Centre du Vernet et accédez à votre espace santé personnalisé.</p>
          <div className="form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Prénom
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Marie" />
              </label>
              <label>Nom
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" />
              </label>
            </div>
            <label>Sexe
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">— Sélectionner —</option>
                <option value="F">Femme</option>
                <option value="M">Homme</option>
              </select>
            </label>
            <label>Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marie.dupont@exemple.com" />
            </label>
            <label>Mot de passe
              <div className="pwd-wrap">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>

            {/* Canal de vérification */}
            <div className="reg-channel-group">
              <div className="reg-channel-label">Recevoir le code de vérification par :</div>
              <div className="reg-channel-options">
                <label className={`reg-channel-opt${channel === 'EMAIL' ? ' selected' : ''}`}>
                  <input type="radio" name="channel" value="EMAIL"
                    checked={channel === 'EMAIL'} onChange={() => setChannel('EMAIL')} />
                  <span>📧 Email</span>
                </label>
                <label className={`reg-channel-opt${channel === 'WHATSAPP' ? ' selected' : ''}`}>
                  <input type="radio" name="channel" value="WHATSAPP"
                    checked={channel === 'WHATSAPP'} onChange={() => setChannel('WHATSAPP')} />
                  <span>💬 WhatsApp</span>
                </label>
              </div>
              {channel === 'WHATSAPP' && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Étape 1 : rejoindre le sandbox en 1 clic */}
                  <div className="reg-wa-step">
                    <div className="reg-wa-step-num">1</div>
                    <div style={{ flex: 1 }}>
                      <div className="reg-wa-step-title">Activer WhatsApp (une seule fois)</div>
                      <div className="reg-wa-step-desc">Cliquez sur le bouton ci-dessous — WhatsApp s'ouvre avec le message prêt à envoyer.</div>
                      <a
                        className="btn reg-wa-join-btn"
                        href="https://wa.me/14155238886?text=join%20body-happy"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        💬 Ouvrir WhatsApp et activer
                      </a>
                    </div>
                  </div>
                  {/* Étape 2 : entrer son numéro */}
                  <div className="reg-wa-step">
                    <div className="reg-wa-step-num">2</div>
                    <div style={{ flex: 1 }}>
                      <div className="reg-wa-step-title">Entrez votre numéro WhatsApp</div>
                      <label style={{ marginTop: 6, display: 'block' }}>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                          placeholder="+237600000000" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && <div className="error">{error}</div>}
            <button className="btn primary" disabled={loading || !canSubmit}
              onClick={async () => {
                setError(null); setLoading(true)
                try {
                  const res = await apiPost<PreRegisterResponse>('/api/auth/pre-register', {
                    firstName: firstName.trim(), lastName: lastName.trim(),
                    gender, email, password, channel,
                    phone: channel === 'WHATSAPP' ? phone.trim() : undefined,
                  })
                  setPendingToken(res.pendingToken)
                  setDevCode(res.devCode ?? null)
                  setSentAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
                  setStep('verify')
                } catch (e: any) {
                  setError(REGISTER_ERRORS[e?.error] ?? e?.error ?? "Erreur lors de l'envoi du code")
                } finally { setLoading(false) }
              }}>
              {loading ? 'Envoi du code…' : 'Envoyer le code de vérification'}
            </button>
            <p className="auth-switch">Déjà un compte ? <Link to="/login">Se connecter</Link></p>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Setup Super Admin (première fois uniquement) ────────────────────────────

function SetupAdmin() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [gender, setGender]       = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [done, setDone]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const nav = useNavigate()

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-photo-side" style={{ backgroundImage: "url('/media/salles/salle-de-consultation.png')" }} />
        <div className="auth-form-side">
          <div className="auth-card panel">
            <div className="totp-success-icon">✓</div>
            <h1>Super Admin créé !</h1>
            <p className="muted">
              Compte <strong>{email}</strong> créé avec le rôle Super Admin.<br />
              Cet accès de configuration est maintenant <strong>définitivement fermé</strong>.
            </p>
            <button className="btn primary" style={{ marginTop: 16, width: '100%' }}
              onClick={() => nav('/login')}>
              Se connecter →
            </button>
          </div>
        </div>
      </main>
    )
  }

  const canSubmit = firstName.trim() && lastName.trim() && gender && email && password

  return (
    <main className="auth-page">
      <div className="auth-photo-side" style={{ backgroundImage: "url('/media/salles/salle-de-fitness.jpeg')" }} />
      <div className="auth-form-side">
        <div className="auth-card panel">
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ margin: 0 }}>Configuration initiale</h1>
          </div>
          <p className="muted">
            Créez le compte <strong>Super Administrateur</strong> du Centre du Vernet.<br />
            <span style={{ color: 'var(--bad)', fontSize: 13 }}>
              Cet accès sera définitivement fermé après création.
            </span>
          </p>

          {error === 'SETUP_ALREADY_DONE' ? (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--bad)', marginBottom: 6 }}>Accès refusé</div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                Un Super Admin existe déjà. Cette page de configuration est fermée.<br />
                Si vous avez perdu l'accès, contactez votre administrateur système.
              </p>
              <button className="btn" style={{ marginTop: 12 }} onClick={() => nav('/login')}>
                ← Retour à la connexion
              </button>
            </div>
          ) : (
            <div className="form" style={{ marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>Prénom
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" />
                </label>
                <label>Nom
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" />
                </label>
              </div>
              <label>Sexe
                <select value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  <option value="F">Femme</option>
                  <option value="M">Homme</option>
                </select>
              </label>
              <label>Email
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@centre-vernet.cm" />
              </label>
              <label>Mot de passe
                <div className="pwd-wrap">
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Choisissez un mot de passe fort" />
                  <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>
              {error && error !== 'SETUP_ALREADY_DONE' && <div className="error">{error}</div>}
              <button className="btn primary" disabled={loading || !canSubmit}
                onClick={async () => {
                  setError(null); setLoading(true)
                  try {
                    await apiPost('/api/auth/setup', {
                      firstName: firstName.trim(), lastName: lastName.trim(),
                      gender, email, password,
                    })
                    setDone(true)
                  } catch (e: any) {
                    if (e?.error === 'SETUP_ALREADY_DONE') setError('SETUP_ALREADY_DONE')
                    else setError(e?.error ?? 'Erreur')
                  } finally { setLoading(false) }
                }}>
                {loading ? 'Création…' : 'Créer le compte Super Admin'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

function Login({ onPending }: { onPending: (d: PendingData) => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const nav = useNavigate()

  return (
    <main className="auth-page">
      <div className="auth-photo-side" style={{ backgroundImage: `url("/media/salles/salle-d'acceuil.png")` }} />
      <div className="auth-form-side">
        <div className="auth-card panel">
          <h1>Connexion</h1>
          <p className="muted">Un code de vérification sera envoyé à votre email.</p>
          <div className="form">
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" />
            </label>
            <label>Mot de passe
              <div className="pwd-wrap">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('btn-login')?.click() }} />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}
                  title={showPwd ? 'Masquer' : 'Afficher'}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
            {error && <div className="error">{error}</div>}
            <button id="btn-login" className="btn primary" disabled={loading || !email || !password}
              onClick={async () => {
                setError(null); setLoading(true)
                try {
                  const res = await apiPost<LoginResponse>('/api/auth/login', { email, password })
                  onPending({ token: res.pendingToken, email: res.email, devCode: res.devCode })
                  nav('/verify-2fa')
                } catch (e: any) {
                  const m: Record<string, string> = { INVALID_CREDENTIALS: 'Email ou mot de passe incorrect.' }
                  setError(m[e?.error] ?? e?.error ?? 'Erreur de connexion')
                } finally { setLoading(false) }
              }}>
              {loading ? 'Connexion…' : 'Continuer'}
            </button>
            <p className="auth-switch">Pas encore de compte ? <Link to="/register">S'inscrire</Link></p>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Verify 2FA ───────────────────────────────────────────────────────────────

function Verify2fa({ pending, onAccessToken }: { pending: PendingData | null; onAccessToken: (t: string) => void }) {
  const [code, setCode]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  return (
    <main className="auth-page">
      <div className="auth-photo-side" style={{ backgroundImage: "url('/media/salles/salle-de-massage-hammam-1.png')" }} />
      <div className="auth-form-side">
        <div className="auth-card panel">
          <h1>Vérification</h1>
          {!pending ? (
            <div className="error">Session expirée. <Link to="/login">Reconnecte-toi.</Link></div>
          ) : (
            <>
              <p className="muted">Code à 6 chiffres envoyé à <strong>{pending.email}</strong>.</p>
              {pending.devCode && (
                <div className="dev-code-box">
                  <span className="dev-code-label">Mode développement</span>
                  <span className="dev-code-value">{pending.devCode}</span>
                  <span className="dev-code-hint">En production, ce code arriverait uniquement par email</span>
                </div>
              )}
              <div className="form" style={{ marginTop: 16 }}>
                <label>Code reçu par email
                  <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456" maxLength={6}
                    style={{ textAlign: 'center', fontSize: 28, letterSpacing: 10, fontWeight: 700 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('btn-2fa')?.click() }}
                    autoFocus />
                </label>
                {error && <div className="error">{error}</div>}
                <button id="btn-2fa" className="btn primary" disabled={loading || code.length !== 6}
                  onClick={async () => {
                    setError(null); setLoading(true)
                    try {
                      const res = await apiPost<TokenResponse>('/api/auth/verify-2fa', { pendingToken: pending.token, code })
                      onAccessToken(res.accessToken)
                      nav('/dashboard')
                    } catch (e: any) {
                      const m: Record<string, string> = {
                        INVALID_2FA_CODE: 'Code incorrect.',
                        CODE_EXPIRED: 'Code expiré. Reconnecte-toi.',
                        INVALID_PENDING_TOKEN: 'Session expirée. Reconnecte-toi.',
                      }
                      setError(m[e?.error] ?? e?.error ?? 'Code invalide')
                      setCode('')
                    } finally { setLoading(false) }
                  }}>
                  {loading ? 'Vérification…' : 'Valider'}
                </button>
                <p className="auth-switch"><Link to="/login">← Retour à la connexion</Link></p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type Module = { icon: string; title: string; desc: string; link?: string; soon?: true }

const MODULES_CLIENT: Module[] = [
  { icon: '📊', title: 'Suivi poids/IMC', desc: 'Courbes de progression et alertes.', link: '/suivi-poids' },
  { icon: '💬', title: 'Messagerie',       desc: 'Échanges avec votre coach.', link: '/messagerie' },
  { icon: '🔔', title: 'Notifications',    desc: 'Alertes et rappels.', link: '/notifications' },
  { icon: '📅', title: 'Rendez-vous',      desc: 'Planifier une consultation.', link: '/planning' },
  { icon: '📁', title: 'Catalogue',        desc: 'Documents et templates.', link: '/catalogue' },
]
const MODULES_STAFF: Module[] = [
  { icon: '👥', title: 'Mes clients',      desc: 'Liste et fiches clients.', link: '/mes-clients' },
  { icon: '💬', title: 'Messagerie',       desc: 'Communication avec les clients.', link: '/messagerie' },
  { icon: '🔔', title: 'Notifications',    desc: 'Alertes et rappels.', link: '/notifications' },
  { icon: '📅', title: 'Planning',         desc: 'Calendrier et consultations.', link: '/planning' },
  { icon: '📁', title: 'Catalogue',        desc: 'Documents et templates.', link: '/catalogue' },
  { icon: '📊', title: 'Rapports',         desc: 'Statistiques et export PDF.', link: '/rapports' },
]
const MODULES_ADMIN: Module[] = [
  ...MODULES_STAFF,
  { icon: '⚙️', title: 'Utilisateurs',    desc: 'Gestion des comptes.', link: '/utilisateurs' },
  { icon: '🏥', title: 'Centre',           desc: 'Paramètres du centre.', link: '/centre' },
]

// Convertit un code météo Open-Meteo en emoji + description
function weatherInfo(code: number): { icon: string; desc: string } {
  if (code === 0)              return { icon: '☀️',  desc: 'Ciel dégagé' }
  if (code <= 2)               return { icon: '🌤️', desc: 'Peu nuageux' }
  if (code === 3)              return { icon: '☁️',  desc: 'Couvert' }
  if (code <= 48)              return { icon: '🌫️', desc: 'Brouillard' }
  if (code <= 57)              return { icon: '🌦️', desc: 'Bruine' }
  if (code <= 67)              return { icon: '🌧️', desc: 'Pluie' }
  if (code <= 77)              return { icon: '❄️',  desc: 'Neige' }
  if (code <= 82)              return { icon: '🌧️', desc: 'Averses' }
  if (code <= 86)              return { icon: '🌨️', desc: 'Neige' }
  return                              { icon: '⛈️',  desc: 'Orage' }
}

function Dashboard({ auth }: { auth: AuthCtx }) {
  const role    = auth.role
  const nav     = useNavigate()
  const isStaff = role !== 'CLIENT'
  const today   = new Date().toISOString().slice(0, 10)

  const [weather, setWeather]           = useState<any>(null)
  const [stats, setStats]               = useState<any>(null)
  const [todayAppts, setTodayAppts]     = useState<any[]>([])
  const [recentClients, setRecentClients] = useState<any[]>([])
  const [clientStats, setClientStats]   = useState<any>(null) // pour CLIENT

  const now   = new Date()
  const hours = now.getHours()
  const greet = hours < 12 ? 'Bonjour' : hours < 18 ? 'Bon après-midi' : 'Bonsoir'
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => {
    // Météo Douala (lat: 4.05, lon: 9.70)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=4.05&longitude=9.70&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Africa%2FDouala')
      .then(r => r.json())
      .then(d => setWeather(d.current))
      .catch(() => {})

    if (isStaff && auth.accessToken) {
      apiGet<any>('/api/users/stats', auth.accessToken).then(setStats).catch(() => {})
      apiGet<any[]>('/api/appointments', auth.accessToken).then(res => {
        const arr = Array.isArray(res) ? res : []
        setTodayAppts(arr.filter(a => a.scheduledAt?.startsWith(today)))
      }).catch(() => {})
      apiGet<any[]>('/api/users/clients', auth.accessToken).then(res => {
        const arr = Array.isArray(res) ? res : []
        setRecentClients(arr.slice(-4).reverse())
      }).catch(() => {})
    } else if (role === 'CLIENT' && auth.accessToken && auth.userId) {
      apiGet<any>(`/api/users/${auth.userId}/dossier`, auth.accessToken)
        .then(setClientStats).catch(() => {})
    }
  }, [])

  const wInfo = weather ? weatherInfo(weather.weather_code) : null

  // ── Actions rapides selon le rôle ──
  const quickActions = role === 'CLIENT'
    ? [
        { icon: '⚖️', label: 'Suivi poids', link: '/suivi-poids' },
        { icon: '📅', label: 'Rendez-vous',  link: '/planning' },
        { icon: '💬', label: 'Messagerie',   link: '/messagerie' },
        { icon: '🗂️', label: 'Mon dossier',  link: '/mon-dossier' },
      ]
    : role === 'SUPER_ADMIN' || role === 'ADMIN'
    ? [
        { icon: '👥', label: 'Mes clients',   link: '/mes-clients' },
        { icon: '📅', label: 'Planning',      link: '/planning' },
        { icon: '💬', label: 'Messagerie',    link: '/messagerie' },
        { icon: '📊', label: 'Rapports',      link: '/rapports' },
        { icon: '⚙️', label: 'Utilisateurs',  link: '/utilisateurs' },
        { icon: '🏥', label: 'Centre',        link: '/centre' },
      ]
    : [
        { icon: '👥', label: 'Mes clients', link: '/mes-clients' },
        { icon: '📅', label: 'Planning',    link: '/planning' },
        { icon: '💬', label: 'Messagerie',  link: '/messagerie' },
        { icon: '📊', label: 'Rapports',    link: '/rapports' },
      ]

  // Stats client pour le dashboard CLIENT
  const lastWeight = clientStats?.weightEntries?.length
    ? clientStats.weightEntries[clientStats.weightEntries.length - 1] : null
  const nextAppt = clientStats?.appointments?.find((a: any) =>
    a.scheduledAt >= today && a.status !== 'CANCELLED')

  return (
    <main>
      {/* ══ Hero ══ */}
      <div className="dashboard-hero"
        style={{ backgroundImage: "url('/media/backgrounds/salon-travail-mobilite-amincissement-laurand.jpg')" }}>
        <div className="dashboard-hero-overlay">
          <div>
            <h1>{greet}</h1>
            <p style={{ opacity: .85 }}>{auth.email}</p>
            <p style={{ fontSize: 13, opacity: .7, marginTop: 4 }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <span className={roleBadgeClass(role) + ' role-badge-lg'}>{roleLabel(role)}</span>
            {wInfo && weather && (
              <div className="dashboard-weather">
                <span className="dashboard-weather-icon">{wInfo.icon}</span>
                <div>
                  <div className="dashboard-weather-temp">{Math.round(weather.temperature_2m)}°C</div>
                  <div className="dashboard-weather-desc">{wInfo.desc} · Douala</div>
                  <div className="dashboard-weather-extra">
                    💧 {weather.relative_humidity_2m}% · 💨 {Math.round(weather.wind_speed_10m)} km/h
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 20 }}>

        {/* ══ Stats globales (staff/admin) ══ */}
        {isStaff && stats && (
          <div className="stat-cards" style={{ marginBottom: 20 }}>
            {[
              { icon: '👥', label: 'Clients',        value: stats.totalClients,       link: '/mes-clients' },
              { icon: '📅', label: "RDV aujourd'hui", value: todayAppts.length,        link: '/planning' },
              { icon: '💬', label: 'Messages',        value: stats.totalMessages,      link: '/messagerie' },
              { icon: '🗨️', label: 'Conversations',   value: stats.totalThreads,       link: '/messagerie' },
              { icon: '⚖️', label: 'Mesures poids',   value: stats.totalWeightEntries, link: '/rapports' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ cursor: 'pointer' }}
                onClick={() => nav(s.link)}>
                                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ══ Stats CLIENT ══ */}
        {role === 'CLIENT' && (lastWeight || nextAppt) && (
          <div className="stat-cards" style={{ marginBottom: 20 }}>
            {lastWeight && (
              <div className="stat-card" onClick={() => nav('/suivi-poids')} style={{ cursor: 'pointer' }}>
                                <div className="stat-value">{lastWeight.weightKg} <span className="stat-unit">kg</span></div>
                <div className="stat-label">Dernier poids</div>
                <div className="stat-sub">{lastWeight.date}</div>
              </div>
            )}
            {lastWeight?.bmi && (
              <div className="stat-card" onClick={() => nav('/suivi-poids')} style={{ cursor: 'pointer' }}>
                                <div className="stat-value" style={{ color: lastWeight.bmi < 25 ? 'var(--ok)' : 'var(--warn)' }}>
                  {lastWeight.bmi}
                </div>
                <div className="stat-label">IMC actuel</div>
                <div className="stat-sub">{lastWeight.bmi < 18.5 ? 'Insuffisant' : lastWeight.bmi < 25 ? 'Normal ✓' : lastWeight.bmi < 30 ? 'Surpoids' : 'Obésité'}</div>
              </div>
            )}
            {nextAppt && (
              <div className="stat-card" onClick={() => nav('/planning')} style={{ cursor: 'pointer' }}>
                                <div className="stat-value" style={{ fontSize: 18 }}>{fmtAppt(nextAppt.scheduledAt).split(' à ')[1] ?? '—'}</div>
                <div className="stat-label">Prochain RDV</div>
                <div className="stat-sub">{fmtAppt(nextAppt.scheduledAt).split(' à ')[0]}</div>
              </div>
            )}
            {clientStats && (
              <div className="stat-card" onClick={() => nav('/planning')} style={{ cursor: 'pointer' }}>
                                <div className="stat-value">{clientStats.appointments?.length ?? 0}</div>
                <div className="stat-label">Consultations</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isStaff && todayAppts.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>

          {/* ══ RDV du jour (staff) ══ */}
          {isStaff && (
            <div className="panel">
              <div className="panel-row" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>RDV d'aujourd'hui</h2>
                <button className="btn btn-sm" onClick={() => nav('/planning')}>Voir tout</button>
              </div>
              {todayAppts.length === 0
                ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>Aucun rendez-vous prévu aujourd'hui.</p>
                : todayAppts.map(a => (
                  <div key={a.id} className="list-item" style={{ padding: '8px 0' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {APPT_TYPE_LABELS[a.type] ?? a.type}
                      <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                        {' '}· {fmtAppt(a.scheduledAt).split(' à ')[1] ?? ''}
                      </span>
                    </div>
                    {a.clientEmail && <div className="list-meta">{a.clientEmail}</div>}
                    <span style={{ fontSize: 11, fontWeight: 700, color: APPT_STATUS_CLR[a.status] ?? 'var(--muted)', padding: '2px 8px', border: '1px solid currentColor', borderRadius: 999 }}>
                      {APPT_STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </div>
                ))
              }
            </div>
          )}

          {/* ══ Derniers clients inscrits (staff) ══ */}
          {isStaff && recentClients.length > 0 && (
            <div className="panel">
              <div className="panel-row" style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Derniers clients inscrits</h2>
                <button className="btn btn-sm" onClick={() => nav('/mes-clients')}>Voir tous</button>
              </div>
              {recentClients.map(c => {
                const name = (c.firstName || c.lastName) ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : c.email.split('@')[0]
                return (
                  <div key={c.id} className="list-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}
                    onClick={() => nav(`/mes-clients/${c.id}`)}>
                    <div className="client-avatar" style={{ width: 36, height: 36, fontSize: 14, background: c.gender === 'F' ? 'rgba(200,0,94,0.12)' : 'rgba(0,111,168,0.12)', color: c.gender === 'F' ? 'var(--accent)' : 'var(--accent-2)' }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
                      <div className="list-meta">{c.createdAt?.substring(0, 10)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══ Actions rapides ══ */}
        <div className="panel">
          <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Accès rapides</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {quickActions.map(a => (
              <button key={a.link} className="dashboard-quick-action" onClick={() => nav(a.link)}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function Notifications({ accessToken }: { accessToken: string | null }) {
  const [items, setItems]     = useState<any[]>([])
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const ctx = useOutletContext<{ refreshUnread?: () => void }>()

  async function load() {
    if (!accessToken) return
    setError(null); setLoading(true)
    try {
      const res = await apiGet<any>('/api/notifications?size=50', accessToken)
      setItems(res.items ?? [])
      // Marquer tout comme lu et rafraîchir le badge
      await fetch('http://localhost:8080/api/notifications/read-all', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }
      })
      ctx?.refreshUnread?.()
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const notifIcon = (_type: string) => ''

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackBtn />
            <h1 style={{ margin: 0 }}>Notifications</h1>
          </div>
          <button className="btn" disabled={!accessToken || loading} onClick={load}>
            {loading ? 'Chargement…' : '↻ Rafraîchir'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {!accessToken ? (
          <p className="muted"><Link to="/login">Connecte-toi</Link> pour voir tes notifications.</p>
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {!loading && items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                <p style={{ margin: 0 }}>Aucune notification pour l'instant.</p>
              </div>
            )}
            {items.map((n) => (
              <div key={n.id} className="list-item" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="list-title">{n.title}</div>
                  <div className="list-sub" style={{ whiteSpace: 'pre-line' }}>{n.body}</div>
                  <div className="list-meta">{n.createdAt?.substring(0, 16).replace('T', ' à ')}</div>
                </div>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes < 1024) return (bytes ?? 0) + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}

function MicIcon({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function LocalTextReader({ file }: { file: File }) {
  const [text, setText] = useState('Chargement…')
  useEffect(() => { file.text().then(setText) }, [])
  return <pre className="doc-preview-text">{text}</pre>
}

// ─── Prévisualisation document (PDF, texte, Word…) ───────────────────────────

function DocPreviewModal({ m, token, onClose, onSave }: { m: any; token: string; onClose: () => void; onSave?: (id: number) => void }) {
  const [blobUrl, setBlobUrl]   = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  const isPdf  = m.attachmentContentType?.includes('pdf')
  const isText = m.attachmentContentType?.startsWith('text/')
  const isWord = m.attachmentContentType?.includes('word') || /\.(docx?|odt)$/i.test(m.attachmentName ?? '')
  const isExcel = m.attachmentContentType?.includes('sheet') || m.attachmentContentType?.includes('excel') || /\.(xlsx?|ods)$/i.test(m.attachmentName ?? '')
  const isPpt  = m.attachmentContentType?.includes('presentation') || /\.(pptx?|odp)$/i.test(m.attachmentName ?? '')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)

    fetch(`http://localhost:8080/api/catalog/${m.attachmentId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
      if (isText) blob.text().then(setTextContent)
      setLoading(false)
    })
    .catch(() => setLoading(false))

    return () => {
      window.removeEventListener('keydown', handler)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [])

  const docIcon = isPdf ? '📄' : isWord ? '📝' : isExcel ? '📊' : isPpt ? '📑' : '📎'
  const formatLabel = isPdf ? 'Document PDF' : isWord ? 'Document Word' : isExcel ? 'Feuille Excel' : isPpt ? 'Présentation' : 'Document'
  const canPreview = isPdf || isText

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content doc-preview-modal" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>✕</button>

        {/* En-tête */}
        <div className="doc-preview-header">
          <span style={{ fontSize: 32 }}>{docIcon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{m.attachmentName}</div>
            <div className="muted" style={{ fontSize: 13 }}>{formatLabel} · {formatFileSize(m.attachmentSize)}</div>
          </div>
        </div>

        {/* Contenu */}
        {loading && <div className="muted" style={{ padding: 32, textAlign: 'center' }}>Chargement…</div>}

        {!loading && isPdf && blobUrl && (
          <iframe
            src={blobUrl}
            className="doc-preview-iframe"
            title={m.attachmentName}
          />
        )}

        {!loading && isText && textContent !== null && (
          <pre className="doc-preview-text">{textContent}</pre>
        )}

        {!loading && !canPreview && (
          <div className="doc-preview-no-preview">
            <div style={{ fontSize: 64, marginBottom: 16 }}>{docIcon}</div>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Aperçu non disponible</div>
            <p className="muted" style={{ margin: 0, textAlign: 'center' }}>
              Les fichiers {formatLabel.toLowerCase()} ne peuvent pas être affichés directement.<br />
              Téléchargez le fichier pour l'ouvrir avec votre application.
            </p>
          </div>
        )}

        {/* Actions */}
        {!loading && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            {blobUrl && (
              <button className="btn primary"
                onClick={() => downloadWithAuth(
                  `http://localhost:8080/api/catalog/${m.attachmentId}/download`,
                  m.attachmentName, token)}>
                Télécharger
              </button>
            )}
            {onSave && (
              <button className="btn" style={{ color: 'var(--ok)', borderColor: 'rgba(21,128,61,0.3)' }}
                onClick={() => { onSave(m.attachmentId); onClose() }}>
                Sauvegarder dans mon catalogue
              </button>
            )}
            <button className="btn" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Audio authentifié (JWT dans le header) ─────────────────────────────────

function AuthAudio({ src, token }: { src: string; token: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => { url = URL.createObjectURL(blob); setBlobUrl(url) })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [src, token])
  if (!blobUrl) return <div className="msg-audio-loading">Chargement…</div>
  return <audio src={blobUrl} controls className="msg-audio-player" />
}

// ─── Image authentifiée (JWT dans le header) ────────────────────────────────

function AuthImage({ src, alt, className, token }: { src: string; alt?: string; className?: string; token: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    fetch(src, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => { url = URL.createObjectURL(blob); setBlobUrl(url) })
      .catch(() => setBlobUrl('error'))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [src, token])

  if (!blobUrl) return <div className="msg-bubble-img-loading" />
  if (blobUrl === 'error') return <div className="muted" style={{ fontSize: 12 }}>Image non disponible</div>
  return <img src={blobUrl} alt={alt} className={className} />
}

async function downloadWithAuth(url: string, filename: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

// ─── Messagerie (full-page chat app) ─────────────────────────────────────────

const ROLE_ICONS: Record<string, string> = {
  SUPER_ADMIN: '', ADMIN: '', SECRETARY: '', COACH: '', NUTRITIONIST: '',
}

// Retourne le nom affiché de l'autre participant dans un thread
function threadOtherName(t: any, myId: number | null): string {
  const candidates = [
    { id: t.clientId,       email: t.clientEmail },
    { id: t.coachId,        email: t.coachEmail },
    { id: t.nutritionistId, email: t.nutritionistEmail },
    { id: t.staffId,        email: t.staffEmail },
  ].filter(c => c.id && c.id !== myId && c.email)
  if (candidates.length > 0) return candidates[0].email.split('@')[0]
  return t.title // fallback
}
const ROLE_FR: Record<string, string> = {
  SUPER_ADMIN: 'Administration', SECRETARY: 'Secrétariat',
  COACH: 'Coach', NUTRITIONIST: 'Nutritionniste',
}

function Messaging({ auth }: { auth: AuthCtx }) {
  const { accessToken, role, userId } = auth

  const [threads, setThreads]       = useState<any[]>([])
  const [selected, setSelected]     = useState<any | null>(null)
  const [msgs, setMsgs]             = useState<any[]>([])
  const [text, setText]             = useState('')
  const [sending, setSending]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editText, setEditText]     = useState('')
  const [attachFile, setAttachFile]   = useState<File | null>(null)
  const fileInputRef                  = useRef<HTMLInputElement | null>(null)
  const [msgPreview, setMsgPreview]   = useState<any | null>(null)
  const [localPreview, setLocalPreview] = useState<{ file: File; url: string } | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [catalogPicker, setCatalogPicker]   = useState(false)
  const [catalogFiles, setCatalogFiles]     = useState<any[]>([])

  // ── Enregistrement vocal ──
  const [isRecording, setIsRecording]     = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob]         = useState<Blob | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const audioChunksRef    = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioPreviewUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }
      mr.start(100)
      setIsRecording(true)
      setRecordingTime(0)
      setAudioBlob(null)
      recordingTimerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch { setError('Microphone non accessible. Vérifiez les permissions.') }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }

  function cancelRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
    }
    setIsRecording(false)
    setAudioBlob(null)
    if (audioPreviewUrl) { URL.revokeObjectURL(audioPreviewUrl); setAudioPreviewUrl(null) }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setRecordingTime(0)
  }

  async function sendVoiceMessage() {
    if (!audioBlob || !selected) return
    setSending(true)
    try {
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp4') ? 'm4a' : 'webm'
      const filename = `vocal-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`
      const form = new FormData()
      form.append('file', audioBlob, filename)
      const res = await fetch(`http://localhost:8080/api/messaging/threads/${selected.id}/messages/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form,
      })
      if (!res.ok) throw new Error()
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
      setAudioBlob(null); setAudioPreviewUrl(null); setRecordingTime(0)
      await loadMessages(selected.id)
    } catch { setError('Erreur envoi vocal') }
    finally { setSending(false) }
  }

  function fmtTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function saveToClientCatalog(assetId: number) {
    try {
      await fetch(`http://localhost:8080/api/client-catalog/save/${assetId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }
      })
    } catch { /**/ }
  }

  // Nouveau fil : sélecteur de staff (CLIENT) ou saisie titre (staff)
  const [showPicker, setShowPicker] = useState(false)
  const [staffList, setStaffList]   = useState<any[]>([])
  const [newTitle, setNewTitle]     = useState('')    // pour staff uniquement

  useEffect(() => { loadThreads() }, [])

  // ── loaders ──
  async function loadThreads() {
    setError(null)
    try {
      const res = await apiGet<any>('/api/messaging/threads?size=50', accessToken ?? undefined)
      setThreads(res.items ?? [])
    } catch (e: any) { setError(e?.error ?? 'Erreur chargement') }
  }

  async function loadMessages(threadId: number) {
    try {
      const res = await apiGet<any>(
        `/api/messaging/threads/${threadId}/messages?size=50`, accessToken ?? undefined)
      setMsgs((res.items ?? []).slice().reverse())
      // Marquer les messages comme lus
      fetch(`http://localhost:8080/api/messaging/threads/${threadId}/read`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }
      }).catch(() => {})
    } catch { /* silencieux */ }
  }

  async function loadPeople() {
    try {
      if (role === 'CLIENT') {
        const res = await apiGet<any[]>('/api/messaging/staff', accessToken ?? undefined)
        setStaffList(Array.isArray(res) ? res : [])
      } else {
        // Admin/staff : charge tous les utilisateurs (clients + collègues)
        const res = await apiGet<any[]>('/api/messaging/users', accessToken ?? undefined)
        setStaffList(Array.isArray(res) ? res : [])
      }
    } catch { setStaffList([]) }
  }

  // ── actions ──
  async function openPicker() {
    setShowPicker(true)
    await loadPeople()
  }

  async function createThreadWithPerson(person: any) {
    setError(null); setShowPicker(false)
    const name  = person.email.split('@')[0]
    const title = `${ROLE_FR[person.role] ?? person.role} — ${name}`

    // Réutiliser une conversation existante avec cette personne
    const existing = threads.find(t => t.title === title)
    if (existing) {
      setSelected(existing)
      loadMessages(existing.id)
      return
    }

    // Créer seulement si aucune n'existe
    try {
      const body = person.role === 'CLIENT'
        ? { title, clientId: person.id }
        : { title, staffId: person.id }
      const res = await apiPost<any>('/api/messaging/threads', body, accessToken ?? undefined)
      await loadThreads()
      setSelected({ id: res.id, title, createdAt: new Date().toISOString() })
      setMsgs([])
    } catch (e: any) { setError(e?.error ?? 'Erreur création') }
  }

  async function deleteThread(threadId: number) {
    try {
      const res = await fetch(`http://localhost:8080/api/messaging/threads/${threadId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
      })
      // 404 = déjà supprimé côté serveur → on retire quand même de la liste
      if (!res.ok && res.status !== 404) { setError(`Erreur suppression (${res.status})`); return }
      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (selected?.id === threadId) { setSelected(null); setMsgs([]) }
    } catch { setError('Erreur réseau') }
  }

  async function deleteMsg(threadId: number, msgId: number) {
    try {
      await fetch(`http://localhost:8080/api/messaging/threads/${threadId}/messages/${msgId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
      })
      setMsgs(prev => prev.filter(m => m.id !== msgId))
    } catch { /**/ }
  }

  async function saveEdit(threadId: number, msgId: number) {
    if (!editText.trim()) return
    try {
      const res = await fetch(
        `http://localhost:8080/api/messaging/threads/${threadId}/messages/${msgId}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: editText.trim() }),
        },
      )
      const updated = await res.json()
      setMsgs(prev => prev.map(m => m.id === msgId ? updated : m))
      setEditingId(null)
    } catch { /**/ }
  }

  async function sendMessage() {
    if ((!text.trim() && !attachFile) || !selected || sending) return
    setSending(true)

    try {
      if (attachFile) {
        // Envoi avec fichier
        const form = new FormData()
        form.append('file', attachFile)
        if (text.trim()) form.append('text', text.trim())
        const res = await fetch(`http://localhost:8080/api/messaging/threads/${selected.id}/messages/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        })
        if (!res.ok) {
          const err = await res.text().catch(() => '')
          throw new Error(res.status === 413 ? 'Fichier trop volumineux (max 20 Mo)' : `Erreur upload (${res.status}) ${err}`)
        }
        setAttachFile(null)
        setText('')
      } else {
        // Envoi texte seul
        const txt = text; setText('')
        await apiPost<any>(
          `/api/messaging/threads/${selected.id}/messages`,
          { text: txt }, accessToken ?? undefined,
        )
      }
      await loadMessages(selected.id)
    } catch (e: any) { setError(e?.error ?? 'Erreur envoi') }
    finally { setSending(false) }
  }


  function isImage(contentType?: string) {
    return contentType?.startsWith('image/')
  }

  if (!accessToken) {
    return (
      <main className="container">
        <div className="panel">
          <p className="muted"><Link to="/login">Connecte-toi</Link> pour accéder à la messagerie.</p>
        </div>
      </main>
    )
  }

  return (
    <div className="msg-page">
      {/* Picker catalogue */}
      {catalogPicker && (
        <div className="lightbox-overlay" onClick={() => setCatalogPicker(false)}>
          <div className="lightbox-content" style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setCatalogPicker(false)}>✕</button>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Choisir depuis le catalogue</div>
            {catalogFiles.length === 0 ? (
              <p className="muted">Aucun document disponible dans le catalogue.</p>
            ) : (
              <div style={{ overflow: 'auto', flex: 1 }}>
                {/* Grouper par catégorie */}
                {['Régimes','Exercices','Bilans','Programmes','Résultats','Autre', ''].map(cat => {
                  const group = cat === ''
                    ? catalogFiles.filter(f => !f.category)
                    : catalogFiles.filter(f => f.category === cat)
                  if (group.length === 0) return null
                  return (
                    <div key={cat || 'none'} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 6 }}>
                        {cat || 'Sans catégorie'}
                      </div>
                      {group.map(f => {
                        const isImg = f.contentType?.startsWith('image/')
                        return (
                          <button key={f.id} className="catalog-picker-item"
                            onClick={async () => {
                              setCatalogPicker(false)
                              setSending(true)
                              try {
                                await apiPost(`/api/messaging/threads/${selected?.id}/messages`, {
                                  text: '', attachmentId: f.id
                                }, accessToken ?? undefined)
                                await loadMessages(selected!.id)
                              } catch { /**/ } finally { setSending(false) }
                            }}>
                            {isImg ? (
                              <div className="catalog-picker-thumb">
                                <AuthImage
                                  src={`http://localhost:8080/api/catalog/${f.id}/download`}
                                  alt={f.originalFilename}
                                  className="catalog-picker-img"
                                  token={accessToken ?? ''}
                                />
                              </div>
                            ) : (
                              <div className="catalog-picker-icon">{fileIcon(f.contentType)}</div>
                            )}
                            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.originalFilename}</div>
                              <div className="muted" style={{ fontSize: 11 }}>{formatFileSize(f.sizeBytes)}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prévisualisation image ou document messagerie */}
      {msgPreview && isImage(msgPreview.attachmentContentType) && (
        <ImageLightbox item={{ id: msgPreview.attachmentId, originalFilename: msgPreview.attachmentName }}
          token={accessToken ?? ''} onClose={() => setMsgPreview(null)}
          onSave={role === 'CLIENT' ? saveToClientCatalog : undefined} />
      )}
      {msgPreview && !isImage(msgPreview.attachmentContentType) && (
        <DocPreviewModal m={msgPreview} token={accessToken ?? ''} onClose={() => setMsgPreview(null)}
          onSave={role === 'CLIENT' ? saveToClientCatalog : undefined} />
      )}

      {/* ══ SIDEBAR ═══════════════════════════════════════════ */}
      <aside className="msg-sidebar">
        <div className="msg-sidebar-top">
          <h2 className="msg-sidebar-title">Messages</h2>
          <button className="msg-new-btn" title="Nouvelle conversation" onClick={openPicker}>✏️</button>
          <button className="msg-refresh-btn" title="Rafraîchir" onClick={loadThreads}>↻</button>
        </div>

        {/* ── Picker universel : CLIENT → staff ; Staff/Admin → tout le monde ── */}
        {showPicker && (
          <div className="msg-picker">
            <div className="msg-picker-header">
              <span>Écrire à…</span>
              <button onClick={() => setShowPicker(false)}>✕</button>
            </div>
            {staffList.length === 0
              ? <p className="msg-picker-empty">Chargement…</p>
              : (() => {
                  const clients = staffList.filter(s => s.role === 'CLIENT')
                  const team    = staffList.filter(s => s.role !== 'CLIENT')
                  return (
                    <>
                      {team.length > 0 && (
                        <>
                          {role !== 'CLIENT' && <div className="msg-picker-section">Équipe</div>}
                          {team.map((s) => (
                            <button key={s.id} className="msg-picker-item" onClick={() => createThreadWithPerson(s)}>
                              <span className="msg-picker-icon">{ROLE_ICONS[s.role] ?? '👤'}</span>
                              <div>
                                <div className="msg-picker-name">{s.email.split('@')[0]}</div>
                                <div className="msg-picker-role">{ROLE_FR[s.role] ?? s.role}</div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      {clients.length > 0 && (
                        <>
                          <div className="msg-picker-section">Clients</div>
                          {clients.map((s) => (
                            <button key={s.id} className="msg-picker-item" onClick={() => createThreadWithPerson(s)}>
                              <span className="msg-picker-icon">👤</span>
                              <div>
                                <div className="msg-picker-name">{s.email.split('@')[0]}</div>
                                <div className="msg-picker-role">Client</div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  )
                })()
            }
          </div>
        )}

        {error && <div className="msg-error">{error}</div>}

        <div className="msg-thread-list">
          {threads.length === 0 && (
            <div className="msg-empty-hint">
              Aucune conversation.<br />Clique ✏️ pour commencer.
            </div>
          )}
          {(() => {
            // Pour staff/admin : séparer "mes conversations" des "autres"
            const isStaff = role !== 'CLIENT'
            const myThreads    = isStaff ? threads.filter(t =>
              t.clientId === userId || t.coachId === userId ||
              t.nutritionistId === userId || t.staffId === userId
            ) : threads
            const otherThreads = isStaff ? threads.filter(t =>
              t.clientId !== userId && t.coachId !== userId &&
              t.nutritionistId !== userId && t.staffId !== userId
            ) : []

            const renderThread = (t: any) => (
              <div key={t.id}
                className={`msg-thread-item${selected?.id === t.id ? ' active' : ''}`}
                onClick={() => { setSelected(t); loadMessages(t.id) }}>
                <div className="msg-thread-avatar">{threadOtherName(t, userId).charAt(0).toUpperCase()}</div>
                <div className="msg-thread-info">
                  <div className="msg-thread-name">{threadOtherName(t, userId)}</div>
                  <div className="msg-thread-date">{t.createdAt?.substring(0, 10) ?? ''}</div>
                </div>
                <button
                  className="msg-thread-delete"
                  title="Supprimer la conversation"
                  onClick={e => { e.stopPropagation(); deleteThread(t.id) }}
                >🗑️</button>
              </div>
            )

            if (!isStaff) return threads.map(renderThread)

            return (
              <>
                {/* Section 1 : mes conversations directes */}
                <div className="msg-section-label">Mes messages</div>
                {myThreads.length === 0
                  ? <div className="msg-empty-hint" style={{ fontSize: 12, padding: '8px 12px' }}>Aucune conversation directe.</div>
                  : myThreads.map(renderThread)
                }
                {/* Section 2 : conversations entre employés et clients */}
                {otherThreads.length > 0 && (
                  <>
                    <div className="msg-section-label" style={{ marginTop: 8 }}>Conversations employés-clients</div>
                    {otherThreads.map(renderThread)}
                  </>
                )}
              </>
            )
          })()}
        </div>
      </aside>

      {/* ══ ZONE DE CHAT ══════════════════════════════════════ */}
      <div className="msg-chat">
        {selected ? (
          <>
            <div className="msg-chat-header">
              <div className="msg-chat-avatar">{threadOtherName(selected, userId).charAt(0).toUpperCase()}</div>
              <div>
                <div className="msg-chat-name">{threadOtherName(selected, userId)}</div>
                <div className="msg-chat-sub">Conversation privée · Centre du Vernet</div>
              </div>
            </div>

            <div className="msg-chat-body" id="msg-body">
              {msgs.length === 0 && (
                <div className="msg-chat-start">Aucun message pour l'instant. Commencez la conversation.</div>
              )}
              {msgs.map((m) => {
                const mine = m.senderId === userId
                const isEditing = editingId === m.id
                return (
                  <div key={m.id} className={`msg-bubble-wrap ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && (
                      <div className="msg-bubble-sender">
                        {m.senderEmail?.split('@')[0] ?? 'Centre'}
                      </div>
                    )}

                    {isEditing ? (
                      /* ── Mode édition ── */
                      <div className="msg-edit-wrap">
                        <input
                          autoFocus
                          className="msg-edit-input"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) saveEdit(selected.id, m.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <div className="msg-edit-actions">
                          <button className="btn btn-sm primary" onClick={() => saveEdit(selected.id, m.id)}>✓ Sauver</button>
                          <button className="btn btn-sm" onClick={() => setEditingId(null)}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      /* ── Bulle normale ── */
                      <div className="msg-bubble-outer">
                        <div className="msg-bubble">
                          {m.text && m.text.trim() && <div className="msg-bubble-text">{m.text}</div>}
                          {m.attachmentId && m.attachmentContentType?.startsWith('audio/') && (
                            <div className="msg-voice-bubble">
                              <MicIcon size={18} color="rgba(255,255,255,0.85)" />
                              <AuthAudio
                                src={`http://localhost:8080/api/catalog/${m.attachmentId}/download`}
                                token={accessToken ?? ''}
                              />
                            </div>
                          )}
                          {m.attachmentId && isImage(m.attachmentContentType) && (
                            <div style={{ cursor: 'zoom-in', position: 'relative' }}
                              onClick={() => setMsgPreview(m)}>
                              <AuthImage
                                src={`http://localhost:8080/api/catalog/${m.attachmentId}/download`}
                                alt={m.attachmentName}
                                className="msg-bubble-img"
                                token={accessToken ?? ''}
                              />
                              <div className="msg-img-zoom-hint">Voir en grand</div>
                            </div>
                          )}
                          {m.attachmentId && !isImage(m.attachmentContentType) && (
                            <button className="msg-bubble-doc"
                              onClick={() => setMsgPreview(m)}>
                              <span className="msg-bubble-doc-icon">
                                {m.attachmentContentType?.includes('pdf') ? '📄' :
                                 m.attachmentContentType?.includes('word') ? '📝' :
                                 m.attachmentContentType?.includes('sheet') || m.attachmentContentType?.includes('excel') ? '📊' :
                                 '📎'}
                              </span>
                              <div>
                                <div className="msg-bubble-doc-name">{m.attachmentName}</div>
                                {m.attachmentSize > 0 && <div className="msg-bubble-doc-size">{formatFileSize(m.attachmentSize)}</div>}
                              </div>
                            </button>
                          )}
                        </div>
                        {mine && (
                          <div className="msg-actions">
                            <button className="msg-action-btn" title="Modifier"
                              onClick={() => { setEditingId(m.id); setEditText(m.text) }}>✏️</button>
                            <button className="msg-action-btn msg-action-delete" title="Supprimer"
                              onClick={() => deleteMsg(selected.id, m.id)}>🗑️</button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="msg-bubble-time">
                      {m.createdAt?.substring(11, 16) ?? ''}
                      {m.editedAt && <span className="msg-edited"> · modifié</span>}
                      {mine && <span className="msg-read-status">{m.read ? ' · Lu' : ' · Envoyé'}</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="msg-chat-input-area">
              {/* Aperçu du fichier sélectionné */}
              {/* Lightbox aperçu local avant envoi */}
              {localPreview && (
                <div className="lightbox-overlay" onClick={() => { setLocalPreview(null); URL.revokeObjectURL(localPreview.url) }}>
                  <div className="lightbox-content doc-preview-modal" onClick={e => e.stopPropagation()}>
                    <button className="lightbox-close" onClick={() => { setLocalPreview(null); URL.revokeObjectURL(localPreview.url) }}>✕</button>
                    <div className="doc-preview-header">
                      <span style={{ fontSize: 32 }}>
                        {localPreview.file.type.includes('pdf') ? '📄' : localPreview.file.type.includes('word') ? '📝' : localPreview.file.type.startsWith('image/') ? '🖼' : '📎'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700 }}>{localPreview.file.name}</div>
                        <div className="muted" style={{ fontSize: 13 }}>{formatFileSize(localPreview.file.size)}</div>
                      </div>
                    </div>
                    {localPreview.file.type.startsWith('image/') && (
                      <img src={localPreview.url} alt={localPreview.file.name} className="lightbox-img" />
                    )}
                    {localPreview.file.type.includes('pdf') && (
                      <iframe src={localPreview.url} className="doc-preview-iframe" title={localPreview.file.name} />
                    )}
                    {localPreview.file.type.startsWith('text/') && (
                      <LocalTextReader file={localPreview.file} />
                    )}
                    {!localPreview.file.type.startsWith('image/') && !localPreview.file.type.includes('pdf') && !localPreview.file.type.startsWith('text/') && (
                      <div className="doc-preview-no-preview">
                        <p className="muted">Aperçu non disponible pour ce format.<br />Le fichier sera envoyé tel quel.</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
                      <button className="btn primary" onClick={() => { setLocalPreview(null); URL.revokeObjectURL(localPreview.url) }}>
                        Fermer l'aperçu
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {attachFile && (
                <div className="msg-attach-preview">
                  {attachFile.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(attachFile)} alt="" className="msg-attach-preview-img"
                      style={{ cursor: 'zoom-in' }}
                      onClick={() => setLocalPreview({ file: attachFile, url: URL.createObjectURL(attachFile) })} />
                  ) : (
                    <button className="msg-attach-preview-doc" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, font: 'inherit' }}
                      onClick={() => setLocalPreview({ file: attachFile, url: URL.createObjectURL(attachFile) })}>
                      {attachFile.type.includes('pdf') ? '📄' : attachFile.type.includes('word') ? '📝' : '📎'}
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{attachFile.name}</span>
                      <span className="muted" style={{ fontSize: 11 }}>— Cliquer pour aperçu</span>
                    </button>
                  )}
                  <button className="msg-attach-remove" onClick={() => setAttachFile(null)}>✕</button>
                </div>
              )}
              <div className="msg-chat-input-bar">
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  style={{ display: 'none' }}
                  ref={el => { fileInputRef.current = el }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setAttachFile(f); setError(null) }
                    e.target.value = ''
                  }}
                />

                {/* ── Mode enregistrement en cours ── */}
                {isRecording ? (
                  <>
                    <button className="msg-attach-btn" style={{ color: 'var(--bad)' }}
                      title="Annuler" onClick={cancelRecording}>✕</button>
                    <div className="msg-recording-indicator">
                      <span className="msg-recording-dot" />
                      <span>{fmtTime(recordingTime)}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>Enregistrement…</span>
                    </div>
                    <button className="msg-send-btn msg-send-btn-record" onClick={stopRecording}>
                      ■
                    </button>
                  </>
                ) : audioBlob && audioPreviewUrl ? (
                  /* ── Aperçu vocal avant envoi ── */
                  <>
                    <button className="msg-attach-btn" style={{ color: 'var(--bad)' }}
                      title="Annuler" onClick={cancelRecording}>✕</button>
                    <div className="msg-audio-preview">
                      <MicIcon size={20} color="var(--accent)" />
                      <audio src={audioPreviewUrl} controls className="msg-audio-player" />
                      <span className="muted" style={{ fontSize: 12 }}>{fmtTime(recordingTime)}</span>
                    </div>
                    <button className="msg-send-btn" disabled={sending} onClick={sendVoiceMessage}>
                      ➤
                    </button>
                  </>
                ) : (
                  /* ── Barre normale ── */
                  <>
                    {/* Menu pièce jointe */}
                    <div style={{ position: 'relative' }}>
                      <button className="msg-attach-btn" title="Joindre un fichier"
                        onClick={() => setShowAttachMenu(v => !v)} disabled={sending}>
                        📎
                      </button>
                      {showAttachMenu && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                            onClick={() => setShowAttachMenu(false)} />
                          <div className="attach-menu">
                            <button className="attach-menu-item" onClick={() => {
                              setShowAttachMenu(false)
                              fileInputRef.current?.click()
                            }}>
                              <span>Depuis mon appareil</span>
                              <span className="muted" style={{ fontSize: 11 }}>Photo, document, fichier…</span>
                            </button>
                            <button className="attach-menu-item" onClick={async () => {
                              setShowAttachMenu(false)
                              try {
                                const res = await apiGet<any>('/api/catalog?size=100', accessToken ?? undefined)
                                setCatalogFiles(res.items ?? [])
                              } catch { setCatalogFiles([]) }
                              setCatalogPicker(true)
                            }}>
                              <span>Depuis le catalogue</span>
                              <span className="muted" style={{ fontSize: 11 }}>
                                {role === 'CLIENT' ? 'Fichiers sauvegardés du centre' : 'Documents à prescrire aux clients'}
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <input className="msg-input"
                      placeholder="Écrivez un message… (Entrée pour envoyer)"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
                      disabled={sending}
                    />
                    {!text.trim() && !attachFile ? (
                      <button className="msg-voice-btn" title="Message vocal"
                        onClick={startRecording} disabled={sending}>
                        <MicIcon size={22} />
                      </button>
                    ) : (
                      <button className="msg-send-btn"
                        disabled={(!text.trim() && !attachFile) || sending}
                        onClick={sendMessage}>
                        ➤
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="msg-chat-placeholder">
            <h3>Vos messages</h3>
            <p>Sélectionnez une conversation ou écrivez à un membre de l'équipe.</p>
            <button className="btn primary" onClick={openPicker}>✏️ Nouvelle conversation</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

const CATALOG_CATEGORIES = ['Régimes', 'Exercices', 'Bilans', 'Programmes', 'Résultats', 'Autre']

// ─── Carte catalogue ──────────────────────────────────────────────────────────

function CatalogCard({ a, token, isStaff, onDelete, onPreview }: {
  a: any; token: string; isStaff: boolean
  onDelete: () => void; onPreview: (item: any) => void
}) {
  const img = a.contentType?.startsWith('image/')
  return (
    <div className="catalog-card">
      {/* Zone visuelle : miniature pour images, icône pour docs */}
      <div className="catalog-card-visual"
        style={{ cursor: img ? 'zoom-in' : 'default' }}
        onClick={() => img && onPreview(a)}>
        {img ? (
          <AuthImage
            src={`http://localhost:8080/api/catalog/${a.id}/download`}
            alt={a.originalFilename}
            className="catalog-card-thumb"
            token={token}
          />
        ) : (
          <div className="catalog-card-icon">{fileIcon(a.contentType)}</div>
        )}
        {img && <div className="catalog-card-zoom-hint">Aperçu</div>}
      </div>
      <div className="catalog-card-name" title={a.originalFilename}>{a.originalFilename}</div>
      <div className="catalog-card-meta">{a.createdAt?.substring(0, 10)}</div>
      <button className="btn btn-sm primary" style={{ marginTop: 8, width: '100%' }}
        onClick={() => downloadWithAuth(
          `http://localhost:8080/api/catalog/${a.id}/download`,
          a.originalFilename, token)}>
        Télécharger
      </button>
      {isStaff && (
        <button className="btn btn-sm" style={{ marginTop: 4, width: '100%', color: 'var(--bad)', borderColor: 'rgba(220,38,38,0.3)' }}
          onClick={onDelete}>
          Supprimer
        </button>
      )}
    </div>
  )
}

// ─── Lightbox image ────────────────────────────────────────────────────────────

function ImageLightbox({ item, token, onClose, onSave }: {
  item: any; token: string; onClose: () => void
  onSave?: (id: number) => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <div className="lightbox-filename">{item.originalFilename}</div>
        <AuthImage
          src={`http://localhost:8080/api/catalog/${item.id}/download`}
          alt={item.originalFilename}
          className="lightbox-img"
          token={token}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary"
            onClick={() => downloadWithAuth(
              `http://localhost:8080/api/catalog/${item.id}/download`,
              item.originalFilename, token)}>
            Télécharger
          </button>
          {onSave && (
            <button className="btn" style={{ color: 'var(--ok)', borderColor: 'rgba(21,128,61,0.3)' }}
              onClick={() => { onSave(item.id); onClose() }}>
              Sauvegarder dans mon catalogue
            </button>
          )}
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

function fileIcon(contentType: string) {
  if (contentType?.startsWith('image/'))        return '🖼'
  if (contentType?.includes('pdf'))             return '📄'
  if (contentType?.includes('word'))            return '📝'
  if (contentType?.includes('sheet') || contentType?.includes('excel')) return '📊'
  if (contentType?.includes('zip') || contentType?.includes('compressed')) return '🗜'
  return '📎'
}

function Catalog({ auth }: { auth: AuthCtx }) {
  const { accessToken, role } = auth
  const isStaff = role !== 'CLIENT'

  const [items, setItems]         = useState<any[]>([])
  const [error, setError]         = useState<string | null>(null)
  const [file, setFile]           = useState<File | null>(null)
  const [category, setCategory]   = useState(CATALOG_CATEGORIES[0])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [previewItem, setPreviewItem] = useState<any | null>(null)

  async function load() {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await apiGet<any>('/api/catalog?size=100', accessToken)
      setItems(res.items ?? [])
    } catch { /**/ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function upload() {
    if (!file || !accessToken) return
    setUploading(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      const res = await fetch('http://localhost:8080/api/catalog/upload', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form,
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(`Erreur upload (${res.status}) ${msg}`)
      }
      setFile(null)
      await load()
    } catch (e: any) { setError(e?.message ?? 'Erreur upload') }
    finally { setUploading(false) }
  }

  const filtered = activeTab === 'all' ? items : items.filter(i => i.category === activeTab)

  // Grouper par catégorie
  const byCategory = CATALOG_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat)
    return acc
  }, {} as Record<string, any[]>)
  const uncategorized = items.filter(i => !i.category || !CATALOG_CATEGORIES.includes(i.category))

  return (
    <main className="container">
      {/* Lightbox aperçu image */}
      {previewItem && (
        <ImageLightbox item={previewItem} token={accessToken ?? ''} onClose={() => setPreviewItem(null)} />
      )}

      <div className="panel-row" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackBtn />
          <h1 style={{ margin: 0 }}>Catalogue de documents</h1>
        </div>
        <button className="btn btn-sm" onClick={load} disabled={loading}>{loading ? '…' : '↻'}</button>
      </div>

      {/* Formulaire upload (staff uniquement) */}
      {isStaff && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Ajouter un document</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: '1 1 200px' }}>Catégorie
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {CATALOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ flex: '2 1 260px' }}>Fichier
              <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button className="btn primary" disabled={!file || uploading} onClick={upload}
              style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
              {uploading ? 'Envoi…' : 'Ajouter au catalogue'}
            </button>
          </div>
          {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {/* Sections par catégorie */}
      {activeTab === 'all' ? (
        <>
          {CATALOG_CATEGORIES.map(cat => {
            const catItems = byCategory[cat] ?? []
            if (!isStaff && catItems.length === 0) return null
            return (
              <div key={cat} className="panel" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{cat}</h2>
                  <span className="muted" style={{ fontSize: 12 }}>{catItems.length} fichier{catItems.length !== 1 ? 's' : ''}</span>
                </div>
                {catItems.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>Aucun document dans cette catégorie.</p>
                ) : (
                  <div className="catalog-grid">
                    {catItems.map(a => (
                      <CatalogCard key={a.id} a={a} token={accessToken ?? ''} isStaff={isStaff}
                        onPreview={setPreviewItem}
                        onDelete={async () => {
                          await fetch(`http://localhost:8080/api/catalog/${a.id}`, {
                            method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }
                          }); await load()
                        }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {uncategorized.length > 0 && (
            <div className="panel" style={{ marginBottom: 14 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>Sans catégorie</h2>
              <div className="catalog-grid">
                {uncategorized.map(a => (
                  <CatalogCard key={a.id} a={a} token={accessToken ?? ''} isStaff={isStaff}
                    onPreview={setPreviewItem}
                    onDelete={async () => {
                      await fetch(`http://localhost:8080/api/catalog/${a.id}`, {
                        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }
                      }); await load()
                    }} />
                ))}
              </div>
            </div>
          )}
          {items.length === 0 && !loading && (
            <div className="panel">
              <p className="muted" style={{ textAlign: 'center', padding: '32px 0', margin: 0 }}>
                {isStaff ? 'Aucun document dans le catalogue. Ajoutez le premier document ci-dessus.' : 'Aucun document partagé avec vous pour l\'instant.'}
              </p>
            </div>
          )}
        </>
      ) : null}
    </main>
  )
}

// ─── Mes Clients ─────────────────────────────────────────────────────────────

function ClientsPage({ auth }: { auth: AuthCtx }) {
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const nav = useNavigate()

  async function load(q?: string) {
    setLoading(true); setError(null)
    try {
      const url = q ? `/api/users/clients?q=${encodeURIComponent(q)}` : '/api/users/clients'
      const res = await apiGet<any[]>(url, auth.accessToken ?? undefined)
      setClients(Array.isArray(res) ? res : [])
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function displayName(c: any) {
    if (c.firstName || c.lastName) return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
    return c.email.split('@')[0]
  }

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackBtn />
            <h1 style={{ margin: 0 }}>Mes clients</h1>
          </div>
          <button className="btn" onClick={() => load(search)} disabled={loading}>{loading ? '…' : '↻'}</button>
        </div>

        {/* Barre de recherche */}
        <div style={{ margin: '14px 0', position: 'relative' }}>
          <input
            placeholder="🔍 Rechercher par nom ou email…"
            value={search}
            onChange={e => { setSearch(e.target.value); load(e.target.value) }}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {error && <div className="error">{error}</div>}
        {clients.length === 0 && !loading && (
          <p className="muted" style={{ marginTop: 12 }}>
            {search ? 'Aucun résultat pour cette recherche.' : 'Aucun client trouvé.'}
          </p>
        )}
        <div className="list" style={{ marginTop: 4 }}>
          {clients.map((c) => (
            <div key={c.id} className="list-item client-row"
              onClick={() => nav(`/mes-clients/${c.id}`)}
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="client-avatar" style={{ background: c.gender === 'F' ? 'rgba(200,0,94,0.12)' : 'rgba(0,111,168,0.12)', color: c.gender === 'F' ? 'var(--accent)' : 'var(--accent-2)' }}>
                  {displayName(c).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="list-title">{displayName(c)}</div>
                  <div className="list-meta">{c.email} · Inscrit le {c.createdAt?.substring(0, 10) ?? '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={roleBadgeClass('CLIENT')}>Client</span>
                {!c.enabled && <span style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 700 }}>Désactivé</span>}
                <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Dossier client ───────────────────────────────────────────────────────────

const APPT_TYPE_LABELS: Record<string, string>   = { CONSULTATION: 'Consultation', SUIVI: 'Suivi', BILAN: 'Bilan' }
const APPT_STATUS_LABELS: Record<string, string> = { PENDING: 'En attente', CONFIRMED: 'Confirmé', CANCELLED: 'Annulé' }
const APPT_STATUS_CLR: Record<string, string>    = { PENDING: 'var(--warn)', CONFIRMED: 'var(--ok)', CANCELLED: 'var(--bad)' }

function ClientDossierPage({ auth }: { auth: AuthCtx }) {
  const { id: paramId } = useParams<{ id: string }>()
  const clientId = paramId ? Number(paramId) : auth.userId

  const [dossier, setDossier]   = useState<any | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Ajout mesure (staff)
  const [wkg, setWkg]     = useState('')
  const [hcm, setHcm]     = useState('')
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10))
  const [wNotes, setWNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddWeight, setShowAddWeight] = useState(false)

  const isStaff = auth.role !== 'CLIENT'
  const nav = useNavigate()

  async function load() {
    if (!clientId) return
    setLoading(true); setError(null)
    try {
      const res = await apiGet<any>(`/api/users/${clientId}/dossier`, auth.accessToken ?? undefined)
      setDossier(res)
    } catch (e: any) { setError(e?.error ?? 'Erreur chargement') }
    finally { setLoading(false) }
  }

  async function addWeight() {
    if (!wkg) return
    setSaving(true)
    try {
      await apiPost('/api/weight', {
        weightKg: parseFloat(wkg), heightCm: hcm ? parseFloat(hcm) : null,
        date: wDate, notes: wNotes || null,
        clientId: isStaff ? clientId : undefined,
      }, auth.accessToken ?? undefined)
      setWkg(''); setHcm(''); setWNotes(''); setShowAddWeight(false)
      load()
    } catch { /**/ } finally { setSaving(false) }
  }

  useEffect(() => { load() }, [clientId])

  if (loading) return <main className="container"><p className="muted" style={{ marginTop: 24 }}>Chargement du dossier…</p></main>
  if (error)   return <main className="container"><div className="error" style={{ marginTop: 24 }}>{error}</div></main>
  if (!dossier) return null

  const { user: u, weightEntries, appointments, threadCount } = dossier
  const lastWeight = weightEntries.length ? weightEntries[weightEntries.length - 1] : null
  const firstWeight = weightEntries.length ? weightEntries[0] : null
  const displayName = (u.firstName || u.lastName) ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : u.email.split('@')[0]

  return (
    <main className="container">
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BackBtn />
        <h1 style={{ margin: 0 }}>Dossier client</h1>
        <button className="btn btn-sm" onClick={load}>↻</button>
        <button className="btn btn-sm" style={{ marginLeft: 'auto' }}
          onClick={() => downloadWithAuth(
            `http://localhost:8080/api/users/${clientId}/dossier/pdf`,
            `dossier-client.pdf`, auth.accessToken ?? '')}>
          Exporter PDF
        </button>
      </div>

      {/* Carte identité */}
      <div className="panel dossier-header">
        <div className="dossier-avatar" style={{ background: u.gender === 'F' ? 'rgba(200,0,94,0.12)' : 'rgba(0,111,168,0.12)', color: u.gender === 'F' ? 'var(--accent)' : 'var(--accent-2)' }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{displayName}</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{u.email}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {u.gender && <span className="dossier-chip">{u.gender === 'F' ? '♀ Femme' : '♂ Homme'}</span>}
            <span className="dossier-chip">Membre depuis {u.createdAt?.substring(0, 10) ?? '—'}</span>
            <span className="dossier-chip" style={{ color: u.enabled ? 'var(--ok)' : 'var(--bad)', borderColor: u.enabled ? 'rgba(21,128,61,0.3)' : 'rgba(220,38,38,0.3)' }}>
              {u.enabled ? '✓ Actif' : '✕ Désactivé'}
            </span>
          </div>
        </div>
        {isStaff && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
            <button className="btn btn-sm primary" onClick={() => nav('/messagerie')}>Message</button>
            <button className="btn btn-sm" onClick={() => nav('/planning')}>Rendez-vous</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stat-cards" style={{ marginBottom: 16 }}>
        <div className="stat-card">
                    <div className="stat-value">{appointments.length}</div>
          <div className="stat-label">Consultations</div>
        </div>
        <div className="stat-card">
                    <div className="stat-value">{weightEntries.length}</div>
          <div className="stat-label">Mesures poids</div>
        </div>
        {lastWeight && (
          <div className="stat-card">
                        <div className="stat-value">{lastWeight.weightKg} <span className="stat-unit">kg</span></div>
            <div className="stat-label">Dernier poids</div>
            <div className="stat-sub">{lastWeight.date}</div>
          </div>
        )}
        {lastWeight?.bmi && (
          <div className="stat-card">
                        <div className="stat-value" style={{ color: lastWeight.bmi < 18.5 ? 'var(--warn)' : lastWeight.bmi < 25 ? 'var(--ok)' : lastWeight.bmi < 30 ? 'var(--warn)' : 'var(--bad)' }}>
              {lastWeight.bmi}
            </div>
            <div className="stat-label">IMC actuel</div>
            <div className="stat-sub">{lastWeight.bmi < 18.5 ? 'Insuffisant' : lastWeight.bmi < 25 ? 'Normal ✓' : lastWeight.bmi < 30 ? 'Surpoids' : 'Obésité'}</div>
          </div>
        )}
        {weightEntries.length > 1 && (
          <div className="stat-card">
                        <div className="stat-value" style={{ color: weightEntries[weightEntries.length-1].weightKg < firstWeight.weightKg ? 'var(--ok)' : 'var(--warn)' }}>
              {(weightEntries[weightEntries.length-1].weightKg - firstWeight.weightKg).toFixed(1)} <span className="stat-unit">kg</span>
            </div>
            <div className="stat-label">Évolution totale</div>
          </div>
        )}
        <div className="stat-card">
                    <div className="stat-value">{threadCount}</div>
          <div className="stat-label">Conversations</div>
        </div>
      </div>

      {/* Section poids */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Suivi poids & IMC</h2>
          {isStaff && (
            <button className="btn btn-sm primary" onClick={() => setShowAddWeight(v => !v)}>
              {showAddWeight ? '✕ Annuler' : '+ Ajouter mesure'}
            </button>
          )}
        </div>

        {showAddWeight && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
            <label>Date <input type="date" value={wDate} onChange={e => setWDate(e.target.value)} /></label>
            <label>Poids (kg) <input type="number" step="0.1" value={wkg} onChange={e => setWkg(e.target.value)} placeholder="72.5" /></label>
            <label>Taille (cm) <input type="number" step="1" value={hcm} onChange={e => setHcm(e.target.value)} placeholder="168" /></label>
            <label>Notes <input value={wNotes} onChange={e => setWNotes(e.target.value)} placeholder="optionnel" /></label>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn primary" onClick={addWeight} disabled={!wkg || saving} style={{ width: '100%' }}>
                {saving ? '…' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {weightEntries.length >= 2 && <WeightChart entries={weightEntries} />}
        {weightEntries.length === 0 && <p className="muted">Aucune mesure enregistrée.</p>}

        {weightEntries.length > 0 && (
          <div className="list" style={{ marginTop: 10 }}>
            {[...weightEntries].reverse().map((e: any) => (
              <div key={e.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="list-title">{e.weightKg} kg {e.bmi ? <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· IMC {e.bmi}</span> : ''}</div>
                  <div className="list-meta">{e.date}{e.heightCm ? ` · ${e.heightCm} cm` : ''}{e.notes ? ` · ${e.notes}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section rendez-vous */}
      <div className="panel">
        <h2 style={{ margin: '0 0 14px', fontSize: 17 }}>Rendez-vous & Consultations</h2>
        {appointments.length === 0 && <p className="muted">Aucun rendez-vous enregistré.</p>}
        <div className="list">
          {[...appointments].reverse().map((a: any) => (
            <div key={a.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="list-title">
                  {APPT_TYPE_LABELS[a.type] ?? a.type}
                  <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
                    {' · '}{fmtAppt(a.scheduledAt)}
                  </span>
                </div>
                {a.staffName && <div className="list-sub">Avec : {a.staffName}</div>}
                {a.notes && <div className="list-sub">{a.notes}</div>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: APPT_STATUS_CLR[a.status] ?? 'var(--muted)', padding: '3px 10px', border: '1px solid currentColor', borderRadius: 999 }}>
                {APPT_STATUS_LABELS[a.status] ?? a.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Suivi poids / IMC ────────────────────────────────────────────────────────

function WeightChart({ entries }: { entries: any[] }) {
  if (entries.length < 2) return null
  const W = 600, H = 200, PX = 52, PY = 20
  const times   = entries.map(e => new Date(e.date).getTime())
  const weights = entries.map(e => e.weightKg as number)
  const minT = Math.min(...times), maxT = Math.max(...times)
  const minW = Math.min(...weights) - 1, maxW = Math.max(...weights) + 1

  const cx = (t: number) => PX + ((t - minT) / ((maxT - minT) || 1)) * (W - PX * 2)
  const cy = (w: number) => PY + (1 - (w - minW) / ((maxW - minW) || 1)) * (H - PY * 2)

  const pathD = entries.map((e, i) => {
    const x = cx(new Date(e.date).getTime()), y = cy(e.weightKg)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const areaD = `${pathD} L ${cx(times[times.length - 1])} ${H - PY} L ${cx(times[0])} ${H - PY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 200, display: 'block' }}>
      <defs>
        <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[minW, (minW + maxW) / 2, maxW].map((w, i) => (
        <g key={i}>
          <line x1={PX} y1={cy(w)} x2={W - PX} y2={cy(w)} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={PX - 6} y={cy(w) + 4} fontSize={10} fill="var(--muted)" textAnchor="end">{w.toFixed(1)}</text>
        </g>
      ))}
      <path d={areaD} fill="url(#wgrad)" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {entries.map((e) => (
        <circle key={e.id} cx={cx(new Date(e.date).getTime())} cy={cy(e.weightKg)} r={4} fill="var(--accent)" />
      ))}
    </svg>
  )
}

function WeightPage({ auth }: { auth: AuthCtx }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [wkg, setWkg]         = useState('')
  const [hcm, setHcm]         = useState('')
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    apiGet<any>('/api/profile', auth.accessToken ?? undefined).then(setProfile).catch(() => {})
  }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<any[]>('/api/weight', auth.accessToken ?? undefined)
      setEntries(Array.isArray(res) ? res : [])
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setLoading(false) }
  }

  async function addEntry() {
    if (!wkg) return
    setSaving(true); setError(null)
    try {
      await apiPost('/api/weight', {
        weightKg: parseFloat(wkg),
        heightCm: hcm ? parseFloat(hcm) : null,
        date, notes: notes || null,
      }, auth.accessToken ?? undefined)
      setWkg(''); setNotes('')
      await load()
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setSaving(false) }
  }

  async function deleteEntry(id: number) {
    try {
      await fetch(`http://localhost:8080/api/weight/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${auth.accessToken}` }
      })
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch { /**/ }
  }

  useEffect(() => { load() }, [])

  const last = entries[entries.length - 1]

  return (
    <main className="container">
      <div style={{ marginBottom: 16 }}><BackBtn /></div>

      {/* Alerte si âge non renseigné */}
      {!profile?.dateOfBirth && (
        <div style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.2)', borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, color: 'var(--warn)' }}>
          Votre date de naissance n'est pas renseignée.{' '}
          <a href="/profil" style={{ color: 'var(--accent)', fontWeight: 700 }}>Compléter mon profil</a>
          {' '}pour inclure votre âge dans votre dossier médical.
        </div>
      )}

      {/* Résumé actuel */}
      {last && (
        <div className="stat-cards" style={{ marginBottom: 16 }}>
          {profile?.age > 0 && (
            <div className="stat-card">
              <div className="stat-value">{profile.age} <span className="stat-unit">ans</span></div>
              <div className="stat-label">Âge</div>
              <div className="stat-sub">{profile.dateOfBirth}</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-value">{last.weightKg} <span className="stat-unit">kg</span></div>
            <div className="stat-label">Dernier poids</div>
            <div className="stat-sub">{last.date}</div>
          </div>
          {last.bmi && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: last.bmi < 18.5 ? 'var(--warn)' : last.bmi < 25 ? 'var(--ok)' : last.bmi < 30 ? 'var(--warn)' : 'var(--bad)' }}>
                {last.bmi}
              </div>
              <div className="stat-label">IMC</div>
              <div className="stat-sub">{last.bmi < 18.5 ? 'Insuffisant' : last.bmi < 25 ? 'Normal ✓' : last.bmi < 30 ? 'Surpoids' : 'Obésité'}</div>
            </div>
          )}
          {entries.length > 1 && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: entries[entries.length-1].weightKg < entries[0].weightKg ? 'var(--ok)' : 'var(--warn)' }}>
                {(entries[entries.length-1].weightKg - entries[0].weightKg).toFixed(1)} <span className="stat-unit">kg</span>
              </div>
              <div className="stat-label">Évolution totale</div>
              <div className="stat-sub">depuis le {entries[0].date}</div>
            </div>
          )}
        </div>
      )}

      {/* Graphique */}
      {entries.length >= 2 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Courbe de poids</h2>
          <WeightChart entries={entries} />
        </div>
      )}

      {/* Ajouter une mesure */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Ajouter une mesure</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <label>Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>Poids (kg)
            <input type="number" step="0.1" min="20" max="300" value={wkg} onChange={e => setWkg(e.target.value)} placeholder="ex: 72.5" />
          </label>
          <label>Taille (cm)
            <input type="number" step="1" min="100" max="250" value={hcm} onChange={e => setHcm(e.target.value)} placeholder="ex: 168" />
          </label>
          <label>Notes
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optionnel" />
          </label>
        </div>
        {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
        <button className="btn primary" style={{ marginTop: 12 }} onClick={addEntry} disabled={!wkg || saving}>
          {saving ? 'Enregistrement…' : '+ Enregistrer'}
        </button>
      </div>

      {/* Historique */}
      <div className="panel">
        <div className="panel-row">
          <h2 style={{ margin: 0, fontSize: 16 }}>Historique</h2>
          <button className="btn btn-sm" onClick={load} disabled={loading}>{loading ? '…' : '↻ Charger'}</button>
        </div>
        {entries.length === 0 && !loading && <p className="muted" style={{ marginTop: 10 }}>Aucune mesure enregistrée.</p>}
        <div className="list" style={{ marginTop: 10 }}>
          {[...entries].reverse().map(e => (
            <div key={e.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="list-title">{e.weightKg} kg {e.bmi ? <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· IMC {e.bmi}</span> : ''}</div>
                <div className="list-meta">{e.date}{e.notes ? ` · ${e.notes}` : ''}</div>
              </div>
              <button className="btn btn-sm" style={{ color: 'var(--bad)', borderColor: 'rgba(220,38,38,0.3)' }} onClick={() => deleteEntry(e.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Planning / Rendez-vous ───────────────────────────────────────────────────

const APPT_TYPES = ['CONSULTATION', 'SUIVI', 'BILAN']
const APPT_TYPE_FR: Record<string, string> = { CONSULTATION: 'Consultation', SUIVI: 'Suivi', BILAN: 'Bilan' }
const APPT_STATUS_FR: Record<string, string> = { PENDING: 'En attente', CONFIRMED: 'Confirmé', CANCELLED: 'Annulé' }
const APPT_STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--warn)', CONFIRMED: 'var(--ok)', CANCELLED: 'var(--bad)'
}

function PlanningPage({ auth }: { auth: AuthCtx }) {
  const [appts, setAppts]       = useState<any[]>([])
  const [clients, setClients]   = useState<any[]>([])
  const [staff, setStaff]       = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'week'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [date, setDate]         = useState('')
  const [time, setTime]         = useState('09:00')
  const [type, setType]         = useState('CONSULTATION')
  const [notes, setNotes]       = useState('')
  const [clientId, setClientId] = useState('')
  const [staffId, setStaffId]   = useState('')
  const [saving, setSaving]     = useState(false)
  const isClient = auth.role === 'CLIENT'

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<any[]>('/api/appointments', auth.accessToken ?? undefined)
      setAppts(Array.isArray(res) ? res : [])
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function loadClientsAndStaff() {
    try {
      if (!isClient) {
        const c = await apiGet<any[]>('/api/users/clients', auth.accessToken ?? undefined)
        setClients(Array.isArray(c) ? c : [])
      }
      const s = await apiGet<any[]>('/api/messaging/staff', auth.accessToken ?? undefined)
      setStaff(Array.isArray(s) ? s : [])
    } catch { /**/ }
  }

  async function create() {
    if (!date) return
    setSaving(true); setError(null)
    try {
      await apiPost('/api/appointments', {
        scheduledAt: `${date}T${time}:00`,
        type, notes: notes || null,
        clientId: isClient ? null : (clientId ? Number(clientId) : null),
        staffId: staffId ? Number(staffId) : null,
      }, auth.accessToken ?? undefined)
      setShowForm(false); setDate(''); setNotes(''); setClientId(''); setStaffId('')
      await load()
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setSaving(false) }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await fetch(`http://localhost:8080/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } catch { /**/ }
  }

  async function deleteAppt(id: number) {
    try {
      await fetch(`http://localhost:8080/api/appointments/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${auth.accessToken}` }
      })
      setAppts(prev => prev.filter(a => a.id !== id))
    } catch { /**/ }
  }

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackBtn />
            <h1 style={{ margin: 0 }}>Planning</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={load} disabled={loading}>{loading ? '…' : '↻'}</button>
            <div className="view-toggle">
              <button className={`view-toggle-btn${viewMode === 'week' ? ' active' : ''}`} onClick={() => setViewMode('week')}>Semaine</button>
              <button className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>Liste</button>
            </div>
            <button className="btn primary" onClick={() => { setShowForm(v => !v); loadClientsAndStaff() }}>
              {showForm ? '✕ Annuler' : '+ Nouveau'}
            </button>
          </div>
        </div>

        {showForm && (
          <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16, background: 'rgba(255,255,255,0.6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <label>Date
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <label>Heure
                <input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </label>
              <label>Type
                <select value={type} onChange={e => setType(e.target.value)}>
                  {APPT_TYPES.map(t => <option key={t} value={t}>{APPT_TYPE_FR[t]}</option>)}
                </select>
              </label>
              {!isClient && clients.length > 0 && (
                <label>Client
                  <select value={clientId} onChange={e => setClientId(e.target.value)}>
                    <option value="">— sélectionner —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
                  </select>
                </label>
              )}
              {staff.length > 0 && (
                <label>{isClient ? 'Avec' : 'Avec (staff)'}
                  <select value={staffId} onChange={e => setStaffId(e.target.value)}>
                    <option value="">— optionnel —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.email.split('@')[0]} ({ROLE_FR[s.role] ?? s.role})</option>)}
                  </select>
                </label>
              )}
              <label>Notes
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optionnel" />
              </label>
            </div>
            {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
            <button className="btn primary" style={{ marginTop: 12 }} onClick={create} disabled={!date || saving}>
              {saving ? 'Enregistrement…' : isClient ? 'Demander ce rendez-vous' : 'Créer le rendez-vous'}
            </button>
          </div>
        )}

        {appts.length === 0 && !loading && viewMode === 'list' && <p className="muted">Aucun rendez-vous.</p>}

        {/* ── Vue calendrier semaine ── */}
        {viewMode === 'week' && (() => {
          const today = new Date()
          const monday = new Date(today)
          monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i); return d
          })
          const hours = Array.from({ length: 11 }, (_, i) => i + 7) // 7h–17h
          const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
          const localStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const apptsByDay = (day: Date) => appts.filter(a => a.scheduledAt?.startsWith(localStr(day)))
          const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button className="btn btn-sm" onClick={() => setWeekOffset(w => w - 1)}>Semaine précédente</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {fmt(days[0])} – {fmt(days[6])}
                </span>
                <button className="btn btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Semaine suivante</button>
              </div>
              <div className="cal-grid">
                {/* En-têtes */}
                <div className="cal-hour-col" />
                {days.map((d, i) => (
                  <div key={i} className={`cal-day-header${d.toDateString() === today.toDateString() ? ' today' : ''}`}>
                    <div>{dayNames[i]}</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{d.getDate()}</div>
                  </div>
                ))}
                {/* Lignes heures */}
                {hours.map(h => (
                  <>
                    <div key={`h${h}`} className="cal-hour-label">{h}h</div>
                    {days.map((d, di) => {
                      const slot = apptsByDay(d).filter(a => {
                        const ah = parseInt(a.scheduledAt?.substring(11, 13) ?? '-1')
                        return ah === h
                      })
                      return (
                        <div key={`${h}-${di}`} className={`cal-cell${d.toDateString() === today.toDateString() ? ' today' : ''}`}>
                          {slot.map(a => (
                            <div key={a.id} className={`cal-event status-${a.status?.toLowerCase()}`}>
                              <div className="cal-event-time">{a.scheduledAt?.substring(11, 16)}</div>
                              <div className="cal-event-title">{APPT_TYPE_LABELS[a.type] ?? a.type}</div>
                              {a.clientEmail && !isClient && <div className="cal-event-client">{a.clientEmail.split('@')[0]}</div>}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </>
                ))}
              </div>
            </div>
          )
        })()}
        <div className="list">
          {appts.map(a => (
            <div key={a.id} className="list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="list-title">
                    {APPT_TYPE_FR[a.type] ?? a.type}
                    {a.scheduledAt && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {fmtAppt(a.scheduledAt)}</span>}
                  </div>
                  {a.clientEmail && !isClient && <div className="list-sub">Client : {a.clientEmail}</div>}
                  {a.staffEmail && <div className="list-sub">Avec : {a.staffEmail}</div>}
                  {a.notes && <div className="list-sub">{a.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: APPT_STATUS_COLOR[a.status] ?? 'var(--muted)', padding: '3px 10px', border: '1px solid currentColor', borderRadius: 999, opacity: 0.85 }}>
                    {APPT_STATUS_FR[a.status] ?? a.status}
                  </span>
                  {!isClient && a.status === 'PENDING' && (
                    <button className="btn btn-sm" style={{ color: 'var(--ok)' }} onClick={() => updateStatus(a.id, 'CONFIRMED')}>✓ Confirmer</button>
                  )}
                  {!isClient && a.status !== 'CANCELLED' && (
                    <button className="btn btn-sm" style={{ color: 'var(--bad)' }} onClick={() => updateStatus(a.id, 'CANCELLED')}>✕ Annuler</button>
                  )}
                  {isClient && a.status === 'PENDING' && (
                    <button className="btn btn-sm" style={{ color: 'var(--bad)' }} onClick={() => deleteAppt(a.id)}>✕</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Rapports ─────────────────────────────────────────────────────────────────

function ReportsPage({ auth }: { auth: AuthCtx }) {
  const [stats, setStats]       = useState<any | null>(null)
  const [clients, setClients]   = useState<any[]>([])
  const [dossiers, setDossiers] = useState<Record<number, any>>({})
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const nav = useNavigate()

  async function load() {
    setLoading(true); setError(null)
    try {
      const [statsRes, clientsRes] = await Promise.all([
        apiGet<any>('/api/users/stats', auth.accessToken ?? undefined),
        apiGet<any[]>('/api/users/clients', auth.accessToken ?? undefined),
      ])
      setStats(statsRes)
      const clientList = Array.isArray(clientsRes) ? clientsRes : []
      setClients(clientList)
      // Charger le dossier de chaque client en parallèle
      const dossierEntries = await Promise.all(
        clientList.map(c =>
          apiGet<any>(`/api/users/${c.id}/dossier`, auth.accessToken ?? undefined)
            .then(d => [c.id, d] as [number, any])
            .catch(() => [c.id, null] as [number, null])
        )
      )
      setDossiers(Object.fromEntries(dossierEntries))
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const STAT_ITEMS = stats ? [
    { icon: '👥', label: 'Clients',       value: stats.totalClients },
    { icon: '🧑‍⚕️', label: 'Staff',        value: stats.totalStaff },
    { icon: '💬', label: 'Messages',      value: stats.totalMessages },
    { icon: '🗨️', label: 'Conversations', value: stats.totalThreads },
    { icon: '⚖️', label: 'Mesures poids', value: stats.totalWeightEntries },
    { icon: '📅', label: 'Rendez-vous',   value: stats.totalAppointments },
  ] : []

  return (
    <main className="container">
      {/* Stats globales */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-row" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackBtn />
            <h1 style={{ margin: 0 }}>Rapports</h1>
          </div>
          <button className="btn" onClick={load} disabled={loading}>{loading ? '…' : '↻ Actualiser'}</button>
        </div>
        {error && <div className="error">{error}</div>}
        {stats && (
          <div className="stat-cards">
            {STAT_ITEMS.map(s => (
              <div key={s.label} className="stat-card">
                                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rapport clients */}
      <div className="panel">
        <div className="panel-row" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Rapport clients</h2>
          <button className="btn btn-sm primary" onClick={() => nav('/mes-clients')}>
            Voir tous les dossiers →
          </button>
        </div>

        {loading && <p className="muted">Chargement…</p>}
        {!loading && clients.length === 0 && <p className="muted">Aucun client enregistré.</p>}

        {clients.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Inscrit le</th>
                  <th>Dernier poids</th>
                  <th>IMC</th>
                  <th>Évolution</th>
                  <th>RDV</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => {
                  const d = dossiers[c.id]
                  const weights = d?.weightEntries ?? []
                  const appts   = d?.appointments ?? []
                  const last    = weights.length ? weights[weights.length - 1] : null
                  const first   = weights.length ? weights[0] : null
                  const evol    = weights.length > 1 ? (last.weightKg - first.weightKg).toFixed(1) : null
                  const name    = (c.firstName || c.lastName) ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : c.email.split('@')[0]
                  return (
                    <tr key={c.id} className="report-row" onClick={() => nav(`/mes-clients/${c.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email}</div>
                      </td>
                      <td>{c.createdAt?.substring(0, 10) ?? '—'}</td>
                      <td>{last ? `${last.weightKg} kg` : '—'}</td>
                      <td>
                        {last?.bmi ? (
                          <span style={{ fontWeight: 700, color: last.bmi < 18.5 ? 'var(--warn)' : last.bmi < 25 ? 'var(--ok)' : last.bmi < 30 ? 'var(--warn)' : 'var(--bad)' }}>
                            {last.bmi}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {evol !== null ? (
                          <span style={{ fontWeight: 700, color: Number(evol) < 0 ? 'var(--ok)' : 'var(--warn)' }}>
                            {Number(evol) > 0 ? '+' : ''}{evol} kg
                          </span>
                        ) : '—'}
                      </td>
                      <td>{appts.length}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.enabled ? 'var(--ok)' : 'var(--bad)' }}>
                          {c.enabled ? '✓ Actif' : '✕ Désactivé'}
                        </span>
                      </td>
                      <td><span style={{ color: 'var(--muted)' }}>›</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

const ALL_ROLES = ['CLIENT', 'SECRETARY', 'COACH', 'NUTRITIONIST', 'ADMIN', 'SUPER_ADMIN']

function UsersPage({ auth }: { auth: AuthCtx }) {
  const [userList, setUserList] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<any[]>('/api/users', auth.accessToken ?? undefined)
      setUserList(Array.isArray(res) ? res : [])
    } catch (e: any) { setError(e?.error ?? 'Erreur') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function deleteUser(id: number, email: string) {
    if (!window.confirm(`Supprimer définitivement le compte de "${email}" et toutes ses données ?\n\nCette action est irréversible.`)) return
    try {
      const res = await fetch(`http://localhost:8080/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
      if (res.ok) setUserList(prev => prev.filter(u => u.id !== id))
      else setError('Erreur lors de la suppression')
    } catch { setError('Erreur réseau') }
  }

  async function toggleEnabled(id: number, enabled: boolean) {
    try {
      const res = await fetch(`http://localhost:8080/api/users/${id}/enabled`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const updated = await res.json()
      setUserList(prev => prev.map(u => u.id === id ? updated : u))
    } catch { /**/ }
  }

  async function changeRole(id: number, role: string) {
    try {
      const res = await fetch(`http://localhost:8080/api/users/${id}/role`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const updated = await res.json()
      setUserList(prev => prev.map(u => u.id === id ? updated : u))
    } catch { /**/ }
  }

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackBtn />
            <h1 style={{ margin: 0 }}>Utilisateurs</h1>
          </div>
          <button className="btn" onClick={load} disabled={loading}>{loading ? '…' : '↻'}</button>
        </div>
        {error && <div className="error">{error}</div>}
        {userList.length === 0 && !loading && <p className="muted">Aucun utilisateur trouvé.</p>}
        <div className="list" style={{ marginTop: 8 }}>
          {userList.map(u => (
            <div key={u.id} className="list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="list-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {u.email}
                  {auth.userId === u.id && <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>(vous)</span>}
                </div>
                <div className="list-meta">Inscrit le {u.createdAt?.substring(0, 10) ?? '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Sélecteur de rôle */}
                {auth.userId !== u.id ? (
                  <select value={u.role} style={{ fontSize: 13, padding: '5px 8px' }}
                    onChange={e => changeRole(u.id, e.target.value)}>
                    {ALL_ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                ) : (
                  <span className={roleBadgeClass(u.role)}>{roleLabel(u.role)}</span>
                )}
                {/* Activer / désactiver */}
                {auth.userId !== u.id && (
                  <button
                    className="btn btn-sm"
                    style={{ color: u.enabled ? 'var(--ok)' : 'var(--bad)', borderColor: u.enabled ? 'rgba(21,128,61,0.3)' : 'rgba(220,38,38,0.3)' }}
                    onClick={() => toggleEnabled(u.id, !u.enabled)}
                  >
                    {u.enabled ? '✓ Actif' : '✕ Désactivé'}
                  </button>
                )}
                {/* Supprimer */}
                {auth.userId !== u.id && (
                  <button
                    className="btn btn-sm"
                    title="Supprimer définitivement"
                    style={{ color: 'var(--bad)', borderColor: 'rgba(220,38,38,0.3)' }}
                    onClick={() => deleteUser(u.id, u.email)}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Suivi clients ────────────────────────────────────────────────────────────

function SuiviClientsPage({ auth }: { auth: AuthCtx }) {
  const [programs, setPrograms] = useState<any[]>([])
  const [clients, setClients]   = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [newClientId, setNewClientId]         = useState('')
  const [newDuration, setNewDuration]         = useState(6)
  const [newStartDate, setNewStartDate]       = useState(new Date().toISOString().slice(0, 10))
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const [progs, cl] = await Promise.all([
        apiGet<any[]>('/api/programs', auth.accessToken ?? undefined),
        apiGet<any[]>('/api/users/clients', auth.accessToken ?? undefined),
      ])
      setPrograms(Array.isArray(progs) ? progs : [])
      setClients(Array.isArray(cl) ? cl : [])
    } catch { /**/ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function createProgram() {
    if (!newClientId) return
    setCreating(true)
    try {
      const p = await apiPost<any>('/api/programs', {
        clientId: Number(newClientId),
        durationWeeks: newDuration,
        startDate: newStartDate,
      }, auth.accessToken ?? undefined)
      setShowNew(false)
      nav(`/suivi-clients/${p.id}`)
    } catch { /**/ } finally { setCreating(false) }
  }

  const statusLabel: Record<string, string> = { ACTIVE: 'En cours', COMPLETED: 'Terminé', PAUSED: 'Suspendu' }
  const statusColor: Record<string, string> = { ACTIVE: 'var(--ok)', COMPLETED: 'var(--accent)', PAUSED: 'var(--warn)' }

  return (
    <main className="container">
      <div className="panel-row" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackBtn />
          <h1 style={{ margin: 0 }}>Suivi clients</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load} disabled={loading}>{loading ? '…' : '↻'}</button>
          <button className="btn primary" onClick={() => setShowNew(v => !v)}>
            {showNew ? '✕ Annuler' : '+ Nouveau programme'}
          </button>
        </div>
      </div>

      {/* Créer un nouveau programme */}
      {showNew && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Démarrer un programme de suivi</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <label>Client
              <select value={newClientId} onChange={e => setNewClientId(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {clients.map(c => {
                  const name = (c.firstName || c.lastName)
                    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
                    : c.email.split('@')[0]
                  return <option key={c.id} value={c.id}>{name}</option>
                })}
              </select>
            </label>
            <label>Durée du traitement
              <select value={newDuration} onChange={e => setNewDuration(Number(e.target.value))}>
                <option value={6}>6 semaines</option>
                <option value={7}>7 semaines</option>
                <option value={8}>8 semaines</option>
              </select>
            </label>
            <label>Date de début
              <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
            </label>
          </div>
          <button className="btn primary" style={{ marginTop: 14 }} disabled={!newClientId || creating}
            onClick={createProgram}>
            {creating ? 'Création…' : 'Créer le programme'}
          </button>
        </div>
      )}

      {/* Liste des programmes */}
      {programs.length === 0 && !loading ? (
        <div className="panel">
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0', margin: 0 }}>
            Aucun programme de suivi actif. Cliquez sur "Nouveau programme" pour démarrer.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {programs.map(p => {
            const pct = Math.round((p.completedWeeks / p.durationWeeks) * 100)
            return (
              <div key={p.id} className="panel program-card" onClick={() => nav(`/suivi-clients/${p.id}`)}
                style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.clientName}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{p.clientEmail}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[p.status] ?? 'var(--muted)',
                    padding: '3px 10px', border: '1px solid currentColor', borderRadius: 999 }}>
                    {statusLabel[p.status] ?? p.status}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                  {p.durationWeeks} semaines · Début : {p.startDate ?? '—'}
                  {p.staffName && auth.role === 'SUPER_ADMIN' && ` · Suivi par ${p.staffName}`}
                </div>
                {/* Barre de progression */}
                <div style={{ background: 'var(--border)', borderRadius: 999, height: 6, marginBottom: 6 }}>
                  <div style={{ background: p.status === 'COMPLETED' ? 'var(--ok)' : 'var(--accent)',
                    borderRadius: 999, height: 6, width: `${pct}%`, transition: 'width .4s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {p.completedWeeks}/{p.durationWeeks} semaines complétées ({pct}%)
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

// ─── Détail d'un programme de suivi ──────────────────────────────────────────

function ClientProgramPage({ auth }: { auth: AuthCtx }) {
  const { id } = useParams<{ id: string }>()
  const [program, setProgram]       = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [openWeek, setOpenWeek]     = useState<number | null>(null)
  const [saving, setSaving]         = useState(false)
  const [weekData, setWeekData]     = useState<Record<number, any>>({})
  const nav = useNavigate()

  async function load() {
    if (!id) return
    setLoading(true)
    try {
      const p = await apiGet<any>(`/api/programs/${id}`, auth.accessToken ?? undefined)
      setProgram(p)
      // Initialiser les données de chaque semaine
      const wd: Record<number, any> = {}
      p.weeks?.forEach((w: any) => { wd[w.weekNumber] = { ...w } })
      setWeekData(wd)
    } catch { /**/ } finally { setLoading(false) }
  }

  async function saveWeek(weekNumber: number) {
    if (!id) return
    setSaving(true)
    try {
      const d = weekData[weekNumber] ?? {}
      await apiPut(`/api/programs/${id}/weeks/${weekNumber}`, {
        objectives: d.objectives ?? '',
        plan:       d.plan       ?? '',
        results:    d.results    ?? '',
        notes:      d.notes      ?? '',
        completed:  d.completed  ?? false,
      }, auth.accessToken ?? undefined)
      await load()
    } catch { /**/ } finally { setSaving(false) }
  }

  async function updateStatus(status: string) {
    if (!id) return
    try {
      await apiPut(`/api/programs/${id}`, { status }, auth.accessToken ?? undefined)
      await load()
    } catch { /**/ }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <main className="container"><p className="muted" style={{ marginTop: 24 }}>Chargement…</p></main>
  if (!program) return <main className="container"><p className="error" style={{ marginTop: 24 }}>Programme introuvable.</p></main>

  const isStaff = auth.role !== 'CLIENT'
  const today   = new Date()
  const start   = program.startDate ? new Date(program.startDate) : null
  const currentWeek = start
    ? Math.min(program.durationWeeks, Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (7 * 86400000))))
    : null
  const pct = Math.round((program.completedWeeks / program.durationWeeks) * 100)

  const weekStatusColor = (w: any) => {
    if (w.completed) return 'var(--ok)'
    if (currentWeek && w.weekNumber === currentWeek) return 'var(--accent)'
    if (currentWeek && w.weekNumber < currentWeek) return 'var(--warn)'
    return 'var(--border)'
  }

  const weekLabel = (w: any) => {
    if (w.completed) return 'Terminée'
    if (currentWeek && w.weekNumber === currentWeek) return 'En cours'
    if (currentWeek && w.weekNumber < currentWeek) return 'En retard'
    return `Semaine ${w.weekNumber}`
  }

  return (
    <main className="container">
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BackBtn />
        <h1 style={{ margin: 0 }}>Programme de suivi</h1>
        {isStaff && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {program.status === 'ACTIVE' && (
              <button className="btn btn-sm" style={{ color: 'var(--ok)' }}
                onClick={() => updateStatus('COMPLETED')}>Marquer terminé</button>
            )}
            {program.status !== 'ACTIVE' && (
              <button className="btn btn-sm" onClick={() => updateStatus('ACTIVE')}>Réactiver</button>
            )}
          </div>
        )}
      </div>

      {/* Résumé du programme */}
      <div className="panel dossier-header" style={{ marginBottom: 16 }}>
        <div className="dossier-avatar" style={{ background: 'rgba(200,0,94,0.1)', color: 'var(--accent)' }}>
          {program.clientName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{program.clientName}</div>
          <div className="muted" style={{ fontSize: 13 }}>{program.clientEmail}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <span className="dossier-chip">{program.durationWeeks} semaines</span>
            {program.startDate && <span className="dossier-chip">Début : {program.startDate}</span>}
            {program.staffName && <span className="dossier-chip">Suivi par : {program.staffName}</span>}
            <span className="dossier-chip" style={{
              color: program.status === 'ACTIVE' ? 'var(--ok)' : 'var(--muted)',
              borderColor: program.status === 'ACTIVE' ? 'rgba(21,128,61,0.3)' : 'var(--border)'
            }}>
              {program.status === 'ACTIVE' ? 'En cours' : program.status === 'COMPLETED' ? 'Terminé' : 'Suspendu'}
            </span>
          </div>
        </div>
        {/* Progression globale */}
        <div style={{ minWidth: 140, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)' }}>{pct}%</div>
          <div className="muted" style={{ fontSize: 12 }}>{program.completedWeeks}/{program.durationWeeks} semaines</div>
          <div style={{ background: 'var(--border)', borderRadius: 999, height: 8, marginTop: 8 }}>
            <div style={{ background: pct === 100 ? 'var(--ok)' : 'var(--accent)',
              borderRadius: 999, height: 8, width: `${pct}%`, transition: 'width .4s' }} />
          </div>
        </div>
      </div>

      {/* Timeline des semaines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {program.weeks?.map((w: any) => {
          const isOpen = openWeek === w.weekNumber
          const d = weekData[w.weekNumber] ?? w

          return (
            <div key={w.weekNumber} className="panel" style={{
              border: `2px solid ${isOpen ? 'var(--accent)' : weekStatusColor(w)}20`,
              transition: 'border-color .2s'
            }}>
              {/* En-tête de la semaine */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setOpenWeek(isOpen ? null : w.weekNumber)}>
                {/* Indicateur coloré */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: weekStatusColor(w),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 15
                }}>
                  {w.completed ? '✓' : w.weekNumber}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>Semaine {w.weekNumber}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {weekLabel(w)}
                    {w.objectives && ` · ${w.objectives.substring(0, 60)}${w.objectives.length > 60 ? '…' : ''}`}
                  </div>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 20, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </div>

              {/* Contenu éditable */}
              {isOpen && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <label style={{ gridColumn: '1 / -1' }}>Objectifs de la semaine
                      <textarea
                        rows={3} disabled={!isStaff}
                        placeholder="Ex: Perte de 0.5kg, réduire les glucides le soir…"
                        value={d.objectives ?? ''}
                        onChange={e => setWeekData(prev => ({ ...prev, [w.weekNumber]: { ...prev[w.weekNumber], objectives: e.target.value } }))}
                        style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}
                      />
                    </label>
                    <label>Plan d'action
                      <textarea
                        rows={4} disabled={!isStaff}
                        placeholder="Séances prévues, régime alimentaire, soins…"
                        value={d.plan ?? ''}
                        onChange={e => setWeekData(prev => ({ ...prev, [w.weekNumber]: { ...prev[w.weekNumber], plan: e.target.value } }))}
                        style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}
                      />
                    </label>
                    <label>Résultats observés
                      <textarea
                        rows={4} disabled={!isStaff}
                        placeholder="Poids atteint, observations cliniques…"
                        value={d.results ?? ''}
                        onChange={e => setWeekData(prev => ({ ...prev, [w.weekNumber]: { ...prev[w.weekNumber], results: e.target.value } }))}
                        style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14, padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}
                      />
                    </label>
                    <label style={{ gridColumn: '1 / -1' }}>Notes internes
                      <input
                        disabled={!isStaff}
                        value={d.notes ?? ''}
                        onChange={e => setWeekData(prev => ({ ...prev, [w.weekNumber]: { ...prev[w.weekNumber], notes: e.target.value } }))}
                        placeholder="Observations personnelles…"
                      />
                    </label>
                  </div>

                  {isStaff && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="btn primary" onClick={() => saveWeek(w.weekNumber)} disabled={saving}>
                        {saving ? 'Sauvegarde…' : 'Enregistrer'}
                      </button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
                        <input type="checkbox" checked={d.completed ?? false}
                          onChange={e => setWeekData(prev => ({ ...prev, [w.weekNumber]: { ...prev[w.weekNumber], completed: e.target.checked } }))} />
                        Semaine complétée
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

// ─── Mon programme (vue client) ──────────────────────────────────────────────

const ROLE_FR_LABEL: Record<string, string> = {
  SUPER_ADMIN:  'Administration',
  ADMIN:        'Administration',
  COACH:        'Coach sportif',
  NUTRITIONIST: 'Nutritionniste',
  SECRETARY:    'Secrétariat',
}

const ROLE_COLOR: Record<string, string> = {
  COACH:        'rgba(0,111,168,0.12)',
  NUTRITIONIST: 'rgba(21,128,61,0.10)',
  SUPER_ADMIN:  'rgba(200,0,94,0.10)',
  ADMIN:        'rgba(200,0,94,0.10)',
  SECRETARY:    'rgba(124,58,237,0.10)',
}
const ROLE_TEXT_COLOR: Record<string, string> = {
  COACH:        'var(--accent-2)',
  NUTRITIONIST: 'var(--ok)',
  SUPER_ADMIN:  'var(--accent)',
  ADMIN:        'var(--accent)',
  SECRETARY:    '#7c3aed',
}

function MonProgrammePage({ auth }: { auth: AuthCtx }) {
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    if (!auth.accessToken) return
    apiGet<any[]>('/api/programs', auth.accessToken)
      .then(res => setPrograms(Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <main className="container"><p className="muted" style={{ marginTop: 24 }}>Chargement…</p></main>

  return (
    <main className="container">
      <div style={{ marginBottom: 20 }}>
        <BackBtn />
        <h1 style={{ margin: '10px 0 4px' }}>Mon programme de suivi</h1>
        <p className="muted">Retrouvez ici le suivi personnalisé établi par chaque membre de l'équipe.</p>
      </div>

      {programs.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ textAlign: 'center', padding: '40px 0', margin: 0 }}>
            Aucun programme de suivi n'a encore été établi pour vous.<br />
            Votre coach ou nutritionniste le créera lors de votre prochaine consultation.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {programs.map(p => {
            const pct     = Math.round((p.completedWeeks / p.durationWeeks) * 100)
            const role    = p.staffRole ?? 'COACH'
            const roleLabel = ROLE_FR_LABEL[role] ?? role
            const bg      = ROLE_COLOR[role] ?? 'rgba(200,0,94,0.08)'
            const textCol = ROLE_TEXT_COLOR[role] ?? 'var(--accent)'

            return (
              <div key={p.id} className="panel"
                style={{ borderLeft: `4px solid ${textCol}`, cursor: 'pointer' }}
                onClick={() => nav(`/mon-programme/${p.id}`)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>

                  {/* Badge rôle */}
                  <div style={{
                    background: bg, color: textCol, fontWeight: 700,
                    fontSize: 13, padding: '8px 16px', borderRadius: 12,
                    flexShrink: 0, alignSelf: 'flex-start', textAlign: 'center',
                    minWidth: 130
                  }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Suivi par</div>
                    <div>{roleLabel}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, opacity: .8 }}>{p.staffName}</div>
                  </div>

                  {/* Infos programme */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Programme {p.durationWeeks} semaines</span>
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: p.status === 'ACTIVE' ? 'var(--ok)' : 'var(--muted)',
                        padding: '2px 10px', border: '1px solid currentColor', borderRadius: 999 }}>
                        {p.status === 'ACTIVE' ? 'En cours' : p.status === 'COMPLETED' ? 'Terminé' : 'Suspendu'}
                      </span>
                    </div>
                    {p.startDate && (
                      <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                        Début : {p.startDate}
                      </div>
                    )}

                    {/* Barre de progression */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, background: 'var(--border)', borderRadius: 999, height: 8 }}>
                        <div style={{
                          background: pct === 100 ? 'var(--ok)' : textCol,
                          borderRadius: 999, height: 8, width: `${pct}%`, transition: 'width .4s'
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: textCol, flexShrink: 0 }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {p.completedWeeks} / {p.durationWeeks} semaines complétées
                    </div>
                  </div>

                  <span style={{ color: 'var(--muted)', fontSize: 22, alignSelf: 'center' }}>›</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

// ─── Mon profil ───────────────────────────────────────────────────────────────

function ProfilePage({ auth }: { auth: AuthCtx }) {
  const [profile, setProfile]       = useState<any>(null)
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [dob, setDob]               = useState('')
  const [saving, setSaving]         = useState(false)
  const [infoMsg, setInfoMsg]       = useState<string | null>(null)

  const [curPwd, setCurPwd]         = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [showCur, setShowCur]       = useState(false)
  const [showNew, setShowNew]       = useState(false)
  const [savingPwd, setSavingPwd]   = useState(false)
  const [pwdMsg, setPwdMsg]         = useState<string | null>(null)
  const [pwdErr, setPwdErr]         = useState<string | null>(null)

  useEffect(() => {
    apiGet<any>('/api/profile', auth.accessToken ?? undefined)
      .then(p => { setProfile(p); setFirstName(p.firstName); setLastName(p.lastName); setPhone(p.phone); setDob(p.dateOfBirth ?? '') })
      .catch(() => {})
  }, [])

  async function saveProfile() {
    setSaving(true); setInfoMsg(null)
    try {
      const updated = await apiPut<any>('/api/profile', { firstName, lastName, phone, dateOfBirth: dob || null }, auth.accessToken ?? undefined)
      setProfile(updated); setInfoMsg('Profil mis à jour.')
    } catch { setInfoMsg('Erreur lors de la mise à jour.') }
    finally { setSaving(false) }
  }

  async function changePassword() {
    setSavingPwd(true); setPwdMsg(null); setPwdErr(null)
    try {
      await apiPut('/api/profile/password', { currentPassword: curPwd, newPassword: newPwd }, auth.accessToken ?? undefined)
      setPwdMsg('Mot de passe modifié avec succès.'); setCurPwd(''); setNewPwd('')
    } catch (e: any) {
      const m: Record<string,string> = {
        WRONG_CURRENT_PASSWORD: 'Mot de passe actuel incorrect.',
        PASSWORD_TOO_SHORT: 'Le nouveau mot de passe doit faire au moins 6 caractères.',
      }
      setPwdErr(m[e?.error] ?? 'Erreur.')
    } finally { setSavingPwd(false) }
  }

  if (!profile) return <main className="container"><p className="muted" style={{ marginTop: 24 }}>Chargement…</p></main>

  return (
    <main className="container">
      <div style={{ marginBottom: 16 }}><BackBtn /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>

        {/* Informations personnelles */}
        <div className="panel">
          <h2 style={{ margin: '0 0 18px', fontSize: 17 }}>Informations personnelles</h2>
          <form onSubmit={e => e.preventDefault()} className="form">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Prénom
                <input value={firstName} onChange={e => setFirstName(e.target.value)} />
              </label>
              <label>Nom
                <input value={lastName} onChange={e => setLastName(e.target.value)} />
              </label>
            </div>
            <label>Email
              <input value={profile.email} disabled style={{ opacity: .6 }} />
            </label>
            <label>Téléphone
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237 6XX XXX XXX" />
            </label>
            <label>Date de naissance
              <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                min="1900-01-01"
                onKeyDown={e => e.key === 'Enter' && e.preventDefault()} />
            </label>
            {profile.dateOfBirth && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: -8 }}>
                Âge actuel : <strong>{profile.age} ans</strong>
              </div>
            )}
            {infoMsg && <div style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 600 }}>{infoMsg}</div>}
            <button type="button" className="btn primary" onClick={saveProfile} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </form>
        </div>

        {/* Changer le mot de passe */}
        <div className="panel">
          <h2 style={{ margin: '0 0 18px', fontSize: 17 }}>Changer le mot de passe</h2>
          <div className="form">
            <label>Mot de passe actuel
              <div className="pwd-wrap">
                <input type={showCur ? 'text' : 'password'} value={curPwd} onChange={e => setCurPwd(e.target.value)} />
                <button type="button" className="pwd-toggle" onClick={() => setShowCur(v => !v)}>{showCur ? '?' : '?'}</button>
              </div>
            </label>
            <label>Nouveau mot de passe
              <div className="pwd-wrap">
                <input type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="6 caractères minimum" />
                <button type="button" className="pwd-toggle" onClick={() => setShowNew(v => !v)}>{showNew ? '?' : '?'}</button>
              </div>
            </label>
            {pwdErr && <div className="error">{pwdErr}</div>}
            {pwdMsg && <div style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 600 }}>{pwdMsg}</div>}
            <button type="button" className="btn primary" onClick={changePassword} disabled={savingPwd || !curPwd || newPwd.length < 6}>
              {savingPwd ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </div>
        </div>

        {/* Résumé du compte */}
        <div className="panel">
          <h2 style={{ margin: '0 0 18px', fontSize: 17 }}>Mon compte</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Rôle</div>
              <span className={roleBadgeClass(profile.role)} style={{ marginTop: 4, display: 'inline-block' }}>{roleLabel(profile.role)}</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Membre depuis</div>
              <div style={{ marginTop: 4, fontWeight: 500 }}>{profile.createdAt?.substring(0, 10) ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Journal d'activité ───────────────────────────────────────────────────────

function ActivityLogPage({ auth }: { auth: AuthCtx }) {
  const [items, setItems]   = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage]     = useState(0)
  const [total, setTotal]   = useState(0)

  async function load(p = 0) {
    setLoading(true)
    try {
      const res = await apiGet<any>(`/api/audit?page=${p}&size=50`, auth.accessToken ?? undefined)
      setItems(res.items ?? [])
      setTotal(res.total ?? 0)
      setPage(p)
    } catch { /**/ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const ACTION_LABEL: Record<string, string> = {
    LOGIN:        'Connexion',
    USER_DELETED: 'Suppression compte',
    ROLE_CHANGED: 'Changement rôle',
    USER_CREATED: 'Nouveau compte',
  }

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackBtn />
            <h1 style={{ margin: 0 }}>Journal d'activité</h1>
          </div>
          <button className="btn" onClick={() => load(0)} disabled={loading}>{loading ? '…' : '↻'}</button>
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>{total} événement{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Effectué par</th>
                <th>Cible</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{e.createdAt?.substring(0, 16).replace('T', ' à ')}</td>
                  <td><span style={{ fontWeight: 700, fontSize: 12 }}>{ACTION_LABEL[e.action] ?? e.action}</span></td>
                  <td style={{ fontSize: 13 }}>{e.performedBy}</td>
                  <td style={{ fontSize: 13 }}>{e.targetUser}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{e.details}</td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucune activité enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

// ─── Centre ───────────────────────────────────────────────────────────────────

function CentrePage() {
  return (
    <main className="container">
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <BackBtn />
          <h1 style={{ margin: 0 }}>Centre du Vernet</h1>
        </div>
        <p className="muted">Agrément Méthode Laurand — Douala, Cameroun</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 16 }}>
        <div className="panel">
          <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>Adresse</h2>
          <p className="muted" style={{ margin: 0 }}>Douala, Cameroun<br />Centre du Vernet</p>
        </div>
        <div className="panel">
          <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>Horaires</h2>
          <p className="muted" style={{ margin: 0 }}>Lundi – Vendredi : 07:00 – 17:00<br />Samedi : 08:00 – 14:00</p>
        </div>
        <div className="panel">
          <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>Services</h2>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
            <li>Aquagym</li>
            <li>Électrostimulation & ultrasons</li>
            <li>Massage & hammam</li>
            <li>Fitness</li>
            <li>Spa jet & perfect body</li>
            <li>Consultation diététique</li>
          </ul>
        </div>
        <div className="panel">
          <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>Méthode</h2>
          <p className="muted" style={{ margin: 0 }}>
            Suivi individualisé basé sur la Méthode Laurand.
            Accompagnement nutritionnel, coaching sportif et soins bien-être pour un
            amaigrissement durable et sain.
          </p>
        </div>
        <div className="panel">
          <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>Nos espaces</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              "salle-d'acceuil.png",
              'salle-de-fitness-1.png',
              "salle-d'aquagym.png",
              'salle-de-massage-hammam-1.png',
              'salle-du-spa-jet.png',
              'salle-de-cryolipolyse-et-pressotherapie(sonare-japonais).png',
            ].map(f => (
              <img key={f} src={`/media/salles/${f.replace(/"/g, '%22')}`} alt=""
                style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const auth    = useAuth()
  const [pending, setPending] = useState<PendingData | null>(null)

  return (
    <Routes>
      {/* ── Vitrine publique (header + footer intégrés) ── */}
      <Route path="/" element={<LandingPage />} />

      {/* ── Pages auth (header simple) ── */}
      <Route element={<><Header auth={auth} /><Outlet /></>}>
        <Route path="/register"   element={<Register />} />
        <Route path="/login"      element={<Login onPending={setPending} />} />
        <Route path="/verify-2fa" element={<Verify2fa pending={pending} onAccessToken={(t) => auth.setAccessToken(t)} />} />
        <Route path="/setup"      element={<SetupAdmin />} />
      </Route>

      {/* ── Pages authentifiées (sidebar — redirige vers /login si non connecté) ── */}
      <Route element={<AuthLayout auth={auth} />}>
        <Route path="/dashboard"     element={<Dashboard auth={auth} />} />
        <Route path="/messagerie"    element={<Messaging auth={auth} />} />
        <Route path="/notifications" element={<Notifications accessToken={auth.accessToken} />} />
        <Route path="/catalogue"     element={<Catalog auth={auth} />} />
        <Route path="/mes-clients"          element={<ClientsPage auth={auth} />} />
        <Route path="/mes-clients/:id"      element={<ClientDossierPage auth={auth} />} />
        <Route path="/mon-dossier"          element={<ClientDossierPage auth={auth} />} />
        <Route path="/suivi-poids"   element={<WeightPage auth={auth} />} />
        <Route path="/planning"      element={<PlanningPage auth={auth} />} />
        <Route path="/rapports"      element={<ReportsPage auth={auth} />} />
        <Route path="/utilisateurs"  element={<UsersPage auth={auth} />} />
        <Route path="/centre"        element={<CentrePage />} />
        <Route path="/profil"             element={<ProfilePage auth={auth} />} />
        <Route path="/journal"            element={<ActivityLogPage auth={auth} />} />
        <Route path="/suivi-clients"      element={<SuiviClientsPage auth={auth} />} />
        <Route path="/suivi-clients/:id"  element={<ClientProgramPage auth={auth} />} />
        <Route path="/mon-programme"      element={<MonProgrammePage auth={auth} />} />
        <Route path="/mon-programme/:id"  element={<ClientProgramPage auth={auth} />} />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}
