/**
 * Entrée de l'appli : code d'accès, espace administrateur, ou l'appli elle-même.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import App from '../App';
import { PREVIEW } from '../lib/env';
import { checkCode, clearAccess, cleanCode, codeFromHash, decide, formatCode, isAdminRoute, loadAccess, saveAccess } from './gate';

// L'espace administrateur (et la bibliothèque Supabase) ne se charge que quand on l'ouvre.
const AdminScreen = lazy(() => import('../admin/AdminScreen'));

type Raison = 'premier' | 'coupe' | 'expire';

export function Root() {
  const [admin, setAdmin] = useState(() => !PREVIEW && isAdminRoute(location.hash, location.search));
  const [open, setOpen] = useState(() => PREVIEW || (!codeFromHash(location.hash) && decide(loadAccess(), Date.now()).open));
  const [raison, setRaison] = useState<Raison>(() => (decide(loadAccess(), Date.now()).expired ? 'expire' : 'premier'));
  const [linkCode, setLinkCode] = useState(() => codeFromHash(location.hash));

  useEffect(() => {
    const onHash = () => setAdmin(!PREVIEW && isAdminRoute(location.hash, location.search));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Appli ouverte avec un code gardé : on le revérifie en arrière-plan ; s'il a été coupé, l'appli se ferme.
  useEffect(() => {
    if (PREVIEW || !open || admin) return;
    const stored = loadAccess();
    if (!stored) return;
    let cancel = false;
    const verifier = () => {
      if (!navigator.onLine) return;
      checkCode(stored.code).then(
        (r) => {
          if (cancel) return;
          if (r.ok) saveAccess({ ...stored, nom: r.nom ?? stored.nom, verifie: Date.now() });
          else {
            clearAccess();
            setRaison('coupe');
            setOpen(false);
          }
        },
        () => undefined, // pas de réseau, serveur lent : on garde l'accès (30 jours au plus)
      );
    };
    verifier();
    return () => {
      cancel = true;
    };
  }, [open, admin]);

  if (admin) {
    return (
      <Suspense fallback={<main className="gate">Chargement…</main>}>
        <AdminScreen
          onExit={() => {
            history.replaceState(null, '', `${location.pathname}`);
            setAdmin(false);
          }}
        />
      </Suspense>
    );
  }
  if (open) return <App />;
  return (
    <CodeScreen
      raison={raison}
      initialCode={linkCode ?? loadAccess()?.code ?? ''}
      autoSubmit={!!linkCode || raison === 'expire'}
      onOk={(code, nom) => {
        saveAccess({ code, nom, verifie: Date.now() });
        if (linkCode) history.replaceState(null, '', location.pathname);
        setLinkCode(null);
        setOpen(true);
      }}
    />
  );
}

const MESSAGE: Record<Raison, string> = {
  premier: 'Accès réservé. Entre le code que tu as reçu.',
  coupe: 'Ton code n’est plus actif. Demande un nouveau code à l’administrateur.',
  expire: 'Ton code n’a pas été vérifié depuis 30 jours : il faut du réseau pour le revérifier.',
};

function CodeScreen(p: { raison: Raison; initialCode: string; autoSubmit: boolean; onOk: (code: string, nom: string) => void }) {
  const [value, setValue] = useState(formatCode(p.initialCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  const submit = async (raw: string) => {
    const code = cleanCode(raw);
    if (code.length !== 8) {
      setError('Le code a 8 signes, par exemple ABCD-EF23.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await checkCode(code);
      if (r.ok) p.onOk(code, r.nom ?? '');
      else setError('Code inconnu ou coupé. Vérifie-le, ou demande un nouveau code.');
    } catch {
      setError(
        navigator.onLine
          ? 'Le serveur ne répond pas. Réessaie dans un instant.'
          : 'Pas de réseau. Il faut une connexion pour vérifier le code ; ensuite, l’appli marche hors ligne.',
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!p.autoSubmit || tried.current || !p.initialCode) return;
    tried.current = true;
    void submit(p.initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="gate">
      <div className="gate-card">
        <img className="gate-logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={72} height={72} />
        <h1>ASP Rail</h1>
        <p className={`gate-sub ${p.raison !== 'premier' ? 'warn-text' : ''}`}>{MESSAGE[p.raison]}</p>
        <form
          className="gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(value);
          }}
        >
          <label className="gate-label" htmlFor="gate-code">
            Code d’accès
          </label>
          <input
            id="gate-code"
            className="gate-input"
            value={value}
            onChange={(e) => setValue(formatCode(e.target.value))}
            placeholder="ABCD-EF23"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={9}
            aria-invalid={!!error}
            aria-describedby={error ? 'gate-msg' : undefined}
          />
          <button className="btn primary gate-btn" disabled={busy}>
            {busy ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
        {error && (
          <p id="gate-msg" className="gate-error" role="alert">
            {error}
          </p>
        )}
        <p className="gate-help">Pas de code ? Demande-le à la personne qui t’a parlé de l’appli.</p>
      </div>
      <a className="gate-admin" href="#admin">
        Espace administrateur
      </a>
    </main>
  );
}
