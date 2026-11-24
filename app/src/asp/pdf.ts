/**
 * Fiche CADA en PDF (A4), faite sur le téléphone avec jsPDF : chantier, plateforme, délais, points d'annonce,
 * dispositif, points à régler et check-lists. Chargé seulement quand on en a besoin.
 */
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { fmtLine, fmtPk } from '../lib/format';
import { ROLE_LABEL, SENS_LABEL, titreChantier, zoneTexte, effectifAnnonce, type Chantier, zoneAnnonce } from './chantier';
import { CHECKLISTS } from './checklists';
import { codesAgents, controlesDispositif } from './dispositif';
import { surveilleTexte } from './partage';
import { outillageLabel, SITUATION_LABEL, type Particularites, type Resultat } from './rules';
import { PARTICULARITES } from './textes';

/**
 * Les polices standard du PDF ne connaissent que les caractères latins courants (WinAnsi) : on remplace
 * le reste (flèches, ≥, espaces fines) par des équivalents lisibles.
 */
export function pdfText(s: string): string {
  return s
    .replace(/[   ]/g, ' ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/▲▼/g, '(2 sens)')
    .replace(/▲/g, '(+)')
    .replace(/▼/g, '(-)')
    .replace(/[‐-‒]/g, '-')
    .replace(/[^\x20-\x7e -ÿŒœ–—‘’“”…€\n]/g, '');
}

const NAVY: [number, number, number] = [19, 48, 92];
const YELLOW: [number, number, number] = [245, 180, 0];

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

function particularitesTexte(p: Particularites): string {
  const on = PARTICULARITES.filter((x) => p[x.key]).map((x) => x.label);
  return on.length ? on.join(' ; ') : 'Aucune';
}

export function fichePdf(c: Chantier, r: Resultat): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  let y = 0;

  // Bandeau.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 24, 'F');
  doc.setFillColor(...YELLOW);
  doc.rect(0, 24, W, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pdfText('Fiche CADA'), M, 11);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(pdfText('Calcul du délai et de la distance d’annonce · aide à la préparation (ASP Rail)'), M, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(pdfText(titreChantier(c)), W - M, 11, { align: 'right', maxWidth: 90 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(pdfText(`${fmtDate(c.date)} · ${c.horaire === 'nuit' ? 'de nuit' : 'de jour'}`), W - M, 18, { align: 'right' });
  doc.setTextColor(17, 24, 39);
  y = 32;

  const titre = (t: string) => {
    if (y > 265) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(pdfText(t), M, y);
    doc.setTextColor(17, 24, 39);
    y += 2;
  };
  const table = (head: string[] | null, body: string[][], opts: { kv?: boolean; widths?: Record<number, number> } = {}) => {
    autoTable(doc, {
      startY: y,
      head: head ? [head.map(pdfText)] : undefined,
      body: body.map((row) => row.map(pdfText)),
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, lineColor: [203, 213, 225], lineWidth: 0.2, textColor: [17, 24, 39], valign: 'middle' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: opts.kv ? { 0: { fontStyle: 'bold', cellWidth: 48, fillColor: [241, 245, 249] } } : (opts.widths ? Object.fromEntries(Object.entries(opts.widths).map(([k, w]) => [k, { cellWidth: w }])) : {}),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  };

  // Chantier.
  titre('Chantier');
  const z = zoneAnnonce(c);
  table(
    null,
    [
      ['Ligne', c.ligne ? `${fmtLine(c.ligne)}${c.ligneNom ? ` · ${c.ligneNom}` : ''}` : 'À préciser'],
      ['Zone de travail', zoneTexte(c)],
      ...(c.type === 'mobile' && z.debut !== null ? [['Zone sous annonce', `PK ${fmtPk(z.debut)} -> ${fmtPk(z.fin)} (${c.longueurAnnonce ?? '?'} m)`]] : []),
      ['Type de chantier', c.type === 'fixe' ? 'Fixe' : c.type === 'mobile' ? 'Mobile' : 'Itinérant'],
      ['Entreprise', c.entreprise || '—'],
      ['ASP', c.asp || '—'],
      ['Responsable du chantier', c.responsable || '—'],
      ['Effectif travaux', c.effectif === null ? '—' : String(c.effectif)],
      ['Effectif annonce', effectifAnnonce(c)],
    ],
    { kv: true },
  );

  // Plateforme.
  titre('Plateforme');
  const place = { travail: 'Voie de travail', contigue: 'Contiguë', traversee: 'À traverser', hors: 'Hors annonce' } as const;
  table(
    ['Voie', 'Sens des circulations', 'Vitesse', 'Place', 'Statut'],
    c.voies.map((v) => [v.nom || '—', SENS_LABEL[v.sens], v.vitesse ? `${v.vitesse} km/h` : '?', place[v.role], v.interdite ? 'Interdite (DFV)' : 'Circulée']),
  );

  // Délais.
  titre('Délais');
  table(
    null,
    [
      ['Situation', SITUATION_LABEL[r.situation]],
      ['Outillage', outillageLabel(c.outillage)],
      ['Particularités', particularitesTexte({ ...c.p, nuit: c.horaire === 'nuit' })],
      ['Délai de dégagement', r.dd.retenu === null ? 'À saisir' : `${r.dd.retenu} s${r.dd.saisi !== r.dd.retenu ? ` (saisi : ${r.dd.saisi ?? '-'} s)` : ''}`],
      ['Marge de sécurité', `${r.ms.valeur} s · ${r.ms.raisons.join(' ')}`],
      ['Délai d’annonce', r.da === null ? 'À calculer' : `${r.da} s (DD + MS)`],
    ],
    { kv: true },
  );

  // Points d'annonce.
  titre('Distances et points d’annonce');
  if (r.exemption) {
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(pdfText(`Annonce non obligatoire : ${r.exemption}`), W - 2 * M), M, y + 3);
    y += 10;
  }
  if (r.voies.length) {
    table(
      ['Voie', 'Sens', 'Vitesse', 'Délai', 'Distance', 'Limite amont', 'Point d’annonce'],
      r.voies.map((v) => [
        v.voie,
        SENS_LABEL[v.sens],
        v.vitesse ? `${v.vitesse} km/h` : '?',
        `${v.da} s`,
        v.distance ? `${v.distance} m` : '?',
        v.limiteAmont === null ? '?' : `PK ${fmtPk(v.limiteAmont)}`,
        v.pointAnnonce === null ? '?' : `PK ${fmtPk(v.pointAnnonce)}`,
      ]),
    );
  } else {
    doc.setFontSize(9);
    doc.text(pdfText('Aucune voie à annoncer.'), M, y + 3);
    y += 9;
  }

  // Dispositif.
  const codes = codesAgents(c.agents);
  titre(`Dispositif d’annonce (${effectifAnnonce(c)})`);
  table(
    ['', 'Rôle', 'Nom', 'Entreprise', 'Position', 'Surveille'],
    c.agents.map((a) => [codes.get(a.id) ?? '', ROLE_LABEL[a.role], a.nom || '—', a.entreprise || '—', a.pk === null ? '—' : `PK ${fmtPk(a.pk)}`, surveilleTexte(c, a.surveille) || '—']),
  );

  // Points à régler.
  const alertes = [...r.alertes, ...controlesDispositif(c, r)].filter((a) => a.niveau !== 'info');
  const erreursDd = r.dd.erreurs.map((t) => ({ niveau: 'stop' as const, texte: t }));
  const tout = [...erreursDd, ...alertes];
  if (tout.length) {
    titre('À régler et à vérifier');
    table(
      null,
      tout.map((a) => [a.niveau === 'stop' ? 'À régler' : 'À vérifier', a.texte]),
      { kv: true },
    );
  }

  // Check-lists.
  titre('Check-lists');
  table(
    null,
    CHECKLISTS.flatMap((l) => [
      [l.title, ''],
      ...l.items.map((i) => [c.checks[i.id] ? '[x]' : '[ ]', i.text]),
    ]),
    { widths: { 0: 14 } },
  );

  if (c.notes.trim()) {
    titre('Notes');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(pdfText(c.notes.trim()), W - 2 * M);
    doc.text(lines, M, y + 3);
  }

  // Pied de page.
  const pages = doc.getNumberOfPages();
  const quand = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfText(`Aide à la préparation : ne remplace ni le carnet CADA, ni l’AAn, ni les textes et consignes en vigueur. PK et vitesses à vérifier sur le terrain. Édité le ${quand} avec ASP Rail.`),
      M,
      290,
      { maxWidth: W - 2 * M - 16 },
    );
    doc.text(`${i}/${pages}`, W - M, 290, { align: 'right' });
  }
  return doc.output('blob');
}
