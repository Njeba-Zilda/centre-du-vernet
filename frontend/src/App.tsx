import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { apiGet, apiPost } from './lib/api'

type LoginResponse = { needs2fa: boolean; pendingToken: string }
type TokenResponse = { accessToken: string }

function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('vernet_access_token'),
  )

  return useMemo(
    () => ({
      accessToken,
      setAccessToken: (t: string | null) => {
        setAccessToken(t)
        if (t) localStorage.setItem('vernet_access_token', t)
        else localStorage.removeItem('vernet_access_token')
      },
    }),
    [accessToken],
  )
}

function Header({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-logos" aria-hidden="true">
          <img
            className="brand-logo"
            src="/media/logos/logo-centre-du-vernet-1.jpeg"
            alt=""
          />
          <img
            className="brand-logo"
            src="/media/logos/logo-amincissement-centre-du-vernet-methode-laurand.jpg"
            alt=""
          />
        </div>
        <div>
          <div className="brand-title">Centre du Vernet</div>
          <div className="brand-sub">Agree Méthode Laurand — Douala</div>
        </div>
      </div>
      <nav className="nav">
        <Link to="/">Accueil</Link>
        <Link to="/vitrine">Vitrine</Link>
        <Link to="/notifications">Notifications</Link>
        <Link to="/catalogue">Catalogue</Link>
        <Link to="/login">{isLoggedIn ? 'Dashboard' : 'Connexion'}</Link>
      </nav>
    </header>
  )
}

function Home() {
  return (
    <main className="container">
      <section className="hero">
        <div className="hero-card">
          <h1>Suivi & maintien d’amaigrissement</h1>
          <p>
            Plateforme web (Centre du Vernet) pour le suivi du poids/IMC, les
            rendez-vous, les programmes, la messagerie et les rapports PDF.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" to="/login">
              Se connecter (2FA)
            </Link>
            <a className="btn" href="#features">
              Voir les modules
            </a>
          </div>
          <div className="hero-meta">
            <span>Ouvert 07:00–17:00</span>
            <span>Notifications in-app + email</span>
            <span>Catalogue & templates A4</span>
          </div>
        </div>
      </section>

      <section id="features" className="grid">
        <div className="card">
          <h2>Dashboards</h2>
          <p>Super-admin, secrétaire, coach, nutritionniste, client.</p>
        </div>
        <div className="card">
          <h2>Messagerie</h2>
          <p>Coach ↔ client, avec envoi de documents (catalogue).</p>
        </div>
        <div className="card">
          <h2>Rapports PDF</h2>
          <p>Courbes et statistiques + export A4.</p>
        </div>
        <div className="card">
          <h2>“Intelligent” (règles)</h2>
          <p>Alertes: stagnation, progression anormale, absence d’activité.</p>
        </div>
      </section>
    </main>
  )
}

function Vitrine() {
  const rooms = [
    { name: "Salle d'accueil", file: "salle-d'acceuil.jpeg" },
    { name: 'Salle de consultation', file: 'salle-de-consultation.jpeg' },
    { name: 'Salle de fitness', file: 'salle-de-fitness.jpeg' },
    { name: 'Aquagym', file: "salle-d'aquagym-1.jpeg" },
    { name: 'Electrostimulation & ultrasons', file: "salle-d'electrostimulation-et-ultrasons-1.jpeg" },
    { name: 'Massage & hammam', file: "salle-de-massage-hammam-1.jpeg" },
    { name: 'Spa jet', file: 'salle-du-spa-jet-1.jpeg' },
    { name: 'Perfect body', file: 'salle-du-perfect-body.jpeg' },
  ]

  return (
    <main className="container">
      <div className="panel">
        <h1>Vitrine — Centre du Vernet</h1>
        <p className="muted">
          Avant inscription, les visiteurs peuvent découvrir les salles et les
          services.
        </p>
      </div>

      <section className="gallery">
        {rooms.map((r) => (
          <article key={r.file} className="gallery-card">
            <img
              className="gallery-img"
              src={`/media/salles/${encodeURIComponent(r.file)}`}
              alt={r.name}
              loading="lazy"
            />
            <div className="gallery-meta">
              <div className="gallery-title">{r.name}</div>
              <div className="gallery-sub">Douala — ouvert 07:00–17:00</div>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

function Login({ onPending }: { onPending: (t: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  return (
    <main className="container">
      <div className="panel">
        <h1>Connexion</h1>
        <p className="muted">La validation 2FA est obligatoire.</p>

        <div className="form">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button
            className="btn primary"
            onClick={async () => {
              setError(null)
              try {
                const res = await apiPost<LoginResponse>('/api/auth/login', {
                  email,
                  password,
                })
                onPending(res.pendingToken)
                nav('/verify-2fa')
              } catch (e: any) {
                setError(e?.error ?? 'Erreur de connexion')
              }
            }}
          >
            Continuer
          </button>
        </div>
      </div>
    </main>
  )
}

function Verify2fa({
  pendingToken,
  onAccessToken,
}: {
  pendingToken: string | null
  onAccessToken: (t: string) => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  return (
    <main className="container">
      <div className="panel">
        <h1>Vérification 2FA</h1>
        <p className="muted">Entre le code à 6 chiffres de ton application.</p>
        <div className="form">
          <label>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button
            className="btn primary"
            disabled={!pendingToken}
            onClick={async () => {
              setError(null)
              try {
                const res = await apiPost<TokenResponse>(
                  '/api/auth/verify-2fa',
                  { pendingToken, code },
                )
                onAccessToken(res.accessToken)
                nav('/dashboard')
              } catch (e: any) {
                setError(e?.error ?? 'Code invalide')
              }
            }}
          >
            Valider
          </button>
          {!pendingToken ? (
            <div className="error">
              Session 2FA manquante. Reconnecte-toi.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row">
          <h1>Dashboard</h1>
          <button className="btn" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
        <p className="muted">
          Prochaines sections à brancher: notifications, messagerie, catalogue,
          templates A4, suivi client.
        </p>
      </div>
    </main>
  )
}

function Notifications({ accessToken }: { accessToken: string | null }) {
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row">
          <h1>Notifications</h1>
          <button
            className="btn"
            disabled={!accessToken}
            onClick={async () => {
              setError(null)
              try {
                const res = await apiGet<any>('/api/notifications?size=30', accessToken ?? undefined)
                setItems(res.items ?? [])
              } catch (e: any) {
                setError(e?.error ?? 'Erreur')
              }
            }}
          >
            Rafraîchir
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {!accessToken ? (
          <p className="muted">Connecte-toi pour voir tes notifications.</p>
        ) : (
          <div className="list">
            {items.map((n) => (
              <div key={n.id} className="list-item">
                <div className="list-title">{n.title}</div>
                <div className="list-sub">{n.body}</div>
                <div className="list-meta">{n.createdAt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function Catalog({ accessToken }: { accessToken: string | null }) {
  const [items, setItems] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  return (
    <main className="container">
      <div className="panel">
        <div className="panel-row">
          <h1>Catalogue (documents)</h1>
          <button
            className="btn"
            disabled={!accessToken}
            onClick={async () => {
              setError(null)
              try {
                const res = await apiGet<any>('/api/catalog?size=30', accessToken ?? undefined)
                setItems(res.items ?? [])
              } catch (e: any) {
                setError(e?.error ?? 'Erreur')
              }
            }}
          >
            Charger
          </button>
        </div>

        {!accessToken ? (
          <p className="muted">Connecte-toi pour accéder au catalogue.</p>
        ) : (
          <>
            <div className="upload">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                className="btn primary"
                disabled={!file}
                onClick={async () => {
                  if (!file || !accessToken) return
                  setError(null)
                  try {
                    const form = new FormData()
                    form.append('file', file)
                    const res = await fetch('http://localhost:8080/api/catalog/upload', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${accessToken}` },
                      body: form,
                    })
                    if (!res.ok) {
                      const t = await res.text()
                      throw { error: t || 'UPLOAD_FAILED' }
                    }
                    setFile(null)
                  } catch (e: any) {
                    setError(e?.error ?? 'Erreur upload')
                  }
                }}
              >
                Upload
              </button>
            </div>

            {error ? <div className="error">{error}</div> : null}

            <div className="list">
              {items.map((a) => (
                <div key={a.id} className="list-item">
                  <div className="list-title">{a.originalFilename}</div>
                  <div className="list-sub">{a.contentType}</div>
                  <div className="list-meta">{a.createdAt}</div>
                  <a
                    className="btn"
                    href={`http://localhost:8080/api/catalog/${a.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Télécharger
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function App() {
  const auth = useAuth()
  const [pendingToken, setPendingToken] = useState<string | null>(null)

  return (
    <div className="app">
      <Header isLoggedIn={!!auth.accessToken} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vitrine" element={<Vitrine />} />
        <Route path="/notifications" element={<Notifications accessToken={auth.accessToken} />} />
        <Route path="/catalogue" element={<Catalog accessToken={auth.accessToken} />} />
        <Route path="/login" element={<Login onPending={setPendingToken} />} />
        <Route
          path="/verify-2fa"
          element={
            <Verify2fa
              pendingToken={pendingToken}
              onAccessToken={(t) => auth.setAccessToken(t)}
            />
          }
        />
        <Route
          path="/dashboard"
          element={<Dashboard onLogout={() => auth.setAccessToken(null)} />}
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  )
}
