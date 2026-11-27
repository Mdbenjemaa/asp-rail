/**
 * Espace administrateur d'ASP Rail : connexion par e-mail et mot de passe (compte Supabase), puis gestion des codes
 * d'accès : créer un code nommé (durée de vie, temps hors ligne), le partager, le couper ou le réactiver, le supprimer ;
 * voir qui est en ligne et sur quels téléphones chaque code est utilisé.
 */
import { useEffect, useMemo, useState } from 'react';
import { dureeTexte, formatCode, lienCode } from '../access/gate';
import { jetonDuLien, sb } from './client';
import { Sessions } from './Sessions';

interface Code {
  id: string;
  code: string;
  nom: string;
  cree_le: string;
  coupe_le: string | null;
  derniere_utilisation: string | null;
  /** Fin du code (null : sans limite). */
  expire_le?: string | null;
  /** Heures d'utilisation sans réseau (0 : réseau obligatoire). */
  hors_ligne_h?: number;
}

interface Appareil {
  id: string;
  code_id: string;
  agent: string;
  premier: string;
  dernier: string;
}

/** Durées proposées à la création (heures ; null : sans limite). */
const DUREES: [number | null, string][] = [
  [1, '1 heure'],
  [24, '1 jour'],
  [168, '7 jours'],
  [720, '30 jours'],
  [null, 'Sans limite'],
];
const HORS_LIGNE: [number, string][] = [
  [0, 'Réseau obligatoire'],
  [24, '24 heures'],
  [168, '7 jours'],
  [720, '30 jours'],
];
/** Vu dans les 2 dernières minutes : en ligne (l'appli vérifie le code chaque minute). */
const EN_LIGNE_MS = 2 * 60_000;
const enLigne = (iso: string | null | undefined, now: number) => !!iso && now - Date.parse(iso) < EN_LIGNE_MS;
const termine = (c: Code, now: number) => !!c.expire_le && Date.parse(c.expire_le) <= now;
const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' à');

type Etat = { k: 'chargement' } | { k: 'connexion' } | { k: 'nouveau-mdp' } | { k: 'pas-admin'; email: string } | { k: 'admin'; email: string };


/** Session en cours sur ce téléphone : administrateur, autre compte, ou pas connecté. */
async function etatSession(): Promise<Etat> {
  const s = sb();
  const { data } = await s.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return { k: 'connexion' };
  const { data: estAdmin, error } = await s.rpc('asp_est_admin');
  if (error) return { k: 'connexion' };
  return estAdmin ? { k: 'admin', email } : { k: 'pas-admin', email };
}

const ago = (iso: string) => {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 12 * 60) return `il y a ${Math.floor(min / 60)} h`;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  return `le ${d.toLocaleDateString('fr-FR')}`;
};

export default function AdminScreen({ onExit }: { onExit: () => void }) {
  // Retour du lien « mot de passe oublié » (…#access_token=…&type=recovery) : lu avant que Supabase nettoie l'adresse.
  const [recovery] = useState(() => /type=recovery/.test(location.hash));
  const [etat, setEtat] = useState<Etat>(recovery ? { k: 'nouveau-mdp' } : { k: 'chargement' });
  const [msg, setMsg] = useState<string | null>(null);

  const verifier = () =>
    etatSession().then(setEtat, () => {
      setEtat({ k: 'connexion' });
      setMsg('Le serveur ne répond pas. Vérifie le réseau.');
    });

  useEffect(() => {
    const s = sb();
    const { data: sub } = s.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setEtat({ k: 'nouveau-mdp' });
    });
    if (!recovery)
      etatSession().then(setEtat, () => {
        setEtat({ k: 'connexion' });
        setMsg('Le serveur ne répond pas. Vérifie le réseau.');
      });
    return () => sub.subscription.unsubscribe();
  }, [recovery]);

  const deconnexion = async () => {
    await sb().auth.signOut();
    setEtat({ k: 'connexion' });
  };

  return (
    <main className="gate admin">
      <div className="gate-card admin-card">
        <div className="admin-head">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={44} height={44} />
          <div>
            <h1>Administration</h1>
            <small>Codes d’accès d’ASP Rail</small>
          </div>
        </div>
        {msg && (
          <p className="admin-msg" role="status" onClick={() => setMsg(null)}>
            {msg}
          </p>
        )}
        {etat.k === 'chargement' && <p className="muted">Chargement…</p>}
        {etat.k === 'connexion' && (
          <Connexion
            onOk={(email, admin) => setEtat(admin ? { k: 'admin', email } : { k: 'pas-admin', email })}
            onRecovery={() => setEtat({ k: 'nouveau-mdp' })}
            onMsg={setMsg}
          />
        )}
        {etat.k === 'nouveau-mdp' && (
          <NouveauMdp
            onDone={() => {
              setEtat({ k: 'chargement' });
              void verifier();
            }}
            onMsg={setMsg}
          />
        )}
        {etat.k === 'pas-admin' && (
          <>
            <p className="error">Le compte {etat.email} n’est pas administrateur d’ASP Rail.</p>
            <button className="btn wide" onClick={() => void deconnexion()}>
              Changer de compte
            </button>
          </>
        )}
        {etat.k === 'admin' && <Admin email={etat.email} onMsg={setMsg} onLogout={() => void deconnexion()} />}
        <button className="link-btn admin-exit" onClick={onExit}>
          ← Revenir à l’appli
        </button>
      </div>
    </main>
  );
}

function Connexion({ onOk, onRecovery, onMsg }: { onOk: (email: string, admin: boolean) => void; onRecovery: () => void; onMsg: (m: string) => void }) {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const valider = async () => {
    const token_hash = jetonDuLien(lien ?? '');
    if (!token_hash) return setErr('Lien non reconnu : copie le lien du bouton dans le mail (appui long › Copier le lien).');
    setBusy(true);
    setErr(null);
    const { error } = await sb().auth.verifyOtp({ token_hash, type: 'recovery' });
    setBusy(false);
    if (error) return setErr('Lien expiré ou déjà utilisé : redemande « Mot de passe oublié ».');
    onRecovery();
  };
  const connecter = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: mdp });
      if (error) {
        setErr(/confirm/i.test(error.message) ? 'Adresse pas encore confirmée : ouvre le lien reçu par e-mail.' : 'E-mail ou mot de passe incorrect.');
        return;
      }
      const { data } = await sb().rpc('asp_est_admin');
      onOk(email.trim().toLowerCase(), data === true);
    } catch {
      setErr('Le serveur ne répond pas. Vérifie le réseau.');
    } finally {
      setBusy(false);
    }
  };
  const oubli = async () => {
    if (!email.trim()) return setErr('Écris ton e-mail, puis touche « Mot de passe oublié ».');
    const redirectTo = `${location.origin}${import.meta.env.BASE_URL}?admin`;
    const { error } = await sb().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    onMsg(error ? 'Envoi impossible pour le moment.' : 'Si ce compte existe, un lien pour changer le mot de passe vient d’être envoyé par e-mail.');
    if (!error) setLien('');
  };
  return (
    <form
      className="gate-form"
      onSubmit={(e) => {
        e.preventDefault();
        void connecter();
      }}
    >
      <p className="muted small">Même compte que l’espace administrateur de PK Rail.</p>
      <label className="gate-label" htmlFor="adm-email">
        E-mail
      </label>
      <input id="adm-email" className="gate-input admin-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="gate-label" htmlFor="adm-mdp">
        Mot de passe
      </label>
      <input id="adm-mdp" className="gate-input admin-input" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
      <button className="btn primary gate-btn" disabled={busy || !email || !mdp}>
        {busy ? 'Connexion…' : 'Se connecter'}
      </button>
      {err && (
        <p className="gate-error" role="alert">
          {err}
        </p>
      )}
      <button type="button" className="link-btn" onClick={() => void oubli()}>
        Mot de passe oublié
      </button>
      {lien !== null && (
        <div className="admin-lien">
          <label className="gate-label" htmlFor="adm-lien">
            Lien reçu par mail
          </label>
          <p className="muted small">Dans le mail, appui long sur le bouton › « Copier le lien » (sans l’ouvrir), puis colle-le ici.</p>
          <input id="adm-lien" className="gate-input admin-input" value={lien} placeholder="https://…supabase.co/auth/v1/verify?token=…" onChange={(e) => setLien(e.target.value)} />
          <button type="button" className="btn wide" disabled={busy || !lien.trim()} onClick={() => void valider()}>
            Choisir mon mot de passe
          </button>
        </div>
      )}
    </form>
  );
}

function NouveauMdp({ onDone, onMsg }: { onDone: () => void; onMsg: (m: string) => void }) {
  const [mdp, setMdp] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="gate-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await sb().auth.updateUser({ password: mdp });
        setBusy(false);
        if (error) return onMsg('Mot de passe refusé (8 caractères au moins).');
        onMsg('Mot de passe changé.');
        history.replaceState(null, '', `${location.pathname}#admin`);
        onDone();
      }}
    >
      <label className="gate-label" htmlFor="adm-new">
        Nouveau mot de passe
      </label>
      <input id="adm-new" className="gate-input admin-input" type="password" autoComplete="new-password" minLength={8} value={mdp} onChange={(e) => setMdp(e.target.value)} />
      <button className="btn primary gate-btn" disabled={busy || mdp.length < 8}>
        Enregistrer
      </button>
    </form>
  );
}

/** Deux onglets : les codes d'accès, et les chantiers partagés. */
function Admin(p: { email: string; onMsg: (m: string) => void; onLogout: () => void }) {
  const [onglet, setOnglet] = useState<'codes' | 'chantiers'>('codes');
  return (
    <>
      <div className="seg seg-2 admin-onglets" role="tablist" aria-label="Administration">
        {(
          [
            ['codes', 'Codes d’accès'],
            ['chantiers', 'Chantiers partagés'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={onglet === v} className={`seg-btn ${onglet === v ? 'on' : ''}`} onClick={() => setOnglet(v)}>
            {l}
          </button>
        ))}
      </div>
      {onglet === 'codes' ? <Codes {...p} /> : <Sessions onMsg={p.onMsg} />}
    </>
  );
}

function Codes({ email, onMsg, onLogout }: { email: string; onMsg: (m: string) => void; onLogout: () => void }) {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [appareils, setAppareils] = useState<Appareil[]>([]);
  const [nom, setNom] = useState('');
  const [duree, setDuree] = useState<number | null>(null);
  const [horsLigne, setHorsLigne] = useState(720);
  const [busy, setBusy] = useState(false);
  const [filtre, setFiltre] = useState<'actifs' | 'coupes' | 'tous'>('actifs');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const charger = async () => {
    const [c, a] = await Promise.all([
      sb().from('asp_codes').select('*').order('cree_le', { ascending: false }),
      sb().from('asp_appareils').select('*').order('dernier', { ascending: false }),
    ]);
    setNow(Date.now());
    if (c.error) onMsg('Liste des codes indisponible.');
    else setCodes(c.data as Code[]);
    if (!a.error) setAppareils(a.data as Appareil[]);
  };
  // Liste à jour toutes les 30 secondes : qui est en ligne, codes arrivés à leur fin.
  useEffect(() => {
    void charger();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void charger();
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creer = async () => {
    setBusy(true);
    const { data, error } = await sb().rpc('asp_creer_code', { p_nom: nom.trim(), p_duree_h: duree, p_hors_ligne_h: horsLigne });
    setBusy(false);
    if (error) return onMsg(error.message || 'Création impossible.');
    setNom('');
    const c = data as Code;
    setCodes((cur) => [c, ...(cur ?? [])]);
    onMsg(`Code ${formatCode(c.code)} créé pour « ${c.nom} »${c.expire_le ? `, jusqu’au ${quand(c.expire_le)}` : ''}. Touche « Partager » pour l’envoyer.`);
  };

  const partager = async (c: Code) => {
    const fin = c.expire_le ? `\nValable jusqu’au ${quand(c.expire_le)}.` : '';
    const text = `Ton code d’accès ASP Rail : ${formatCode(c.code)}${fin}\nOuvre ce lien sur ton téléphone, le code se remplit tout seul :\n${lienCode(c.code)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Code ASP Rail', text });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      onMsg('Message copié : colle-le dans WhatsApp, un SMS ou un mail.');
    } catch {
      onMsg(text);
    }
  };

  const couper = async (c: Code, coupe: boolean) => {
    const coupe_le = coupe ? new Date().toISOString() : null;
    // Réactiver un code arrivé à sa fin : il repart sans limite de durée.
    const patch: Partial<Code> = { coupe_le };
    if (!coupe && termine(c, Date.now())) patch.expire_le = null;
    const { error } = await sb().from('asp_codes').update(patch).eq('id', c.id);
    if (error) return onMsg('Modification impossible.');
    setCodes((cur) => (cur ?? []).map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    const h = c.hors_ligne_h ?? 720;
    onMsg(
      coupe
        ? `Code de ${c.nom} coupé : l’appli se ferme dans la minute sur ses téléphones connectés${h ? ` (sans réseau : au plus tard après ${dureeTexte(h)})` : ''}.`
        : `Code de ${c.nom} réactivé${patch.expire_le === null ? ', sans limite de durée' : ''}.`,
    );
  };

  const supprimer = async (c: Code) => {
    if (!window.confirm(`Supprimer le code de ${c.nom} ? Il ne pourra plus servir.`)) return;
    const { error } = await sb().from('asp_codes').delete().eq('id', c.id);
    if (error) return onMsg('Suppression impossible.');
    setCodes((cur) => (cur ?? []).filter((x) => x.id !== c.id));
  };

  const actif = (c: Code) => !c.coupe_le && !termine(c, now);
  const liste = useMemo(
    () => (codes ?? []).filter((c) => (filtre === 'tous' ? true : filtre === 'actifs' ? actif(c) : !actif(c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codes, filtre, now],
  );
  const enLigneMaintenant = (codes ?? []).filter((c) => actif(c) && enLigne(c.derniere_utilisation, now)).length;

  return (
    <>
      <p className="muted small">
        Connecté : {email} ·{' '}
        <button className="link-btn" onClick={onLogout}>
          se déconnecter
        </button>
      </p>
      <form
        className="admin-new"
        onSubmit={(e) => {
          e.preventDefault();
          if (nom.trim()) void creer();
        }}
      >
        <label className="gate-label" htmlFor="adm-nom">
          Nouveau code pour…
        </label>
        <input id="adm-nom" className="gate-input admin-input" placeholder="Nom de la personne ou de l’équipe" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
        <div className="admin-options">
          <label>
            <span>Durée</span>
            <select value={duree ?? ''} onChange={(e) => setDuree(e.target.value ? Number(e.target.value) : null)} aria-label="Durée du code">
              {DUREES.map(([v, l]) => (
                <option key={l} value={v ?? ''}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sans réseau</span>
            <select value={horsLigne} onChange={(e) => setHorsLigne(Number(e.target.value))} aria-label="Utilisation sans réseau">
              {HORS_LIGNE.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn primary admin-creer" disabled={busy || !nom.trim()}>
          Créer le code
        </button>
      </form>
      <p className="muted small admin-resume" aria-live="polite">
        {enLigneMaintenant ? (
          <>
            <span className="admin-enligne">●</span> {enLigneMaintenant} en ligne maintenant
          </>
        ) : (
          'Personne en ligne en ce moment'
        )}{' '}
        · mis à jour toutes les 30 s
      </p>
      <div className="seg seg-3 admin-filtre" role="radiogroup" aria-label="Codes affichés">
        {(
          [
            ['actifs', 'Actifs'],
            ['coupes', 'Arrêtés'],
            ['tous', 'Tous'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} role="radio" aria-checked={filtre === v} className={`seg-btn ${filtre === v ? 'on' : ''}`} onClick={() => setFiltre(v)}>
            {l}
          </button>
        ))}
      </div>
      {codes === null ? (
        <p className="muted">Chargement des codes…</p>
      ) : !liste.length ? (
        <p className="muted">Aucun code ici.</p>
      ) : (
        <ul className="admin-codes">
          {liste.map((c) => {
            const tel = appareils.filter((a) => a.code_id === c.id);
            const fini = termine(c, now);
            const h = c.hors_ligne_h ?? 720;
            return (
              <li key={c.id} className={!actif(c) ? 'coupe' : ''}>
                <div className="admin-code-top">
                  <b>
                    {actif(c) && enLigne(c.derniere_utilisation, now) && (
                      <span className="admin-enligne" aria-label="En ligne">
                        ●{' '}
                      </span>
                    )}
                    {c.nom}
                  </b>
                  <code>{formatCode(c.code)}</code>
                </div>
                <small>
                  {c.coupe_le
                    ? `Coupé ${ago(c.coupe_le)}`
                    : fini
                      ? `Fini depuis le ${quand(c.expire_le!)}`
                      : c.expire_le
                        ? `Jusqu’au ${quand(c.expire_le)}`
                        : 'Sans limite de durée'}
                  {' · '}
                  {h === 0 ? 'réseau obligatoire' : `${dureeTexte(h)} sans réseau`}
                </small>
                <small>
                  Créé {ago(c.cree_le)} ·{' '}
                  {actif(c) && enLigne(c.derniere_utilisation, now) ? 'en ligne maintenant' : c.derniere_utilisation ? `utilisé ${ago(c.derniere_utilisation)}` : 'pas encore utilisé'}
                  {tel.length > 0 && (
                    <>
                      {' · '}
                      <button className="link-btn" aria-expanded={ouvert === c.id} onClick={() => setOuvert(ouvert === c.id ? null : c.id)}>
                        {tel.length} téléphone{tel.length > 1 ? 's' : ''}
                      </button>
                    </>
                  )}
                </small>
                {ouvert === c.id && (
                  <ul className="admin-appareils" aria-label={`Téléphones de ${c.nom}`}>
                    {tel.map((a) => (
                      <li key={a.id}>
                        <span>{a.agent || 'Téléphone'}</span>
                        <small>
                          {enLigne(a.dernier, now) ? (
                            <>
                              <span className="admin-enligne">●</span> en ligne
                            </>
                          ) : (
                            `vu ${ago(a.dernier)}`
                          )}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="admin-code-actions">
                  {actif(c) && (
                    <button className="btn btn-small primary" onClick={() => void partager(c)}>
                      Partager
                    </button>
                  )}
                  <button className="btn btn-small" onClick={() => void couper(c, actif(c))}>
                    {actif(c) ? 'Couper' : 'Réactiver'}
                  </button>
                  <button className="btn btn-small danger" onClick={() => void supprimer(c)}>
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
