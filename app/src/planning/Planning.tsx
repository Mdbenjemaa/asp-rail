/**
 * Mon planning ETF : la carte de l'accueil (service du jour, la semaine en un coup d'œil, « Préparer ») et l'écran
 * de la semaine. Import du PDF reçu par mail : lu sur le téléphone, seule ma ligne est gardée.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadAccess } from '../access/gate';
import { Icon } from '../components/parts';
import type { Ctx } from '../asp/contexte';
import { Feuille } from '../asp/Fiche';
import { Ecran } from '../asp/kit';
import { nomAgent } from '../lib/signature';
import { jourDe } from '../lib/temps';
import { activitesDuPoste, horaireTexte, interpreter, prochainService, serviceDuMoment, titreJour, travaille, type JourPlanning } from './jour';
import { lirePlanning, memeAgent, nomNormal, proches, type AgentLu, type PlanningLu } from './lire';
import { oublierPartage, recupererPartage } from './partage';
import { garderNomPlanning, garderSemaine, joursDe, jourDans, nomPlanning, oublierSemaine, statutDuFichier, useSemaines, type SemainePlanning } from './store';

export type ActivitePlanning = 'asp' | 'pn' | 'lam';

const NOM_ACTIVITE: Record<ActivitePlanning, string> = {
  asp: 'Préparer le chantier d’annonce',
  pn: 'Préparer la mission PN',
  lam: 'Préparer la mission LAM / S9',
};
const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const dateLongue = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d)
    .toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace('.', '');
};

function sousTitre(j: JourPlanning): string {
  return [j.poste, horaireTexte(j), j.lieu].filter(Boolean).join(' · ');
}

/** Court, pour la semaine en un coup d'œil : « ANN », « RH », « 21h ». */
function court(j: JourPlanning | null): string {
  if (!j || !j.lignes.length) return '–';
  if (j.code) return j.code.length > 4 ? j.code.slice(0, 3) : j.code;
  if (j.poste)
    return j.poste
      .replace(/^doublon\s+/i, '')
      .split(/[/ ]/)[0]
      .slice(0, 5);
  return j.debut ? `${Number(j.debut.slice(0, 2))}h` : '•';
}

/* ---------- Import du PDF ---------- */

interface Choix {
  lu: PlanningLu;
  fichier: string;
}

/**
 * Import : lecture des PDF, recherche de ma ligne, puis (au premier import) le choix de mon nom dans la liste.
 * Plusieurs PDF (choisis ensemble ou partagés depuis Gmail) passent l'un après l'autre ; un seul message à la fin.
 */
function useImport(ctx: Ctx, apres?: (id: string) => void) {
  const entree = useRef<HTMLInputElement>(null);
  const [lecture, setLecture] = useState(false);
  const [choix, setChoix] = useState<Choix | null>(null);
  /** PDF qui attendent que l'agent ait choisi sa ligne. */
  const attente = useRef<File[]>([]);

  const garder = (lu: PlanningLu, agent: AgentLu, fichier: string): string | null => {
    const statut = statutDuFichier(fichier);
    const r = garderSemaine({ semaine: lu.semaine, annee: lu.annee, lundi: lu.lundi, statut, fichier, nom: agent.nom, jours: agent.jours });
    if (r === 'refusee') return null;
    apres?.(`${lu.annee}-S${String(lu.semaine).padStart(2, '0')}`);
    if (r === 'gardee-definitive') return `S${lu.semaine} : le définitif déjà importé est gardé (ce PDF est le provisoire).`;
    const jours = agent.jours.filter((l) => travaille(interpreter(l, lu.lundi))).length;
    const st = statut === 'provisoire' ? ' (provisoire)' : statut === 'definitif' ? ' (définitif)' : '';
    return `${r === 'remplacee' ? 'Mise à jour' : 'Importé'} : semaine ${lu.semaine}${st}, ${jours} jour${jours > 1 ? 's' : ''} de travail.`;
  };

  /** Un PDF : le message à afficher, ou 'choix' si l'agent doit d'abord choisir sa ligne. */
  const lire = async (f: File): Promise<string | null | 'choix'> => {
    try {
      const { morceauxDuPdf } = await import('./pdf');
      const lu = lirePlanning(await morceauxDuPdf(await f.arrayBuffer()));
      if (!lu) return `« ${f.name} » ne ressemble pas à un planning ETF : pas de colonnes « lun … dim » ni de noms d’agents.`;
      const retenu = nomPlanning();
      const moi =
        (retenu && lu.agents.find((a) => nomNormal(a.nom) === nomNormal(retenu))) || (retenu && lu.agents.find((a) => memeAgent(a.nom, retenu))) || null;
      if (moi) return garder(lu, moi, f.name);
      if (retenu) return `Ta ligne (${retenu}) n’est pas dans ce planning de la semaine ${lu.semaine}. Les provisoires « courts » n’ont qu’une partie des agents.`;
      // Premier import : on demande qui on est (le nom du code d'accès ou de l'export PDF est proposé en premier).
      setChoix({ lu, fichier: f.name });
      return 'choix';
    } catch (e) {
      return `Lecture de « ${f.name} » impossible : ${e instanceof Error ? e.message : 'fichier abîmé ?'}`;
    }
  };

  const importer = async (fichiers: File[], deja: string[] = []) => {
    setLecture(true);
    const messages = [...deja];
    try {
      for (let k = 0; k < fichiers.length; k++) {
        const r = await lire(fichiers[k]);
        if (r === 'choix') {
          attente.current = fichiers.slice(k + 1);
          break;
        }
        if (r) messages.push(r);
      }
    } finally {
      setLecture(false);
    }
    if (messages.length) ctx.onToast(messages.join(' '));
  };

  const champ = (
    <input
      ref={entree}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      hidden
      aria-label="Planning ETF (PDF)"
      onChange={(e) => {
        const fs = [...(e.target.files ?? [])];
        e.target.value = '';
        if (fs.length) void importer(fs);
      }}
    />
  );
  // Par-dessus tout (la carte de l'accueil est sous la barre de navigation).
  const feuille =
    choix &&
    createPortal(
      <ChoixNom
        choix={choix}
        onClose={() => {
          attente.current = [];
          setChoix(null);
        }}
        onChoisir={(a) => {
          garderNomPlanning(a.nom);
          setChoix(null);
          const msg = garder(choix.lu, a, choix.fichier);
          const reste = attente.current;
          attente.current = [];
          void importer(reste, msg ? [msg] : []);
        }}
      />,
      document.body,
    );
  return { ouvrir: () => entree.current?.click(), importer, lecture, champ, feuille };
}

function ChoixNom(p: { choix: Choix; onClose: () => void; onChoisir: (a: AgentLu) => void }) {
  const [q, setQ] = useState('');
  const agents = p.choix.lu.agents;
  const devine = useMemo(() => {
    const noms = [nomAgent(), loadAccess()?.nom ?? ''].filter(Boolean);
    const r: AgentLu[] = [];
    for (const n of noms) for (const a of proches(agents, n)) if (!r.includes(a)) r.push(a);
    return r.slice(0, 3);
  }, [agents]);
  const liste = q.trim() ? agents.filter((a) => nomNormal(a.nom).includes(nomNormal(q))) : [...devine, ...agents.filter((a) => !devine.includes(a))];
  return (
    <Feuille title="Qui es-tu dans ce planning ?" onClose={p.onClose}>
      <p className="ds-hint" style={{ marginTop: 0 }}>
        Choisis ta ligne une seule fois : les prochains plannings la retrouveront seuls. Seule ta ligne est gardée sur ce téléphone.
      </p>
      <div className="asp-field">
        <label htmlFor="planning-cherche">Chercher mon nom</label>
        <input id="planning-cherche" className="asp-input" value={q} placeholder="Nom ou prénom" autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="ds-list" style={{ marginTop: 12 }}>
        {liste.slice(0, 60).map((a, k) => (
          <button key={`${a.nom}-${k}`} className="ds-row" onClick={() => p.onChoisir(a)}>
            <span className="ds-row-txt">
              <b>{a.nom}</b>
              <small>{[a.adresse, a.jours.map((l) => l[0] ?? '').find(Boolean)].filter(Boolean).join(' · ')}</small>
            </span>
            {!q.trim() && devine.includes(a) && <span className="ds-status ok">Proposé</span>}
          </button>
        ))}
        {!liste.length && <p className="ds-hint">Aucun nom ne correspond.</p>}
      </div>
    </Feuille>
  );
}

/* ---------- Carte de l'accueil ---------- */

export function CartePlanning(p: { ctx: Ctx; onPreparer: (a: ActivitePlanning) => void; activite: ActivitePlanning }) {
  const semaines = useSemaines();
  const [maintenant] = useState(() => Date.now());
  const imp = useImport(p.ctx, () => p.ctx.open({ k: 'planning' }));
  const jour = (d: string) => jourDans(semaines, d);
  const s = serviceDuMoment(jour, maintenant);
  const auj = jourDe(maintenant);

  if (!semaines.length || !s) {
    return (
      <section className="ds-card ds-planning vide" aria-label="Mon planning ETF">
        <div className="ds-planning-ico">
          <Icon name="calendar" size={26} />
        </div>
        <div className="ds-planning-txt">
          <b>{semaines.length ? 'Pas de planning pour cette semaine' : 'Mon planning ETF'}</b>
          <small>
            {semaines.length ? 'Importe le dernier PDF reçu par mail.' : 'Importe le PDF reçu par mail : l’appli trouve ta ligne et prépare tes missions.'}
          </small>
        </div>
        <button className="ds-btn" onClick={imp.ouvrir} disabled={imp.lecture}>
          {imp.lecture ? 'Lecture…' : 'Importer'}
        </button>
        {semaines.length > 0 && (
          <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'planning' })}>
            Mes semaines
          </button>
        )}
        {imp.champ}
        {imp.feuille}
      </section>
    );
  }

  const enCours = s.date !== auj;
  const prochain = travaille(s) ? null : prochainService(jour, maintenant);
  const activites = activitesDuPoste(s.poste);
  const cible: ActivitePlanning | null = travaille(s) ? (activites.includes(p.activite) ? p.activite : (activites[0] ?? p.activite)) : null;
  const [a, m, d] = s.date.split('-').map(Number);
  const lundi = new Date(a, m - 1, d - ((new Date(a, m - 1, d).getDay() + 6) % 7));
  const semaine = LETTRES.map((l, i) => {
    const t = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i);
    const date = jourDe(t.getTime());
    return { l, date, j: jour(date) };
  });
  return (
    <section className="ds-hero ds-planning" aria-label="Mon planning ETF">
      <div className="ds-hero-top">
        <span className="ds-tag">
          {enCours ? 'Nuit en cours' : 'Aujourd’hui'}
          {travaille(s) && s.nuit && !enCours ? ' · nuit' : ''} · planning ETF
        </span>
        <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'planning' })}>
          Ma semaine
        </button>
      </div>
      <h2>{titreJour(s)}</h2>
      {sousTitre(s) && <div className="ds-hero-sub">{sousTitre(s)}</div>}
      {s.ps && <div className="ds-hero-sub">Prise de service : {s.ps}</div>}
      {prochain && (
        <div className="ds-hero-sub">
          Prochain service : {dateLongue(prochain.date)} · {titreJour(prochain)}
          {horaireTexte(prochain) ? ` · ${horaireTexte(prochain)}` : ''}
        </div>
      )}
      <ol className="ds-semaine" aria-label="Ma semaine">
        {semaine.map((x) => (
          <li
            key={x.date}
            className={`${x.date === auj ? 'auj' : ''} ${travaille(x.j) ? 'travail' : ''} ${x.j?.nuit ? 'nuit' : ''}`}
            aria-label={`${dateLongue(x.date)} : ${x.j ? titreJour(x.j) : 'pas de planning'}`}
          >
            <span>{x.l}</span>
            <b>{court(x.j)}</b>
          </li>
        ))}
      </ol>
      {cible && (
        <div className="ds-hero-actions">
          <button className="ds-btn primary" onClick={() => p.onPreparer(cible)}>
            {NOM_ACTIVITE[cible]}
          </button>
        </div>
      )}
      {imp.champ}
      {imp.feuille}
    </section>
  );
}

/* ---------- Écran « Mon planning » ---------- */

export function PlanningScreen(p: { ctx: Ctx; hidden?: boolean; partage?: boolean }) {
  const semaines = useSemaines();
  const tri = useMemo(() => [...semaines].sort((a, b) => a.lundi.localeCompare(b.lundi)), [semaines]);
  const [maintenant] = useState(() => Date.now());
  const auj = jourDe(maintenant);
  const actuelle = tri.find((s) => joursDe(s).some((j) => j.date === auj)) ?? tri[tri.length - 1] ?? null;
  const [choisie, setChoisie] = useState<string | null>(null);
  const imp = useImport(p.ctx, setChoisie);
  // Ouvert par un partage depuis Gmail : on importe le ou les PDF reçus, une seule fois.
  const partageLu = useRef(false);
  const importer = useRef(imp.importer);
  useEffect(() => {
    importer.current = imp.importer;
  });
  useEffect(() => {
    if (!p.partage || partageLu.current) return;
    partageLu.current = true;
    oublierPartage();
    void recupererPartage()
      .catch(() => [] as File[])
      .then((fs) => (fs.length ? importer.current(fs) : p.ctx.onToast('Aucun PDF reçu par le partage : importe-le avec le bouton ci-dessous.')));
  }, [p.partage, p.ctx]);
  const sem: SemainePlanning | null = tri.find((s) => s.id === choisie) ?? actuelle;
  const [nom, setNom] = useState(nomPlanning);
  return (
    <Ecran
      label="Mon planning ETF"
      title="Mon planning ETF"
      onBack={p.ctx.back}
      hidden={p.hidden}
      actions={
        <button className="ds-btn primary big" onClick={imp.ouvrir} disabled={imp.lecture}>
          <Icon name="file" size={22} />
          {imp.lecture ? 'Lecture du PDF…' : 'Importer un planning (PDF)'}
        </button>
      }
    >
      {tri.length > 0 && (
        <div className="ds-chips scroll" role="radiogroup" aria-label="Semaine">
          {tri.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === sem?.id} className="ds-chip" onClick={() => setChoisie(s.id)}>
              S{s.semaine}
            </button>
          ))}
        </div>
      )}
      {sem ? (
        <>
          <p className="ds-hint">
            Semaine {sem.semaine} · du {dateLongue(joursDe(sem)[0].date)} au {dateLongue(joursDe(sem)[6].date)}
            {sem.statut === 'definitif' ? ' · définitif' : sem.statut === 'provisoire' ? ' · provisoire' : ''}
          </p>
          <div className="ds-list ds-jours">
            {joursDe(sem).map((j) => (
              <div
                key={j.date}
                className={`ds-jour ${j.date === auj ? 'auj' : ''} ${travaille(j) ? 'travail' : 'repos'}`}
                aria-label={`${dateLongue(j.date)} : ${titreJour(j)}`}
              >
                <span className="ds-jour-date">
                  <small>{dateLongue(j.date).split(' ')[0]}</small>
                  <b>{Number(j.date.slice(8))}</b>
                </span>
                <span className="ds-jour-txt">
                  <b>{titreJour(j)}</b>
                  {sousTitre(j) && <small>{sousTitre(j)}</small>}
                  {j.ps && <small>Prise de service : {j.ps}</small>}
                  {j.otp && <small>OTP {j.otp}</small>}
                  {travaille(j) &&
                    j.lignes
                      .filter(
                        (l) =>
                          !/^".*"?$/.test(l) &&
                          !l.includes('[') &&
                          !/^p\.?\s?s/i.test(l) &&
                          !/OTP/i.test(l) &&
                          l !== j.lieu &&
                          !/\d{1,2}\s*[hH:]\s*\d{0,2}\s*-/.test(l),
                      )
                      .map((l, k) => <small key={k}>{l}</small>)}
                </span>
                {travaille(j) && j.nuit && (
                  <span className="ds-jour-nuit" aria-label="Nuit">
                    <Icon name="moon" size={18} />
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="ds-hint">
            Importé depuis « {sem.fichier || 'PDF'} ». Ta ligne : {sem.nom}.{' '}
            <button
              className="ds-btn text inline"
              onClick={() => {
                oublierSemaine(sem.id);
                setChoisie(null);
                p.ctx.onToast(`Semaine ${sem.semaine} oubliée.`);
              }}
            >
              Oublier cette semaine
            </button>
          </p>
        </>
      ) : (
        <section className="ds-card ds-empty" aria-label="Aucun planning">
          <div className="ds-empty-art">
            <Icon name="calendar" size={48} />
          </div>
          <h2>Importe ton planning ETF</h2>
          <p>
            Sur Android, dans Gmail : ouvre le PDF du mail « Planning Sécurité chantiers », puis Partager → ASP Rail. Sinon, enregistre le PDF et choisis-le ici. L’appli lit le PDF sur le téléphone et ne garde que ta ligne.
          </p>
        </section>
      )}
      {nom && (
        <p className="ds-hint">
          Les prochains plannings sont lus pour « {nom} ».{' '}
          <button
            className="ds-btn text inline"
            onClick={() => {
              garderNomPlanning('');
              setNom('');
              p.ctx.onToast('Au prochain import, tu choisiras ta ligne dans la liste.');
            }}
          >
            Ce n’est pas moi
          </button>
        </p>
      )}
      {imp.champ}
      {imp.feuille}
    </Ecran>
  );
}
