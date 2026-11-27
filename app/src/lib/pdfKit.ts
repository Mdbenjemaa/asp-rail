/**
 * Mise en page commune des PDF (A4, faits sur le téléphone avec jsPDF, même sans réseau) : bandeau avec
 * « Créé le » et l'agent, titres de partie, tableaux, plan de situation, cadres de signature, pied de page.
 * Chargé seulement au moment d'un export.
 */
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import { fmtPk } from './format';
import { coordonnees, lienCarte, type PlanSituation } from './plan';

export interface InfoExport {
  /** Nom de l'agent qui exporte. */
  agent: string;
  /** Signature au doigt (image PNG en data URL). */
  signature: string | null;
  signeA: number | null;
  cree: Date;
  /** Deuxième signataire (responsable du chantier), quand le document en demande un. */
  second?: { nom: string; signature: string | null; signeA: number | null };
  /**
   * Police Unicode (DejaVu Sans, TrueType en base64) pour écrire ce que les polices standard du PDF ne savent pas :
   * arabe, polonais, grec, cyrillique… Ajoutée au PDF seulement si un texte en a besoin.
   */
  police?: string | null;
}

type Rgb = [number, number, number];
const NAVY: Rgb = [19, 48, 92];
const YELLOW: Rgb = [245, 180, 0];
const INK: Rgb = [17, 24, 39];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [203, 213, 225];
const SOFT: Rgb = [241, 245, 249];
const RED: Rgb = [200, 30, 30];

const deux = (n: number) => String(n).padStart(2, '0');
const heureDe = (d: Date) => `${deux(d.getHours())}:${deux(d.getMinutes())}`;
const dateDe = (d: Date) => `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`;
/** « 25/11/2026 à 10:25 » */
const fmtCree = (d: Date) => `${dateDe(d)} à ${heureDe(d)}`;
/** « 2026-11-25-1025 », pour les noms de fichier. */
const horodatage = (d: Date) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}`;

/** Nom de fichier sans accents ni espaces. */
export function nomPdf(prefixe: string, titre: string, cree: Date): string {
  const base = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${prefixe}${base ? `-${base}` : ''}-${horodatage(cree)}.pdf`;
}

/** Ce que les polices standard du PDF (WinAnsi) savent écrire. */
const WINANSI = /^[\x20-\x7e\u00a0-\u00ffŒœŠšŽžŸƒˆ˜–—‘’‚“”„†‡•…‰‹›€™\n]*$/;
/** Ce que la police Unicode embarquée sait écrire (latin étendu, grec, cyrillique, arabe, symboles). */
const HORS_UNICODE = /[^\x20-\x7e\u00a0-\u024f\u0370-\u04ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff\u2000-\u22ff\u25a0-\u26ff\n]/g;

/**
 * Texte prêt pour le PDF : flèches et signes remplacés par des équivalents lisibles. Sans police Unicode, seuls
 * les caractères latins courants restent ; avec (`unicode`), l'arabe, le polonais, le grec… restent aussi.
 */
export function pdfText(s: string, unicode = false): string {
  const t = s
    .normalize('NFC')
    .replace(/[\u2009\u202f\u00a0]/g, ' ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/▲▼/g, '(2 sens)')
    .replace(/▲/g, '(+)')
    .replace(/▼/g, '(-)')
    .replace(/[\u2010-\u2012]/g, '-');
  return unicode ? t.replace(HORS_UNICODE, '') : t.replace(/[^\x20-\x7e\u00a0-\u00ffŒœŠšŽžŸƒˆ˜–—‘’‚“”„†‡•…‰‹›€™\n]/g, '');
}

export interface CaseSignature {
  titre: string;
  nom: string;
  png?: string | null;
  quand?: string | null;
}

export interface Kit {
  doc: jsPDF;
  W: number;
  M: number;
  /** Titre de partie, avec un saut de page s'il reste moins de `place` mm. */
  titre: (t: string, place?: number) => void;
  kv: (rows: [string, string][]) => void;
  table: (head: string[] | null, body: RowInput[], opts?: { widths?: Record<number, number>; taille?: number }) => void;
  note: (t: string, opts?: { taille?: number; couleur?: Rgb }) => void;
  plan: (p: PlanSituation, ici: { ligne: string; pk: number }) => void;
  signatures: (cases: CaseSignature[]) => void;
  /** Finit le document (pieds de page) et le rend en fichier. */
  fichier: (nom: string) => File;
}

/** Cellule de titre de groupe (phase) sur toute la largeur d'un tableau. */
export const groupe = (texte: string, colonnes: number): RowInput => [
  { content: pdfText(texte), colSpan: colonnes, styles: { fillColor: SOFT, textColor: NAVY, fontStyle: 'bold' } },
];
/** Ligne grisée (étape pas encore faite). */
export const ligneGrise = (cells: string[]): RowInput => cells.map((c) => ({ content: pdfText(c), styles: { textColor: MUTED } }));

export function creerPdf(e: { titre: string; sousTitre: string; ligne3?: string; info: InfoExport; pied: string }): Kit {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const BAS = H - 16;
  let y = 0;
  const cree = fmtCree(e.info.cree);

  // Police Unicode, ajoutée au document au premier texte qui en a besoin.
  let unicodePret = false;
  const unicode = (): boolean => {
    if (!e.info.police) return false;
    if (!unicodePret) {
      doc.addFileToVFS('DejaVuSans.ttf', e.info.police);
      doc.addFont('DejaVuSans.ttf', 'dejavu', 'normal');
      unicodePret = true;
    }
    return true;
  };
  /** Choisit la police qui sait écrire ce texte et rend le texte prêt (taille et couleur à régler avant). */
  const ecrit = (t: string, gras = false): string => {
    const u = pdfText(t, true);
    if (!WINANSI.test(u) && unicode()) {
      doc.setFont('dejavu', 'normal');
      return u;
    }
    doc.setFont('helvetica', gras ? 'bold' : 'normal');
    return pdfText(t);
  };
  /** Cellule de tableau : le texte, la police étant choisie au moment du dessin (didParseCell). */
  const prep = (t: string) => pdfText(t, !!e.info.police);
  const policeCellule = (d: { cell: { text: string[]; styles: { font: string; fontStyle: string } } }) => {
    if (!WINANSI.test(d.cell.text.join(' ')) && unicode()) {
      d.cell.styles.font = 'dejavu';
      d.cell.styles.fontStyle = 'normal';
    }
  };

  // Bandeau.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 31, 'F');
  doc.setFillColor(...YELLOW);
  doc.rect(0, 31, W, 2, 'F');
  const gauche = W - 2 * M - 64;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(ecrit(e.titre, true), M, 12, { maxWidth: gauche });
  doc.setFontSize(10.5);
  doc.text(doc.splitTextToSize(ecrit(e.sousTitre, true), gauche)[0] as string, M, 19.5);
  if (e.ligne3) {
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(doc.splitTextToSize(ecrit(e.ligne3), gauche)[0] as string, M, 25.5);
  }
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Créé le', W - M, 9.5, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(pdfText(cree), W - M, 15, { align: 'right' });
  doc.setFontSize(9.5);
  doc.text(ecrit(`Agent : ${e.info.agent.trim() || 'non renseigné'}`), W - M, 21.5, { align: 'right', maxWidth: 64 });
  doc.setTextColor(...INK);
  y = 42;

  const saut = (place: number) => {
    if (y + place > BAS) {
      doc.addPage();
      y = 22;
    }
  };
  const apresTable = () => {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };
  const styles = (taille = 9) => ({
    font: 'helvetica',
    fontSize: taille,
    cellPadding: 1.8,
    lineColor: LINE,
    lineWidth: 0.2,
    textColor: INK,
    valign: 'middle' as const,
    overflow: 'linebreak' as const,
    // jspdf-autotable demande un réordonnancement « logique » du texte, qui retourne une 2e fois l'arabe déjà
    // mis en forme par jsPDF : sans option, jsPDF garde l'ordre visuel, juste.
    textOptions: {},
  });
  const marges = { left: M, right: M, top: 22, bottom: 20 };

  const kit: Kit = {
    doc,
    W,
    M,
    titre(t, place = 30) {
      saut(place);
      doc.setFontSize(12.5);
      doc.setTextColor(...NAVY);
      doc.text(ecrit(t, true), M, y);
      doc.setFillColor(...YELLOW);
      doc.rect(M, y + 1.6, 12, 0.9, 'F');
      doc.setTextColor(...INK);
      y += 4.5;
    },
    kv(rows) {
      autoTable(doc, {
        startY: y,
        body: rows.map(([k, v]) => [prep(k), prep(v)]),
        didParseCell: policeCellule,
        margin: marges,
        theme: 'grid',
        styles: styles(),
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 46, fillColor: SOFT } },
      });
      apresTable();
    },
    table(head, body, opts = {}) {
      autoTable(doc, {
        startY: y,
        head: head ? [head.map((h) => pdfText(h))] : undefined,
        body: body.map((row) => (Array.isArray(row) ? row.map((c) => (typeof c === 'string' ? prep(c) : c)) : row)) as RowInput[],
        didParseCell: policeCellule,
        margin: marges,
        theme: 'grid',
        styles: styles(opts.taille),
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: opts.widths ? Object.fromEntries(Object.entries(opts.widths).map(([k, w]) => [k, { cellWidth: w }])) : {},
      });
      apresTable();
    },
    note(t, opts = {}) {
      doc.setFontSize(opts.taille ?? 9);
      doc.setTextColor(...(opts.couleur ?? INK));
      const lignes = doc.splitTextToSize(ecrit(t), W - 2 * M) as string[];
      const h = lignes.length * (opts.taille ?? 9) * 0.42 + 2;
      saut(h);
      doc.text(lignes, M, y + 1);
      doc.setTextColor(...INK);
      y += h + 3;
    },
    plan(p, ici) {
      saut(84);
      dessinerPlan(doc, p, M, y, W - 2 * M, 62);
      y += 62 + 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      const debut = pdfText(`Ligne ${ici.ligne} · PK ${fmtPk(ici.pk)} · ${coordonnees(p.centre)} · `);
      doc.text(debut, M, y);
      doc.setTextColor(29, 78, 216);
      doc.textWithLink('Ouvrir dans une carte', M + doc.getTextWidth(debut), y, { url: lienCarte(p.centre) });
      doc.setTextColor(...MUTED);
      doc.setFontSize(7.5);
      doc.text(pdfText('Plan d’après les données ouvertes SNCF Réseau, à titre indicatif : le schéma de ligne et la situation géographique priment.'), M, y + 4.2);
      doc.setTextColor(...INK);
      y += 12;
    },
    signatures(cases) {
      saut(48);
      const gap = 6;
      const w = (W - 2 * M - gap * (cases.length - 1)) / cases.length;
      const h = 36;
      cases.forEach((c, i) => {
        const x = M + i * (w + gap);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 2, 2, 'S');
        doc.setFontSize(9);
        doc.setTextColor(...NAVY);
        doc.text(ecrit(c.titre, true), x + 3, y + 5);
        doc.setTextColor(...INK);
        doc.text(ecrit(c.nom || 'Nom : ……………………………'), x + 3, y + 10, { maxWidth: w - 6 });
        if (c.png) {
          try {
            const props = doc.getImageProperties(c.png);
            const maxW = w - 10;
            const maxH = h - 19;
            const k = Math.min(maxW / props.width, maxH / props.height);
            doc.addImage(c.png, 'PNG', x + (w - props.width * k) / 2, y + 12, props.width * k, props.height * k, undefined, 'FAST');
          } catch {
            /* image illisible : le cadre reste à signer à la main */
          }
        }
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(ecrit(c.png && c.quand ? `Signé sur le téléphone le ${c.quand}` : 'Date et signature'), x + 3, y + h - 3);
        doc.setTextColor(...INK);
      });
      y += h + 8;
    },
    fichier(nom) {
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFontSize(8);
          doc.setTextColor(...NAVY);
          doc.text(ecrit(`${e.titre} · ${e.sousTitre}`, true), M, 11, { maxWidth: W - 2 * M - 50 });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...MUTED);
          doc.text(pdfText(`Créé le ${cree}`), W - M, 11, { align: 'right' });
          doc.setDrawColor(...YELLOW);
          doc.setLineWidth(0.6);
          doc.line(M, 13.5, W - M, 13.5);
        }
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(M, H - 12, W - M, H - 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        const agent = e.info.agent.trim() ? ` par ${e.info.agent.trim()}` : '';
        doc.text(ecrit(`Créé le ${cree}${agent} avec ASP Rail, sur le téléphone. ${e.pied}`), M, H - 8.5, { maxWidth: W - 2 * M - 18 });
        doc.setFont('helvetica', 'normal');
        doc.text(`${i}/${pages}`, W - M, H - 8.5, { align: 'right' });
      }
      return new File([doc.output('blob')], nom, { type: 'application/pdf' });
    },
  };
  return kit;
}

/* ---------- Plan de situation ---------- */

/** Découpe d'un segment par un rectangle (Liang-Barsky). */
function couper(x1: number, y1: number, x2: number, y2: number, b: [number, number, number, number]): [number, number, number, number] | null {
  const [xmin, ymin, xmax, ymax] = b;
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [
    [-dx, x1 - xmin],
    [dx, xmax - x1],
    [-dy, y1 - ymin],
    [dy, ymax - y1],
  ] as [number, number][]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

function dessinerPlan(doc: jsPDF, p: PlanSituation, x0: number, y0: number, w: number, h: number) {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const s = (w / 2 - 6) / p.rayon;
  const X = (u: number) => cx + u * s;
  const Y = (v: number) => cy - v * s;
  const boite: [number, number, number, number] = [x0 + 0.5, y0 + 0.5, x0 + w - 0.5, y0 + h - 0.5];
  const dedans = (x: number, y: number, marge = 2) => x > x0 + marge && x < x0 + w - marge && y > y0 + marge && y < y0 + h - marge;
  const polyligne = (pts: [number, number][]) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const c = couper(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), boite);
      if (c) doc.line(c[0], c[1], c[2], c[3]);
    }
  };

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x0, y0, w, h, 2, 2, 'FD');

  if (p.zone) {
    doc.setDrawColor(...YELLOW);
    doc.setLineWidth(2.4);
    doc.setLineCap('round');
    polyligne(p.zone);
  }
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.setLineCap('round');
  for (const t of p.traces) polyligne(t);
  doc.setLineCap('butt');

  // Étiquettes sans chevauchement : on essaie au-dessus puis au-dessous, sinon on n'écrit pas (signaux).
  const occupe: [number, number, number, number][] = [
    [x0 + w - 18, y0 + 3, x0 + w - 2, y0 + 19],
    [x0 + 2, y0 + h - 10, x0 + 40, y0 + h - 2],
    [x0 + w - 42, y0 + h - 7, x0 + w - 2, y0 + h - 2],
  ];
  const libre = (r: [number, number, number, number]) =>
    r[0] >= x0 + 1 && r[2] <= x0 + w - 1 && r[1] >= y0 + 1 && r[3] <= y0 + h - 1 && occupe.every((o) => r[2] < o[0] || r[0] > o[2] || r[3] < o[1] || r[1] > o[3]);
  const etiquette = (t: string, x: number, ys: number[], taille: number, gras: boolean, couleur: Rgb, forcer = false) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal');
    doc.setFontSize(taille);
    const tw = doc.getTextWidth(t);
    const th = taille * 0.3528;
    const cx = Math.min(Math.max(x, x0 + tw / 2 + 1.5), x0 + w - tw / 2 - 1.5);
    const essai = ys.find((yy) => libre([cx - tw / 2 - 0.6, yy - th, cx + tw / 2 + 0.6, yy + 0.8]));
    const yy = essai ?? (forcer ? ys[0] : null);
    if (yy === null) return;
    occupe.push([cx - tw / 2 - 0.6, yy - th, cx + tw / 2 + 0.6, yy + 0.8]);
    doc.setTextColor(...couleur);
    doc.text(t, cx, yy, { align: 'center' });
  };

  // Marques du document (d'abord : elles sont prioritaires).
  const noms = p.marques.map((m) => m.label).join(' ');
  for (const m of [...p.marques].sort((a, b) => (a.genre === 'ici' ? -1 : 0) - (b.genre === 'ici' ? -1 : 0))) {
    const x = X(m.u);
    const y = Y(m.v);
    if (!dedans(x, y, 1)) continue;
    if (m.genre === 'ici') {
      doc.setFillColor(...YELLOW);
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.6);
      doc.circle(x, y, 2.3, 'FD');
    } else if (m.genre === 'annonce') {
      doc.setFillColor(234, 88, 12);
      doc.triangle(x, y - 2.2, x - 1.9, y + 1.2, x + 1.9, y + 1.2, 'F');
    } else {
      doc.setFillColor(...NAVY);
      doc.circle(x, y, 1.3, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(m.genre === 'ici' ? 7.5 : 6.5);
    const t = pdfText(m.label);
    const tw = doc.getTextWidth(t) + 3;
    const bx = Math.min(Math.max(x - tw / 2, x0 + 1.5), x0 + w - tw - 1.5);
    const essais = m.genre === 'ici' ? [y - 10, y + 4] : [y + 3.2, y - 8, y + 8.5, y - 13];
    const by = essais.find((b) => libre([bx, b, bx + tw, b + 4.6])) ?? essais[0];
    occupe.push([bx, by, bx + tw, by + 4.6]);
    doc.setFillColor(...(m.genre === 'ici' ? NAVY : ([255, 255, 255] as Rgb)));
    doc.setDrawColor(...(m.genre === 'ici' ? NAVY : LINE));
    doc.setLineWidth(0.2);
    doc.roundedRect(bx, by, tw, 4.6, 1, 1, 'FD');
    doc.setTextColor(...(m.genre === 'ici' ? ([255, 255, 255] as Rgb) : INK));
    doc.text(t, bx + 1.5, by + 3.3);
  }

  // Gares et PN, puis repères de PK, puis signaux (les moins importants s'effacent s'il n'y a pas la place).
  const ordre = { pn: 0, gare: 1, signal: 2 } as const;
  const pts = p.points.filter((pt) => !(pt.genre === 'pn' && noms.includes(pt.nom))).sort((a, b) => ordre[a.genre] - ordre[b.genre]);
  for (const pt of pts) {
    const x = X(pt.u);
    const y = Y(pt.v);
    if (!dedans(x, y, 3)) continue;
    if (pt.genre === 'gare') {
      doc.setFillColor(...NAVY);
      doc.rect(x - 1.2, y - 1.2, 2.4, 2.4, 'F');
    } else if (pt.genre === 'pn') {
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.5);
      doc.line(x - 1.3, y - 1.3, x + 1.3, y + 1.3);
      doc.line(x - 1.3, y + 1.3, x + 1.3, y - 1.3);
    } else {
      doc.setFillColor(...MUTED);
      doc.triangle(x, y - 1.2, x - 1, y + 0.8, x + 1, y + 0.8, 'F');
    }
  }
  for (const pt of pts.filter((x) => x.genre !== 'signal')) {
    const x = X(pt.u);
    const y = Y(pt.v);
    if (!dedans(x, y, 3)) continue;
    if (pt.genre === 'gare') etiquette(pdfText(pt.nom), x, [y + 5, y - 3, y + 9], 7.5, true, NAVY, true);
    else etiquette(pdfText(pt.nom), x, [y - 3, y + 5, y - 7], 7, true, RED, true);
  }
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.25);
  for (const r of p.reperes) {
    const x = X(r.u);
    const y = Y(r.v);
    if (!dedans(x, y, 4)) continue;
    const nx = -Math.sin(r.angle) * 1.6;
    const ny = -Math.cos(r.angle) * 1.6;
    doc.line(x - nx, y - ny, x + nx, y + ny);
    etiquette(fmtPk(r.pk), x, [y + 4.4, y - 2.6], 6, false, MUTED);
  }
  for (const pt of pts.filter((x) => x.genre === 'signal')) {
    const x = X(pt.u);
    const y = Y(pt.v);
    if (!dedans(x, y, 3)) continue;
    etiquette(pdfText(pt.nom), x, [y - 2.4, y + 4.6, y - 5.6, y + 7.8], 5.8, false, MUTED);
  }
  doc.setTextColor(...INK);

  // Nord : flèche vers le nord du plan (l'axe vertical de l'écran est inversé).
  const nx = x0 + w - 9;
  const ny = y0 + 11;
  const dx = p.nord[0];
  const dy = -p.nord[1];
  const qx = -dy;
  const qy = dx;
  doc.setDrawColor(...INK);
  doc.setFillColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(nx - dx * 4, ny - dy * 4, nx + dx * 3, ny + dy * 3);
  const tx = nx + dx * 3;
  const ty = ny + dy * 3;
  doc.triangle(tx + dx * 2, ty + dy * 2, tx + qx * 1.3, ty + qy * 1.3, tx - qx * 1.3, ty - qy * 1.3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  doc.text('N', nx + dx * 7.5, ny + dy * 7.5 + 1.2, { align: 'center' });

  // Échelle et sens des PK.
  const longueur = [100, 200, 250, 500, 1000, 2000].find((l) => l * s >= 18) ?? 2000;
  const ex = x0 + 5;
  const ey = y0 + h - 5;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(ex, ey, ex + longueur * s, ey);
  doc.line(ex, ey - 1, ex, ey + 1);
  doc.line(ex + longueur * s, ey - 1, ex + longueur * s, ey + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(longueur >= 1000 ? `${longueur / 1000} km` : `${longueur} m`, ex + (longueur * s) / 2, ey - 1.6, { align: 'center' });
  doc.setTextColor(...MUTED);
  doc.text('PK croissants vers la droite', x0 + w - 4, y0 + h - 4, { align: 'right' });
  doc.setTextColor(...INK);
}

