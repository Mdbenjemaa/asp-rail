/**
 * Page ouverte par un lien d'invitation (…/#admin&invitation=…) : la personne invitée choisit son mot de passe, ou,
 * si elle a déjà un compte qui ne peut pas être changé par lien, se connecte pour accepter l'invitation.
 */
import { useEffect, useState } from 'react';
import { SB_KEY, SB_URL } from '../lib/server';
import { sb } from './client';

interface Vue {
  ok: boolean;
  raison?: 'inconnu' | 'utilise' | 'fin';
  email?: string;
  entreprise?: string;
  expire_le?: string;
  mode?: 'creer' | 'reinit' | 'connexion';
}

const RAISON: Record<string, string> = {
  inconnu: 'Ce lien d’invitation n’est pas reconnu. Vérifie qu’il est complet, ou demande un nouveau lien.',
  utilise: 'Ce lien a déjà servi. Connecte-toi avec ton e-mail et ton mot de passe, ou demande un nouveau lien.',
  fin: 'Ce lien est arrivé à sa fin (7 jours). Demande un nouveau lien à l’administrateur d’ASP Rail.',
  mot_de_passe: 'Mot de passe refusé : 8 caractères au moins, et pas un mot de passe trop connu.',
  compte: 'Compte impossible à préparer. Demande un nouveau lien à l’administrateur d’ASP Rail.',
  serveur: 'Le serveur ne répond pas. Réessaie dans un instant.',
};

export function Invitation(p: { jeton: string; onFini: () => void; onAbandon: () => void; onMsg: (m: string) => void }) {
  const [vue, setVue] = useState<Vue | null>(null);
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [connexion, setConnexion] = useState(false);

  useEffect(() => {
    let actif = true;
    sb()
      .rpc('asp_voir_invitation', { p_jeton: p.jeton })
      .then(({ data, error }) => {
        if (!actif) return;
        if (error) return setVue({ ok: false, raison: 'inconnu' });
        const v = data as Vue;
        setVue(v);
        setConnexion(v.mode === 'connexion');
      });
    return () => {
      actif = false;
    };
  }, [p.jeton]);

  const choisir = async () => {
    if (!vue?.email) return;
    if (mdp.length < 8) return setErr('8 caractères au moins.');
    if (mdp !== mdp2) return setErr('Les deux mots de passe ne sont pas pareils.');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${SB_URL}/functions/v1/asp-invitation`, {
        method: 'POST',
        headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeton: p.jeton, mot_de_passe: mdp }),
        signal: AbortSignal.timeout(20_000),
      });
      const r = (await res.json().catch(() => ({ ok: false, raison: 'serveur' }))) as { ok: boolean; raison?: string; entreprise?: string };
      if (!r.ok) {
        if (r.raison === 'connexion') {
          setConnexion(true);
          return setErr('Tu as déjà un compte : connecte-toi avec ton mot de passe pour accepter l’invitation.');
        }
        return setErr(RAISON[r.raison ?? 'serveur'] ?? RAISON.serveur);
      }
      const { error } = await sb().auth.signInWithPassword({ email: vue.email, password: mdp });
      if (error) return setErr('Mot de passe enregistré, mais la connexion a échoué : connecte-toi depuis l’espace administrateur.');
      p.onMsg(`Bienvenue : tu administres maintenant « ${r.entreprise || vue.entreprise} » sur ASP Rail.`);
      p.onFini();
    } catch {
      setErr(RAISON.serveur);
    } finally {
      setBusy(false);
    }
  };

  const accepter = async () => {
    if (!vue?.email) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await sb().auth.signInWithPassword({ email: vue.email, password: mdp });
      if (error) return setErr('Mot de passe incorrect.');
      const { data, error: e2 } = await sb().rpc('asp_accepter_invitation', { p_jeton: p.jeton });
      const r = data as { ok?: boolean; entreprise?: string } | null;
      if (e2 || !r?.ok) return setErr('Invitation impossible à accepter avec ce compte. Demande un nouveau lien.');
      p.onMsg(`Invitation acceptée : tu administres maintenant « ${r.entreprise || vue.entreprise} ».`);
      p.onFini();
    } catch {
      setErr(RAISON.serveur);
    } finally {
      setBusy(false);
    }
  };

  if (!vue) return <p className="muted">Lecture de l’invitation…</p>;
  if (!vue.ok)
    return (
      <>
        <p className="error" role="alert">
          {RAISON[vue.raison ?? 'inconnu']}
        </p>
        <button className="btn wide" onClick={p.onAbandon}>
          Aller à la connexion
        </button>
      </>
    );

  return (
    <form
      className="gate-form admin-invite"
      onSubmit={(e) => {
        e.preventDefault();
        void (connexion ? accepter() : choisir());
      }}
    >
      <h2 className="admin-h2" style={{ margin: '4px 0 0' }}>
        Espace « {vue.entreprise} »
      </h2>
      <p className="muted small">
        Invitation pour <b>{vue.email}</b>
        {vue.expire_le ? `, valable jusqu’au ${new Date(vue.expire_le).toLocaleDateString('fr-FR')}` : ''}.
      </p>
      <input type="email" autoComplete="username" value={vue.email} readOnly hidden />
      {connexion ? (
        <>
          <label className="gate-label" htmlFor="inv-mdp">
            Ton mot de passe
          </label>
          <input id="inv-mdp" className="gate-input admin-input" type="password" autoComplete="current-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
          <button className="btn primary gate-btn" disabled={busy || !mdp}>
            {busy ? 'Connexion…' : 'Se connecter et accepter'}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">{vue.mode === 'reinit' ? 'Choisis un nouveau mot de passe pour ton compte.' : 'Choisis ton mot de passe (8 caractères au moins). Personne d’autre ne le connaît.'}</p>
          <label className="gate-label" htmlFor="inv-mdp">
            Mot de passe
          </label>
          <input id="inv-mdp" className="gate-input admin-input" type="password" autoComplete="new-password" minLength={8} value={mdp} onChange={(e) => setMdp(e.target.value)} />
          <label className="gate-label" htmlFor="inv-mdp2">
            Encore une fois
          </label>
          <input id="inv-mdp2" className="gate-input admin-input" type="password" autoComplete="new-password" minLength={8} value={mdp2} onChange={(e) => setMdp2(e.target.value)} />
          <button className="btn primary gate-btn" disabled={busy || mdp.length < 8 || !mdp2}>
            {busy ? 'Enregistrement…' : 'Enregistrer mon mot de passe'}
          </button>
        </>
      )}
      {err && (
        <p className="gate-error" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
