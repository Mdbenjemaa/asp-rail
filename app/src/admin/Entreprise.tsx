/**
 * Onglet « Entreprise » de l'espace administrateur.
 *  - Tous les administrateurs : nom et logo de l'entreprise, agents actifs, liste des administrateurs.
 *  - Administrateur d'ASP Rail en plus : contenu de l'appli pour cette entreprise (planning ETF, mémos, quiz),
 *    invitation des administrateurs (lien à usage unique), nouvelle entreprise, suppression.
 */
import { useEffect, useState } from 'react';
import { MODULES_TEXTE, type Modules } from '../access/entreprise';
import { lienInvitation, sb, type Role } from './client';
import { preparerLogo } from './logo';

interface Resume {
  id: string;
  nom: string;
  modules: Modules;
  logo_v: number;
  codes_actifs: number;
  actifs_jour: number;
  actifs_7j: number;
  actifs_30j: number;
  telephones_7j: number;
  agents: { nom: string; vu: string; telephones: number }[];
  admins: string[];
  invitations: { id: string; email: string; expire_le: string }[];
}

const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' à');
const ago = (iso: string) => {
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 2) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.floor(min / 60)} h`;
  const j = Math.floor(min / (24 * 60));
  return j === 1 ? 'hier' : `il y a ${j} jours`;
};

/** Partage d'un texte (WhatsApp, SMS, mail…), sinon copie. */
async function envoyerTexte(titre: string, text: string, onMsg: (m: string) => void) {
  try {
    if (navigator.share) {
      await navigator.share({ title: titre, text });
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
}

const texteInvitation = (entreprise: string, email: string, lien: string) =>
  `Tu es invité(e) à gérer l’espace « ${entreprise} » sur ASP Rail (${email}).\nOuvre ce lien sur ton téléphone pour choisir ton mot de passe. Il est valable 7 jours et ne sert qu’une fois :\n${lien}`;

export function EntrepriseOnglet(p: { role: Role; id: string; onMsg: (m: string) => void; onRole: (choisir?: string | null) => void }) {
  const [resume, setResume] = useState<Resume | null>(null);
  const [erreur, setErreur] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [nouvelle, setNouvelle] = useState('');
  const [busy, setBusy] = useState(false);
  const [lien, setLien] = useState<{ email: string; lien: string } | null>(null);

  const charger = async () => {
    const { data, error } = await sb().rpc('asp_resume_entreprises');
    if (error) return setErreur(true);
    const r = ((data ?? []) as Resume[]).find((x) => x.id === p.id) ?? null;
    setErreur(false);
    setResume(r);
    if (r) setNom(r.nom);
    if (r && r.logo_v > 0) {
      const l = await sb().from('asp_entreprises').select('logo').eq('id', p.id).maybeSingle();
      setLogo((l.data as { logo?: string | null } | null)?.logo ?? null);
    } else setLogo(null);
  };
  useEffect(() => {
    void Promise.resolve().then(charger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);

  const maj = async (args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { error } = await sb().rpc('asp_maj_entreprise', { p_id: p.id, ...args });
    setBusy(false);
    if (error) return p.onMsg(error.message || 'Modification impossible.');
    p.onMsg(ok);
    await charger();
    if ('p_nom' in args) p.onRole(p.id);
  };

  const choisirLogo = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = await preparerLogo(f);
      await maj({ p_logo: data }, 'Logo enregistré : il apparaît sur l’accueil et les PDF des agents à leur prochaine connexion.');
    } catch (e) {
      p.onMsg(e instanceof Error ? e.message : 'Logo impossible.');
    }
  };

  const inviter = async (adresse: string) => {
    const m = adresse.trim().toLowerCase();
    if (!m) return;
    setBusy(true);
    const { data, error } = await sb().rpc('asp_inviter_admin', { p_entreprise: p.id, p_email: m });
    setBusy(false);
    if (error) return p.onMsg(error.message || 'Invitation impossible.');
    const r = data as { jeton: string; email: string };
    setEmail('');
    setLien({ email: r.email, lien: lienInvitation(r.jeton) });
    p.onMsg(`Lien créé pour ${r.email}. Touche « Envoyer le lien » : valable 7 jours, une seule fois.`);
    await charger();
  };

  const retirer = async (adresse: string) => {
    if (!window.confirm(`Retirer ${adresse} des administrateurs de ${resume?.nom ?? 'cette entreprise'} ?`)) return;
    const { error } = await sb().from('asp_entreprise_admins').delete().eq('entreprise_id', p.id).eq('email', adresse);
    if (error) return p.onMsg('Retrait impossible.');
    p.onMsg(`${adresse} n’administre plus ${resume?.nom ?? 'cette entreprise'}.`);
    await charger();
  };

  const annuler = async (id: string) => {
    const { error } = await sb().from('asp_invitations').delete().eq('id', id);
    if (error) return p.onMsg('Annulation impossible.');
    setLien(null);
    await charger();
  };

  const creer = async () => {
    setBusy(true);
    const { data, error } = await sb().rpc('asp_creer_entreprise', { p_nom: nouvelle.trim() });
    setBusy(false);
    if (error) return p.onMsg(error.message || 'Création impossible.');
    const e = data as { id: string; nom: string };
    setNouvelle('');
    p.onMsg(`Entreprise « ${e.nom} » créée, sans mémo, quiz ni planning ETF : règle son contenu, puis invite son administrateur.`);
    p.onRole(e.id);
  };

  const supprimer = async () => {
    if (!resume) return;
    if (!window.confirm(`Supprimer « ${resume.nom} », ses ${resume.codes_actifs} code(s) actif(s), ses chantiers partagés et ses administrateurs ? C’est définitif.`)) return;
    const { error } = await sb().rpc('asp_supprimer_entreprise', { p_id: p.id });
    if (error) return p.onMsg(error.message || 'Suppression impossible.');
    p.onMsg(`Entreprise « ${resume.nom} » supprimée.`);
    p.onRole(null);
  };

  if (erreur) return <p className="muted">Entreprise indisponible pour le moment.</p>;
  if (!resume) return <p className="muted">Chargement…</p>;
  const sup = p.role.super;

  return (
    <div className="admin-ent">
      <section aria-label="Nom et logo">
        <h2 className="admin-h2">Nom et logo</h2>
        <div className="admin-logo">
          {logo ? <img src={logo} alt={`Logo de ${resume.nom}`} /> : <span className="admin-logo-vide">Pas de logo</span>}
          <div className="admin-logo-actions">
            <label className="btn btn-small">
              {logo ? 'Changer le logo' : 'Choisir un logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                aria-label="Logo de l’entreprise"
                onChange={(e) => {
                  void choisirLogo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {logo && (
              <button className="btn btn-small" disabled={busy} onClick={() => void maj({ p_effacer_logo: true }, 'Logo retiré.')}>
                Retirer
              </button>
            )}
          </div>
        </div>
        <form
          className="admin-new-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (nom.trim() && nom.trim() !== resume.nom) void maj({ p_nom: nom.trim() }, 'Nom enregistré.');
          }}
        >
          <input className="gate-input admin-input" aria-label="Nom de l’entreprise" maxLength={60} value={nom} onChange={(e) => setNom(e.target.value)} />
          <button className="btn" disabled={busy || !nom.trim() || nom.trim() === resume.nom}>
            Enregistrer
          </button>
        </form>
        <p className="muted small">Affichés sur l’accueil des agents et en tête de leurs PDF.</p>
      </section>

      <section aria-label="Contenu de l’appli">
        <h2 className="admin-h2">Contenu de l’appli</h2>
        {(Object.keys(MODULES_TEXTE) as (keyof Modules)[]).map((k) => (
          <label key={k} className="admin-module">
            <input
              type="checkbox"
              role="switch"
              checked={resume.modules[k]}
              disabled={!sup || busy}
              onChange={(e) => void maj({ p_modules: { ...resume.modules, [k]: e.target.checked } }, `${MODULES_TEXTE[k][0]} : ${e.target.checked ? 'activé' : 'désactivé'} pour ${resume.nom}.`)}
            />
            <span>
              <b>{MODULES_TEXTE[k][0]}</b>
              <small>{MODULES_TEXTE[k][1]}</small>
            </span>
          </label>
        ))}
        <p className="muted small">{sup ? 'Les agents voient le changement à leur prochaine vérification du code (une minute au plus).' : 'Réglé par l’administrateur d’ASP Rail.'}</p>
      </section>

      <section aria-label="Agents actifs">
        <h2 className="admin-h2">Agents actifs</h2>
        <div className="admin-stats">
          <div>
            <b>{resume.actifs_jour}</b>
            <small>aujourd’hui</small>
          </div>
          <div>
            <b>{resume.actifs_7j}</b>
            <small>7 jours</small>
          </div>
          <div>
            <b>{resume.actifs_30j}</b>
            <small>30 jours</small>
          </div>
          <div>
            <b>{resume.codes_actifs}</b>
            <small>codes actifs</small>
          </div>
        </div>
        {resume.agents.length ? (
          <ul className="admin-appareils" aria-label="Codes utilisés ces 30 derniers jours">
            {resume.agents.map((a, i) => (
              <li key={`${a.nom}-${i}`}>
                <span>
                  {a.nom}
                  {a.telephones ? ` · ${a.telephones} tél.` : ''}
                </span>
                <small>{ago(a.vu)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Aucun code utilisé ces 30 derniers jours.</p>
        )}
      </section>

      <section aria-label="Administrateurs">
        <h2 className="admin-h2">Administrateurs</h2>
        {resume.admins.length ? (
          <ul className="admin-codes" aria-label={`Administrateurs de ${resume.nom}`}>
            {resume.admins.map((a) => (
              <li key={a}>
                <div className="admin-code-top">
                  <b>{a}</b>
                </div>
                {sup && (
                  <div className="admin-code-actions">
                    <button className="btn btn-small" disabled={busy} onClick={() => void inviter(a)}>
                      Nouveau lien
                    </button>
                    <button className="btn btn-small danger" onClick={() => void retirer(a)}>
                      Retirer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{sup ? 'Pas encore d’administrateur : invite le responsable de l’entreprise.' : 'Aucun.'}</p>
        )}
        {sup && resume.invitations.length > 0 && (
          <ul className="admin-appareils admin-invit" aria-label="Invitations en attente">
            {resume.invitations.map((i) => (
              <li key={i.id}>
                <span>Invitation : {i.email}</span>
                <small>
                  jusqu’au {quand(i.expire_le)} ·{' '}
                  <button className="link-btn" onClick={() => void annuler(i.id)}>
                    annuler
                  </button>
                </small>
              </li>
            ))}
          </ul>
        )}
        {sup && (
          <form
            className="admin-new"
            onSubmit={(e) => {
              e.preventDefault();
              void inviter(email);
            }}
          >
            <label className="gate-label" htmlFor="adm-inviter">
              Inviter un administrateur
            </label>
            <div className="admin-new-row">
              <input id="adm-inviter" className="gate-input admin-input" type="email" placeholder="prenom.nom@entreprise.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn primary" disabled={busy || !email.trim()}>
                Créer le lien
              </button>
            </div>
            <p className="muted small">La personne choisit elle-même son mot de passe. Mot de passe oublié ? « Nouveau lien » lui permet d’en choisir un autre.</p>
          </form>
        )}
        {sup && lien && (
          <div className="admin-lien-pret" role="group" aria-label="Lien d’invitation prêt">
            <p>
              Lien pour <b>{lien.email}</b>, prêt à envoyer.
            </p>
            <button className="btn primary wide" onClick={() => void envoyerTexte('Invitation ASP Rail', texteInvitation(resume.nom, lien.email, lien.lien), p.onMsg)}>
              Envoyer le lien
            </button>
          </div>
        )}
      </section>

      {sup && (
        <section aria-label="Toutes les entreprises">
          <h2 className="admin-h2">Nouvelle entreprise</h2>
          <form
            className="admin-new-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (nouvelle.trim()) void creer();
            }}
          >
            <input className="gate-input admin-input" aria-label="Nom de la nouvelle entreprise" placeholder="Nom de l’entreprise cliente" maxLength={60} value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} />
            <button className="btn primary" disabled={busy || !nouvelle.trim()}>
              Créer
            </button>
          </form>
          {p.role.entreprises.length > 1 && (
            <button className="btn btn-small danger admin-suppr-ent" onClick={() => void supprimer()}>
              Supprimer « {resume.nom} »
            </button>
          )}
        </section>
      )}
    </div>
  );
}
