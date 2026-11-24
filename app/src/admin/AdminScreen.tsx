/**
 * Espace administrateur d'ASP Rail : connexion par e-mail et mot de passe (compte Supabase), puis gestion des codes
 * d'accès : créer un code nommé, le partager, le couper ou le réactiver, le supprimer.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { formatCode, lienCode } from '../access/gate';
import { SB_KEY, SB_URL } from '../lib/server';

interface Code {
  id: string;
  code: string;
  nom: string;
  cree_le: string;
  coupe_le: string | null;
  derniere_utilisation: string | null;
}

type Etat = { k: 'chargement' } | { k: 'connexion' } | { k: 'nouveau-mdp' } | { k: 'pas-admin'; email: string } | { k: 'admin'; email: string };

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  // Session à part (clé propre) : ASP Rail et les autres applis du même site ne se mélangent pas.
  client ??= createClient(SB_URL, SB_KEY, { auth: { storageKey: 'asp-admin-auth', persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
  return client;
}

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
        {etat.k === 'connexion' && <Connexion onOk={(email, admin) => setEtat(admin ? { k: 'admin', email } : { k: 'pas-admin', email })} onMsg={setMsg} />}
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
        {etat.k === 'admin' && <Codes email={etat.email} onMsg={setMsg} onLogout={() => void deconnexion()} />}
        <button className="link-btn admin-exit" onClick={onExit}>
          ← Revenir à l’appli
        </button>
      </div>
    </main>
  );
}

function Connexion({ onOk, onMsg }: { onOk: (email: string, admin: boolean) => void; onMsg: (m: string) => void }) {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

function Codes({ email, onMsg, onLogout }: { email: string; onMsg: (m: string) => void; onLogout: () => void }) {
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [nom, setNom] = useState('');
  const [busy, setBusy] = useState(false);
  const [filtre, setFiltre] = useState<'actifs' | 'coupes' | 'tous'>('actifs');

  const charger = async () => {
    const { data, error } = await sb().from('asp_codes').select('*').order('cree_le', { ascending: false });
    if (error) onMsg('Liste des codes indisponible.');
    else setCodes(data as Code[]);
  };
  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creer = async () => {
    setBusy(true);
    const { data, error } = await sb().rpc('asp_creer_code', { p_nom: nom.trim() });
    setBusy(false);
    if (error) return onMsg(error.message || 'Création impossible.');
    setNom('');
    const c = data as Code;
    setCodes((cur) => [c, ...(cur ?? [])]);
    onMsg(`Code ${formatCode(c.code)} créé pour « ${c.nom} ». Touche « Partager » pour l’envoyer.`);
  };

  const partager = async (c: Code) => {
    const text = `Ton code d’accès ASP Rail : ${formatCode(c.code)}\nOuvre ce lien sur ton téléphone, le code se remplit tout seul :\n${lienCode(c.code)}`;
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
    const { error } = await sb().from('asp_codes').update({ coupe_le }).eq('id', c.id);
    if (error) return onMsg('Modification impossible.');
    setCodes((cur) => (cur ?? []).map((x) => (x.id === c.id ? { ...x, coupe_le } : x)));
    onMsg(coupe ? `Code de ${c.nom} coupé : l’appli se fermera à sa prochaine vérification.` : `Code de ${c.nom} réactivé.`);
  };

  const supprimer = async (c: Code) => {
    if (!window.confirm(`Supprimer le code de ${c.nom} ? Il ne pourra plus servir.`)) return;
    const { error } = await sb().from('asp_codes').delete().eq('id', c.id);
    if (error) return onMsg('Suppression impossible.');
    setCodes((cur) => (cur ?? []).filter((x) => x.id !== c.id));
  };

  const liste = useMemo(
    () => (codes ?? []).filter((c) => (filtre === 'tous' ? true : filtre === 'actifs' ? !c.coupe_le : !!c.coupe_le)),
    [codes, filtre],
  );

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
        <div className="admin-new-row">
          <input id="adm-nom" className="gate-input admin-input" placeholder="Nom de la personne ou de l’équipe" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
          <button className="btn primary" disabled={busy || !nom.trim()}>
            Créer
          </button>
        </div>
      </form>
      <div className="seg seg-3 admin-filtre" role="radiogroup" aria-label="Codes affichés">
        {(
          [
            ['actifs', 'Actifs'],
            ['coupes', 'Coupés'],
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
          {liste.map((c) => (
            <li key={c.id} className={c.coupe_le ? 'coupe' : ''}>
              <div className="admin-code-top">
                <b>{c.nom}</b>
                <code>{formatCode(c.code)}</code>
              </div>
              <small>
                Créé {ago(c.cree_le)} · {c.coupe_le ? `coupé ${ago(c.coupe_le)}` : c.derniere_utilisation ? `utilisé ${ago(c.derniere_utilisation)}` : 'pas encore utilisé'}
              </small>
              <div className="admin-code-actions">
                {!c.coupe_le && (
                  <button className="btn btn-small primary" onClick={() => void partager(c)}>
                    Partager
                  </button>
                )}
                <button className="btn btn-small" onClick={() => void couper(c, !c.coupe_le)}>
                  {c.coupe_le ? 'Réactiver' : 'Couper'}
                </button>
                <button className="btn btn-small danger" onClick={() => void supprimer(c)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
