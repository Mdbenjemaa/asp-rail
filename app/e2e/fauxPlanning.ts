/** Faux planning ETF (agents fictifs) pour les tests : même mise en page que le vrai PDF. */
import { jsPDF } from 'jspdf';

const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const MOIS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/** Lundi de la semaine en cours. */
function lundi(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

/**
 * Un faux planning ETF de la semaine en cours (agents fictifs), mis en page comme le vrai : en-têtes « lun 23 nov »,
 * une ligne par agent (nom, numéro, adresse), puis une case par jour, texte centré sur plusieurs lignes.
 */
export function fauxPlanning(agents: { nom: string; cases: string[][] }[]): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const l0 = lundi();
  const cols = [242, 294, 345, 397, 448, 500, 551];
  const texte = (s: string, cx: number, y: number, taille = 5) => {
    doc.setFontSize(taille);
    doc.text(s, cx, y, { align: 'center' });
  };
  texte('PLANNING SECURITE CHANTIER', 120, 70, 12);
  texte('NOM', 65, 110, 6);
  texte('Prénom', 65, 117, 6);
  texte('Numéro', 141, 114, 6);
  texte('Adresse', 193, 114, 6);
  cols.forEach((cx, i) => {
    const d = new Date(l0.getFullYear(), l0.getMonth(), l0.getDate() + i);
    texte(`${JOURS[i]} ${String(d.getDate()).padStart(2, '0')} ${MOIS[d.getMonth()]}`, cx, 114, 6);
  });
  agents.forEach((a, k) => {
    const y = 160 + k * 40;
    texte(a.nom, 65, y, 6);
    texte(`06 00 00 00 0${k}`, 141, y, 6);
    texte('IDF', 193, y, 6);
    a.cases.forEach((lignes, i) => lignes.forEach((l, n) => texte(l, cols[i], y + (n - (lignes.length - 1) / 2) * 6)));
  });
  return Buffer.from(doc.output('arraybuffer'));
}

const NUIT = ['"RGI EXEMPLE"', '[ANN]', 'Melun', '21h00-04h00'];
/** Toute la semaine de nuit, sauf un jour de repos qui n'est pas aujourd'hui (l'accueil montre alors une nuit). */
function maSemaine(): string[][] {
  const auj = (new Date().getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => (i === (auj + 3) % 7 ? ['RH'] : NUIT));
}

export const AGENTS = () => [
  { nom: 'DURAND Anne', cases: Array.from({ length: 7 }, () => ['"CDG Axe nord"', '[APLAM/S9]', '22H00-05h00']) },
  { nom: 'MARTIN Paul', cases: maSemaine() },
  { nom: 'BERNARD Luc', cases: Array.from({ length: 7 }, () => ['AMO']) },
];
