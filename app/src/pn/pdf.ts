/**
 * Journal de mission PN en PDF : la mission, le plan de situation, les étapes par phase avec leur heure et leur
 * dépêche, les événements (passages, dérangements, notes) et les signatures. Chargé seulement à l'export.
 */
import type { LineDoc } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { creerPdf, groupe, ligneGrise, nomPdf, type InfoExport } from '../lib/pdfKit';
import { planSituation } from '../lib/plan';
import { dateFr, dateHeure, duree, heureDans } from '../lib/temps';
import { avancement, phases, ROLE_PN, titreMission, TYPE_PN, type Mission } from './mission';

const COMMANDE = { boitier: 'Boîtier de commutateurs', ma: 'Commutateur Marche-Arrêt' } as const;
const TYPE_EVT = { passage: 'Passage', derangement: 'Dérangement', note: 'Note', etape: 'Étape', annulation: 'Annulation' } as const;


export function journalPnPdf(m: Mission, info: InfoExport, doc: LineDoc | null): File {
  const av = avancement(m);
  const titre = titreMission(m);
  const h = (t: number) => heureDans(t, m.date);
  const debut = m.journal.length ? Math.min(...m.journal.map((e) => e.t)) : null;
  const k = creerPdf({
    titre: 'Journal de mission PN',
    sousTitre: titre,
    ligne3: [ROLE_PN[m.role], m.pn.lieu, `${dateFr(m.date)} ${m.horaire === 'nuit' ? 'de nuit' : 'de jour'}`].filter(Boolean).join(' · '),
    info,
    pied: 'Aide-mémoire : le carnet du PN, la consigne PN et les dépêches officielles font foi.',
  });

  k.titre('La mission');
  k.kv([
    ['Mission', ROLE_PN[m.role]],
    ['PN', `PN ${m.pn.numero || '?'}${m.pn.lieu ? ` · ${m.pn.lieu}` : ''}`],
    ['Ligne', m.pn.ligne ? `${fmtLine(m.pn.ligne)}${m.pn.ligneNom ? ` · ${m.pn.ligneNom}` : ''}` : 'À préciser'],
    ['PK', m.pn.pk !== null ? fmtPk(m.pn.pk) : '—'],
    [
      'Équipement',
      [m.pn.type ? TYPE_PN[m.pn.type] : null, COMMANDE[m.pn.commande], m.pn.bal ? 'ligne BAL' : 'hors BAL', m.pn.voies === 'unique' ? 'voie unique' : 'double voie'].filter(Boolean).join(' · '),
    ],
    ['Date', `${dateFr(m.date)} · ${m.horaire === 'nuit' ? 'de nuit' : 'de jour'}`],
    ['Contrat travaux', [m.contrat, m.indice && `indice ${m.indice}`].filter(Boolean).join(' · ') || '—'],
    ['Chef de chantier (CCh)', m.cch || '—'],
    ['RPTx', m.rptx || '—'],
    [
      'Déroulement',
      m.fin
        ? `Terminée à ${h(m.fin)}${debut ? ` · début ${h(debut)} · durée ${duree(m.fin - debut)}` : ''}`
        : `En cours : ${av.faites} étape(s) sur ${av.total}${debut ? ` · début ${h(debut)}` : ''}`,
    ],
    ...(m.role === 'travaux' ? ([['Passages', `${m.passages} mobile(s) travaux · ${m.lam} LAM mis en voie`]] as [string, string][]) : []),
  ]);

  if (doc && m.pn.ligne && m.pn.pk !== null) {
    const p = planSituation(doc, m.pn.pk, { rayon: 1200, marques: [{ pk: m.pn.pk, label: `PN ${m.pn.numero || '?'} · PK ${fmtPk(m.pn.pk)}`, genre: 'ici' }] });
    if (p) {
      k.titre('Plan de situation', 100);
      k.plan(p, { ligne: fmtLine(m.pn.ligne), pk: m.pn.pk });
    }
  }

  k.titre('Les étapes');
  const body = phases(m).flatMap((ph) => [
    groupe(`${ph.titre}${ph.lieu ? ` · ${ph.lieu}` : ''}`, 3),
    ...ph.etapes.map((e) => {
      const t = m.faits[e.id];
      const cells = [t ? h(t) : '—', `${e.texte}${e.facultative ? ' (facultatif)' : ''}`, m.depeches[e.id] ? `Dépêche ${m.depeches[e.id]}` : ''];
      return t ? cells : ligneGrise(cells);
    }),
  ]);
  k.table(['Heure', 'Étape', 'Dépêche'], body, { widths: { 0: 16, 2: 32 } });

  const evts = [...m.journal].filter((e) => e.type !== 'etape').sort((a, b) => a.t - b.t);
  if (evts.length) {
    k.titre('Événements');
    k.table(
      ['Heure', 'Type', 'Événement'],
      evts.map((e) => [h(e.t), TYPE_EVT[e.type], `${e.texte}${e.note ? ` (${e.note})` : ''}`]),
      { widths: { 0: 16, 1: 28 } },
    );
  }
  if (m.notes.trim()) {
    k.titre('Notes');
    k.note(m.notes.trim());
  }

  k.titre('Signatures', 56);
  k.signatures([
    { titre: 'Agent PN', nom: info.agent, png: info.signature, quand: info.signeA ? `${dateHeure(info.signeA)}` : null },
    { titre: 'Chef de chantier (CCh) ou RPTx', nom: m.cch || m.rptx },
  ]);

  return k.fichier(nomPdf('Journal-PN', `PN${m.pn.numero || ''}`, info.cree));
}
