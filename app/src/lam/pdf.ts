/**
 * Journal de mission AP LAM ou AP S9 en PDF : la mission, le plan de situation, les étapes par phase, le carnet de
 * dépêches (n° reçu, n° donné), les événements et les signatures. Chargé seulement à l'export.
 */
import type { LineDoc } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { creerPdf, groupe, ligneGrise, nomPdf, type InfoExport } from '../lib/pdfKit';
import { planSituation } from '../lib/plan';
import { avancementLam, heure, OUTIL_S9, phasesLam, titreMissionLam, TYPE_MISSION, type MissionLam } from './mission';

const TYPE_EVT = { etape: 'Étape', depeche: 'Dépêche', note: 'Note', passage: 'Passage TTx', urgence: 'Urgence / aléa', situation: 'En voie' } as const;

const dateFr = (iso: string) => iso.split('-').reverse().join('/');
const duree = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
};

export function journalLamPdf(m: MissionLam, info: InfoExport, doc: LineDoc | null): File {
  const av = avancementLam(m);
  const titre = titreMissionLam(m);
  const debut = m.journal.length ? Math.min(...m.journal.map((e) => e.t)) : null;
  const lieu = [m.lieu.pk !== null ? `PK ${fmtPk(m.lieu.pk)}` : null, m.lieu.voie ? `voie ${m.lieu.voie}` : null, m.lieu.lieu || null].filter(Boolean).join(' · ');
  const k = creerPdf({
    titre: `Journal de mission ${TYPE_MISSION[m.type]}`,
    sousTitre: titre,
    ligne3: [lieu, `${dateFr(m.date)} ${m.horaire === 'nuit' ? 'de nuit' : 'de jour'}`].filter(Boolean).join(' · '),
    info,
    pied: `Aide à la mission : la ${m.type === 'lam' ? 'consigne LAM' : 'fiche de travail'}, la situation géographique et les dépêches officielles font foi.`,
  });

  k.titre('La mission');
  k.kv([
    ['Mission', m.type === 'lam' ? 'AP LAM : lorry automoteur' : 'AP S9 : bouclage et protection'],
    ['Ligne', m.lieu.ligne ? `${fmtLine(m.lieu.ligne)}${m.lieu.ligneNom ? ` · ${m.lieu.ligneNom}` : ''}` : 'À préciser'],
    ['Lieu', lieu || '—'],
    ...(m.type === 'lam'
      ? ([
          ['Engins', `${m.nbLam} LAM${m.engins.trim() ? ` · ${m.engins.trim()}` : ''}`],
          ['PN', m.pn ? 'Mise en voie ou traversée d’un PN' : 'Aucun'],
        ] as [string, string][])
      : ([
          ['Bouclage', m.bouclage.trim() || '—'],
          ['Outils', m.outils.map((o) => OUTIL_S9[o]).join(' · ') || '—'],
        ] as [string, string][])),
    ['Date', `${dateFr(m.date)} · ${m.horaire === 'nuit' ? 'de nuit' : 'de jour'}`],
    [m.type === 'lam' ? 'Consigne LAM' : 'Fiche de travail', m.consigne || '—'],
    ['Chef de chantier (CCh)', m.cch || '—'],
    ['RPTx', m.rptx || '—'],
    [
      'Déroulement',
      m.fin
        ? `Terminée à ${heure(m.fin)}${debut ? ` · début ${heure(debut)} · durée ${duree(m.fin - debut)}` : ''}`
        : `En cours : ${av.faites} étape(s) sur ${av.total}${debut ? ` · début ${heure(debut)}` : ''}`,
    ],
    ['Dépêches', `${m.depeches.length}${m.type === 's9' ? ` · ${m.ttx} train(s) travaux passé(s)` : ''}`],
  ]);

  if (doc && m.lieu.ligne && m.lieu.pk !== null) {
    const label = `${m.type === 'lam' ? 'Mise en voie' : m.bouclage.trim() ? `Bouclage ${m.bouclage.trim()}` : 'Bouclage'} · PK ${fmtPk(m.lieu.pk)}`;
    const p = planSituation(doc, m.lieu.pk, { rayon: 1200, marques: [{ pk: m.lieu.pk, label, genre: 'ici' }] });
    if (p) {
      k.titre('Plan de situation', 100);
      k.plan(p, { ligne: fmtLine(m.lieu.ligne), pk: m.lieu.pk });
    }
  }

  k.titre('Les étapes');
  const body = phasesLam(m).flatMap((ph) => [
    groupe(`${ph.titre}${ph.lieu ? ` · ${ph.lieu}` : ''}`, 3),
    ...ph.etapes.map((e) => {
      const t = m.faits[e.id];
      const d = m.depeches.find((x) => x.etape === e.id);
      const cells = [
        t ? heure(t) : '—',
        e.texte,
        d ? `${d.avec}${d.recu ? ` · reçu ${d.recu}` : ''}${d.donne ? ` · donné ${d.donne}` : ''}` : e.depeche ? 'Par dépêche' : '',
      ];
      return t ? cells : ligneGrise(cells);
    }),
  ]);
  k.table(['Heure', 'Étape', 'Dépêche'], body, { widths: { 0: 16, 2: 44 } });

  k.titre('Carnet de dépêches');
  if (m.depeches.length) {
    k.table(
      ['Heure', 'Avec', 'Objet', 'N° reçu', 'N° donné'],
      [...m.depeches].sort((a, b) => a.t - b.t).map((d) => [heure(d.t), d.avec, d.objet, d.recu || '—', d.donne || '—']),
      { widths: { 0: 16, 1: 18, 3: 18, 4: 19 } },
    );
  } else {
    k.note('Aucune dépêche notée.', { taille: 9 });
  }

  const evts = [...m.journal].filter((e) => e.type !== 'etape' && e.type !== 'depeche').sort((a, b) => a.t - b.t);
  if (evts.length) {
    k.titre('Événements');
    k.table(
      ['Heure', 'Type', 'Événement'],
      evts.map((e) => [heure(e.t), TYPE_EVT[e.type], `${e.texte}${e.note ? ` (${e.note})` : ''}`]),
      { widths: { 0: 16, 1: 30 } },
    );
  }

  k.titre('Signatures', 56);
  k.signatures([
    {
      titre: TYPE_MISSION[m.type],
      nom: info.agent,
      png: info.signature,
      quand: info.signeA ? `${new Date(info.signeA).toLocaleDateString('fr-FR')} à ${heure(info.signeA)}` : null,
    },
    { titre: m.type === 's9' ? 'RPTx ou CCh' : 'Chef de chantier (CCh)', nom: m.type === 's9' ? m.rptx || m.cch : m.cch },
  ]);

  return k.fichier(nomPdf(`Journal-${m.type === 'lam' ? 'AP-LAM' : 'AP-S9'}`, m.type === 's9' ? m.bouclage : m.lieu.lieu, info.cree));
}
