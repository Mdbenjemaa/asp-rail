/**
 * Onglet « Archives » de l'espace administrateur : les dossiers de fin de mission envoyés par les agents de
 * l'entreprise à la clôture (PDF signés). Télécharger, chercher, supprimer.
 */
import { useEffect, useMemo, useState } from 'react';
import { sb } from './client';

type TypeMission = 'asp' | 'pn' | 'lam' | 'chaine';

interface ArchiveAdmin {
  id: string;
  type: TypeMission;
  titre: string;
  date_mission: string | null;
  agent: string;
  code_nom: string;
  nom_fichier: string;
  taille: number;
  chemin: string;
  cloture_le: string;
  recu_le: string;
}

const TYPE: Record<TypeMission, string> = { asp: 'ASP', pn: 'Agent PN', lam: 'AP LAM / S9', chaine: 'Chaîne' };
const FILTRES: [TypeMission | 'tous', string][] = [
  ['tous', 'Tous'],
  ['asp', 'ASP'],
  ['pn', 'PN'],
  ['lam', 'LAM/S9'],
  ['chaine', 'Chaîne'],
];
const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' à');
const jour = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const ko = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);
const sansAccent = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Le PDF par le partage du téléphone, sinon téléchargé. */
async function partager(f: File) {
  try {
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({ files: [f], title: f.name });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function Archives({ entreprise, onMsg }: { entreprise: { id: string; nom: string }; onMsg: (m: string) => void }) {
  const [liste, setListe] = useState<ArchiveAdmin[] | null>(null);
  const [filtre, setFiltre] = useState<TypeMission | 'tous'>('tous');
  const [cherche, setCherche] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const charger = async () => {
    const { data, error } = await sb()
      .from('asp_archives')
      .select('id, type, titre, date_mission, agent, code_nom, nom_fichier, taille, chemin, cloture_le, recu_le')
      .eq('entreprise_id', entreprise.id)
      .order('recu_le', { ascending: false })
      .limit(500);
    if (error) return onMsg('Archives indisponibles pour le moment.');
    setListe(data as ArchiveAdmin[]);
  };
  useEffect(() => {
    void Promise.resolve().then(charger);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void charger();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vus = useMemo(() => {
    const q = sansAccent(cherche.trim());
    return (liste ?? []).filter((a) => (filtre === 'tous' || a.type === filtre) && (!q || sansAccent(`${a.titre} ${a.agent} ${a.code_nom}`).includes(q)));
  }, [liste, filtre, cherche]);
  const parMois = useMemo(() => {
    const m = new Map<string, ArchiveAdmin[]>();
    for (const a of vus) {
      const k = new Date(a.recu_le).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.entries()];
  }, [vus]);

  const telecharger = async (a: ArchiveAdmin) => {
    setBusy(a.id);
    try {
      const { data, error } = await sb().storage.from('asp-archives').download(a.chemin);
      if (error || !data) return onMsg('Téléchargement impossible.');
      await partager(new File([data], a.nom_fichier, { type: 'application/pdf' }));
    } finally {
      setBusy(null);
    }
  };

  const supprimer = async (a: ArchiveAdmin) => {
    if (!window.confirm(`Supprimer le dossier « ${a.titre} » de ${a.agent || a.code_nom || 'l’agent'} ? Il ne pourra pas être récupéré.`)) return;
    const f = await sb().storage.from('asp-archives').remove([a.chemin]);
    if (f.error) return onMsg('Suppression impossible.');
    const { error } = await sb().from('asp_archives').delete().eq('id', a.id);
    if (error) return onMsg('Suppression impossible.');
    setListe((cur) => (cur ?? []).filter((x) => x.id !== a.id));
    onMsg(`Dossier « ${a.titre} » supprimé.`);
  };

  return (
    <>
      <p className="muted small">
        Dossiers de fin de mission envoyés par les agents de {entreprise.nom} à la clôture : le PDF signé, tel que l’agent l’a téléchargé.
      </p>
      <div className="seg seg-5 admin-filtre" role="radiogroup" aria-label="Sorte de mission">
        {FILTRES.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={filtre === v} className={`seg-btn ${filtre === v ? 'on' : ''}`} onClick={() => setFiltre(v)}>
            {l}
          </button>
        ))}
      </div>
      <input className="gate-input admin-input admin-cherche" type="search" aria-label="Chercher un dossier" placeholder="Chercher : chantier, agent…" value={cherche} onChange={(e) => setCherche(e.target.value)} />
      {liste === null ? (
        <p className="muted">Chargement…</p>
      ) : !vus.length ? (
        <p className="muted">{liste.length ? 'Aucun dossier ne correspond.' : 'Aucun dossier reçu pour le moment.'}</p>
      ) : (
        <>
          <p className="muted small admin-resume">
            {vus.length} dossier{vus.length > 1 ? 's' : ''}
          </p>
          {parMois.map(([mois, l]) => (
            <section key={mois} aria-label={mois}>
              <h2 className="admin-h2 admin-mois">{mois.charAt(0).toUpperCase() + mois.slice(1)}</h2>
              <ul className="admin-codes" aria-label={`Dossiers de ${mois}`}>
                {l.map((a) => (
                  <li key={a.id}>
                    <div className="admin-code-top">
                      <b>{a.titre}</b>
                      <span className="admin-type">{TYPE[a.type]}</span>
                    </div>
                    <small>
                      Mission du {jour(a.date_mission)} · {a.agent || 'agent'}
                      {a.code_nom && a.code_nom !== a.agent ? ` (code ${a.code_nom})` : ''}
                    </small>
                    <small>
                      Clôturée le {quand(a.cloture_le)} · {ko(a.taille)}
                    </small>
                    <div className="admin-code-actions">
                      <button className="btn btn-small primary" disabled={busy === a.id} onClick={() => void telecharger(a)}>
                        {busy === a.id ? 'Téléchargement…' : 'Télécharger'}
                      </button>
                      <button className="btn btn-small danger" onClick={() => void supprimer(a)}>
                        Supprimer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
