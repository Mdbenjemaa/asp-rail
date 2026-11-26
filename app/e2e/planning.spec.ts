import { jsPDF } from 'jspdf';
import type { Locator, Page } from '@playwright/test';
import { expect, openApp, shot, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

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
function fauxPlanning(agents: { nom: string; cases: string[][] }[]): Buffer {
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

const AGENTS = () => [
  { nom: 'DURAND Anne', cases: Array.from({ length: 7 }, () => ['"CDG Axe nord"', '[APLAM/S9]', '22H00-05h00']) },
  { nom: 'MARTIN Paul', cases: maSemaine() },
  { nom: 'BERNARD Luc', cases: Array.from({ length: 7 }, () => ['AMO']) },
];

/** Choisit le PDF dans le champ de l'écran donné (carte de l'accueil ou écran « Mon planning »). */
async function importer(ou: Page | Locator, nom: string, pdf: Buffer) {
  await ou.locator('input[type="file"][aria-label="Planning ETF (PDF)"]').first().setInputFiles({ name: nom, mimeType: 'application/pdf', buffer: pdf });
}

test('planning ETF : import du PDF, choix de ma ligne, ma semaine, puis chantier prérempli', async ({ page }) => {
  await openApp(page, { home: true });
  const accueil = page.getByRole('main', { name: 'Accueil' });
  const carte = accueil.getByRole('region', { name: 'Mon planning ETF' });
  await expect(carte).toContainText('Importe le PDF reçu par mail');

  // Premier import : l'appli demande qui on est, une fois.
  const s = AGENTS();
  await importer(page, 'Planning Securite chantier S48 définitif.pdf', fauxPlanning(s));
  const choix = page.getByRole('dialog', { name: 'Qui es-tu dans ce planning ?' });
  await expect(choix).toBeVisible({ timeout: 20_000 });
  await expect(choix.getByRole('button')).toHaveCount(4); // trois agents + fermer
  await choix.getByRole('textbox', { name: 'Chercher mon nom' }).fill('mart');
  await choix.getByRole('button', { name: /MARTIN Paul/ }).click();
  await expect(page.locator('.ds-snack')).toContainText(/Importé : semaine \d+ \(définitif\), 6 jours de travail/);

  // La semaine s'ouvre : 6 nuits et un repos.
  const ecran = page.getByRole('dialog', { name: 'Mon planning ETF' });
  await expect(ecran).toBeVisible();
  await expect(ecran.locator('.ds-jour.travail')).toHaveCount(6);
  await expect(ecran.locator('.ds-jour.repos')).toContainText('Repos hebdomadaire (RH)');
  await expect(ecran.locator('.ds-jour.auj')).toContainText('RGI EXEMPLE');
  await expect(ecran.locator('.ds-jour.auj')).toContainText('ANN · 21h00-04h00 · Melun');
  await expect(ecran).toContainText('Ta ligne : MARTIN Paul');
  await shot(page, 'planning-semaine');

  // Le provisoire de la même semaine, importé après : le définitif reste.
  await importer(ecran, 'Planning Securite chantier S48 provisoire.pdf', fauxPlanning(AGENTS().map((a) => ({ ...a, cases: a.cases.map(() => ['AMO']) }))));
  await expect(page.locator('.ds-snack')).toContainText('le définitif déjà importé est gardé');
  await expect(ecran.locator('.ds-jour.travail')).toHaveCount(6);

  // Un PDF qui n'est pas un planning.
  const autre = new jsPDF();
  autre.text('Facture 12,00 €', 20, 20);
  await importer(ecran, 'facture.pdf', Buffer.from(autre.output('arraybuffer')));
  await expect(page.locator('.ds-snack')).toContainText('ne ressemble pas à un planning ETF');

  // Accueil : le service du jour, la semaine en un coup d'œil, et « Préparer ».
  await ecran.getByRole('button', { name: 'Retour' }).click();
  await expect(carte.getByRole('heading', { name: 'RGI EXEMPLE' })).toBeVisible();
  await expect(carte).toContainText('ANN · 21h00-04h00 · Melun');
  await expect(carte.getByRole('list', { name: 'Ma semaine' }).getByRole('listitem')).toHaveCount(7);
  await shot(page, 'planning-accueil');
  await carte.getByRole('button', { name: 'Préparer le chantier d’annonce' }).click();
  await expect(page.locator('.ds-snack')).toContainText('Prérempli depuis ton planning ETF : RGI EXEMPLE · 21h00-04h00');
  await expect(page.getByRole('dialog', { name: 'Nouveau chantier' })).toBeVisible();
  const chantier = await page.evaluate(() => (JSON.parse(localStorage.getItem('asp-chantiers-v1') ?? '[]') as { nom: string; horaire: string; notes: string }[])[0]);
  expect(chantier.nom).toBe('RGI EXEMPLE');
  expect(chantier.horaire).toBe('nuit');
  expect(chantier.notes).toContain('Planning ETF : RGI EXEMPLE · ANN · 21h00-04h00 · Melun');

  // Seule ma ligne est gardée sur le téléphone : aucun autre agent.
  const garde = await page.evaluate(() => localStorage.getItem('asp-planning-v1') ?? '');
  expect(garde).toContain('MARTIN Paul');
  expect(garde).not.toContain('DURAND');
  expect(garde).not.toContain('06 00 00 00');
});

test('planning ETF : les imports suivants retrouvent ma ligne seuls, et préviennent si elle n’y est pas', async ({ page }) => {
  await openApp(page, { home: true, storage: { 'asp-planning-nom': JSON.stringify('MARTIN Paul') } });
  await importer(page, 'Planning S48.pdf', fauxPlanning(AGENTS()));
  await expect(page.locator('.ds-snack')).toContainText(/Importé : semaine \d+, 6 jours de travail/, { timeout: 20_000 });
  await expect(page.getByRole('dialog', { name: 'Qui es-tu dans ce planning ?' })).toHaveCount(0);
  const ecran = page.getByRole('dialog', { name: 'Mon planning ETF' });
  await ecran.getByRole('button', { name: 'Retour' }).click();

  // Provisoire « court » sans ma ligne.
  await importer(page, 'Planning S49 provisoire.pdf', fauxPlanning(AGENTS().filter((a) => a.nom !== 'MARTIN Paul')));
  await expect(page.locator('.ds-snack')).toContainText('Ta ligne (MARTIN Paul) n’est pas dans ce planning');
});
