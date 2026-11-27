/**
 * Entrée de l'appli : code d'accès, espace administrateur, ou l'appli elle-même.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import App from '../App';
import { PREVIEW } from '../lib/env';
import { oublierEntreprise, retenirEntreprise } from './entreprise';
import { checkCode, clearAccess, cleanCode, codeFromHash, decide, dureeTexte, formatCode, isAdminRoute, loadAccess, saveAccess, type StoredAccess, type Verification } from './gate';

// L'espace administrateur (et la bibliothèque Supabase) ne se charge que quand on l'ouvre.
const AdminScreen = lazy(() => import('../admin/AdminScreen'));

type Raison = 'premier' | 'coupe' | 'expire' | 'fin';

/** Une minute : délai maximal pour qu'un code coupé ferme l'appli (s'il y a du réseau). */
const VERIF_MS = 60_000;

/** Le code gardé, mis à jour après une vérification réussie. */
const apresVerif = (stored: StoredAccess, r: Verification): StoredAccess => ({
  ...stored,
  nom: r.nom ?? stored.nom,
  verifie: Date.now(),
  horsLigneH: r.horsLigneH ?? stored.horsLigneH,
  fin: r.fin === undefined ? (stored.fin ?? null) : r.fin,
});

export function Root() {
  const [admin, setAdmin] = useState(() => !PREVIEW && isAdminRoute(location.hash, location.search));
  const [open, setOpen] = useState(() => PREVIEW || (!codeFromHash(location.hash) && decide(loadAccess(), Date.now()).open));
  const [raison, setRaison] = useState<Raison>(() => decide(loadAccess(), Date.now()).raison ?? 'premier');
  const [linkCode, setLinkCode] = useState(() => codeFromHash(location.hash));

  useEffect(() => {
    const onHash = () => setAdmin(!PREVIEW && isAdminRoute(location.hash, location.search));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Appli ouverte : le code est revérifié tout de suite, puis chaque minute et à chaque retour sur l'appli.
  // Coupé, supprimé ou arrivé à sa fin : l'appli se ferme. Sans réseau : elle reste ouverte le temps permis au code.
  useEffect(() => {
    if (PREVIEW || !open || admin) return;
    let cancel = false;
    let enCours = false;
    const fermer = (r: Raison) => {
      if (cancel) return;
      if (r === 'coupe') {
        clearAccess();
        oublierEntreprise();
      }
      setRaison(r);
      setOpen(false);
    };
    const verifier = () => {
      const stored = loadAccess();
      if (!stored) return fermer('coupe');
      const d = decide(stored, Date.now());
      if (!d.open) return fermer(d.raison ?? 'expire');
      if (enCours || !navigator.onLine || document.visibilityState === 'hidden') return;
      enCours = true;
      checkCode(stored.code)
        .then(
          (r) => {
            if (cancel) return;
            if (r.ok) {
              saveAccess(apresVerif(stored, r));
              retenirEntreprise(stored.code, r.entreprise);
            }
            else fermer(r.raison === 'fin' ? 'fin' : 'coupe');
          },
          () => undefined, // pas de réseau, serveur lent : on garde l'accès le temps permis
        )
        .finally(() => {
          enCours = false;
        });
    };
    verifier();
    const t = setInterval(verifier, VERIF_MS);
    const auRetour = () => {
      if (document.visibilityState === 'visible') verifier();
    };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', verifier);
    return () => {
      cancel = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', verifier);
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
      onOk={(code, r) => {
        saveAccess(apresVerif({ code, nom: '', verifie: Date.now() }, r));
        retenirEntreprise(code, r.entreprise);
        if (linkCode) history.replaceState(null, '', location.pathname);
        setLinkCode(null);
        setOpen(true);
      }}
    />
  );
}

function message(r: Raison): string {
  if (r === 'premier') return 'Accès réservé. Entre le code que tu as reçu.';
  if (r === 'coupe') return 'Ton code n’est plus actif. Demande un nouveau code à l’administrateur.';
  if (r === 'fin') return 'Ton code est arrivé à sa fin. Demande un nouveau code à l’administrateur.';
  const h = loadAccess()?.horsLigneH;
  return h === 0
    ? 'Ce code demande du réseau : connecte-toi pour continuer.'
    : `Ton code n’a pas été vérifié depuis ${dureeTexte(h ?? 720)} : il faut du réseau pour le revérifier.`;
}

function CodeScreen(p: { raison: Raison; initialCode: string; autoSubmit: boolean; onOk: (code: string, r: Verification) => void }) {
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
      if (r.ok) p.onOk(code, r);
      else
        setError(
          r.raison === 'fin'
            ? 'Ce code est arrivé à sa fin. Demande un nouveau code.'
            : r.raison === 'coupe'
              ? 'Ce code a été coupé. Demande un nouveau code.'
              : 'Code inconnu ou coupé. Vérifie-le, ou demande un nouveau code.',
        );
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
        <p className={`gate-sub ${p.raison !== 'premier' ? 'warn-text' : ''}`}>{message(p.raison)}</p>
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
