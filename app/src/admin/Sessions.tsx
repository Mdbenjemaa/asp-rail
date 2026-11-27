/**
 * Chantiers partagés, côté administrateur : créer une session de chantier (un code de 6 signes, une durée),
 * l'envoyer aux intervenants, voir qui partage quoi, l'arrêter ou la supprimer.
 */
import { useEffect, useState } from 'react';
import { formatSession, lienSession } from '../partage/session';
import { sb } from './client';

interface SessionAdmin {
  id: string;
  code: string;
  nom: string;
  cree_le: string;
  expire_le: string;
  coupe_le: string | null;
}

interface PartageAdmin {
  id: string;
  session_id: string;
  activite: 'asp' | 'pn' | 'lam';
  nom: string;
  maj: string;
  donnees: { titre?: string; etat?: string };
}

const DUREES: [number, string][] = [
  [12, '12 heures'],
  [24, '1 jour'],
  [72, '3 jours'],
  [168, '7 jours'],
  [744, '31 jours'],
];
const ACT = { asp: 'ASP', pn: 'Agent PN', lam: 'AP LAM / S9' } as const;
const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' à');
const ouverte = (s: SessionAdmin, now: number) => !s.coupe_le && Date.parse(s.expire_le) > now;

export function Sessions({ onMsg }: { onMsg: (m: string) => void }) {
  const [sessions, setSessions] = useState<SessionAdmin[] | null>(null);
  const [partages, setPartages] = useState<PartageAdmin[]>([]);
  const [nom, setNom] = useState('');
  const [duree, setDuree] = useState(24);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const charger = async () => {
    const [s, p] = await Promise.all([
      sb().from('asp_sessions').select('*').order('cree_le', { ascending: false }),
      sb().from('asp_partages').select('id, session_id, activite, nom, maj, donnees').order('maj', { ascending: false }),
    ]);
    setNow(Date.now());
    if (s.error) onMsg('Liste des chantiers partagés indisponible.');
    else setSessions(s.data as SessionAdmin[]);
    if (!p.error) setPartages(p.data as PartageAdmin[]);
  };
  useEffect(() => {
    void Promise.resolve().then(charger);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void charger();
    }, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creer = async () => {
    setBusy(true);
    const { data, error } = await sb().rpc('asp_creer_session', { p_nom: nom.trim(), p_duree_h: duree });
    setBusy(false);
    if (error) return onMsg(error.message || 'Création impossible.');
    setNom('');
    const s = data as SessionAdmin;
    setSessions((cur) => [s, ...(cur ?? [])]);
    onMsg(`Chantier « ${s.nom} » créé : code ${formatSession(s.code)}, jusqu’au ${quand(s.expire_le)}. Touche « Envoyer le code » pour le donner aux intervenants.`);
  };

  const envoyer = async (s: SessionAdmin) => {
    const text = `Chantier partagé « ${s.nom} » sur ASP Rail : code ${formatSession(s.code)} (jusqu’au ${quand(s.expire_le)}).\nOuvre ce lien sur ton téléphone pour le rejoindre :\n${lienSession(s.code)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Chantier partagé ASP Rail', text });
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

  const arreter = async (s: SessionAdmin) => {
    const coupe_le = new Date().toISOString();
    const { error } = await sb().from('asp_sessions').update({ coupe_le }).eq('id', s.id);
    if (error) return onMsg('Arrêt impossible.');
    setSessions((cur) => (cur ?? []).map((x) => (x.id === s.id ? { ...x, coupe_le } : x)));
    onMsg(`Chantier « ${s.nom} » arrêté : il disparaît des téléphones à leur prochaine mise à jour (30 s).`);
  };

  const supprimer = async (s: SessionAdmin) => {
    if (!window.confirm(`Supprimer le chantier partagé « ${s.nom} » et tout ce qui y est partagé ?`)) return;
    const { error } = await sb().from('asp_sessions').delete().eq('id', s.id);
    if (error) return onMsg('Suppression impossible.');
    setSessions((cur) => (cur ?? []).filter((x) => x.id !== s.id));
  };

  return (
    <>
      <form
        className="admin-new"
        onSubmit={(e) => {
          e.preventDefault();
          if (nom.trim()) void creer();
        }}
      >
        <label className="gate-label" htmlFor="adm-chantier">
          Nouveau chantier partagé
        </label>
        <input
          id="adm-chantier"
          className="gate-input admin-input"
          placeholder="Ex. : Remplacement traverses, nuit du 27"
          maxLength={80}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <div className="admin-options">
          <label>
            <span>Durée</span>
            <select value={duree} onChange={(e) => setDuree(Number(e.target.value))} aria-label="Durée du chantier partagé">
              {DUREES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn primary admin-creer" disabled={busy || !nom.trim()}>
          Créer le chantier partagé
        </button>
      </form>
      <p className="muted small">
        Seuls les intervenants qui ont reçu le code du chantier se voient sur la carte ; chacun choisit ce qu’il partage. Le chantier s’arrête seul à la fin de
        sa durée.
      </p>
      {sessions === null ? (
        <p className="muted">Chargement…</p>
      ) : !sessions.length ? (
        <p className="muted">Aucun chantier partagé.</p>
      ) : (
        <ul className="admin-codes" aria-label="Chantiers partagés">
          {sessions.map((s) => {
            const ok = ouverte(s, now);
            const qui = partages.filter((p) => p.session_id === s.id);
            return (
              <li key={s.id} className={ok ? '' : 'coupe'}>
                <div className="admin-code-top">
                  <b>{s.nom}</b>
                  <code>{formatSession(s.code)}</code>
                </div>
                <small>{s.coupe_le ? `Arrêté le ${quand(s.coupe_le)}` : ok ? `Jusqu’au ${quand(s.expire_le)}` : `Fini depuis le ${quand(s.expire_le)}`}</small>
                {qui.length > 0 ? (
                  <ul className="admin-appareils" aria-label={`Intervenants de ${s.nom}`}>
                    {qui.map((p) => (
                      <li key={p.id}>
                        <span>
                          {ACT[p.activite]} · {p.nom || 'Sans nom'}
                          {p.donnees?.etat ? ` · ${p.donnees.etat}` : ''}
                        </span>
                        <small>mis à jour {quand(p.maj)}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <small>Personne ne partage encore.</small>
                )}
                <div className="admin-code-actions">
                  {ok && (
                    <button className="btn btn-small primary" onClick={() => void envoyer(s)}>
                      Envoyer le code
                    </button>
                  )}
                  {ok && (
                    <button className="btn btn-small" onClick={() => void arreter(s)}>
                      Arrêter
                    </button>
                  )}
                  <button className="btn btn-small danger" onClick={() => void supprimer(s)}>
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
