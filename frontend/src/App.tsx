import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { apiPost } from './lib/api'

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
        <div className="brand-mark" aria-hidden="true">
          CV
        </div>
        <div>
          <div className="brand-title">Centre du Vernet</div>
          <div className="brand-sub">Agree Méthode Laurand — Douala</div>
        </div>
      </div>
      <nav className="nav">
        <Link to="/">Accueil</Link>
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

export default function App() {
  const auth = useAuth()
  const [pendingToken, setPendingToken] = useState<string | null>(null)

  return (
    <div className="app">
      <Header isLoggedIn={!!auth.accessToken} />
      <Routes>
        <Route path="/" element={<Home />} />
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
