import type { Page, Route } from '@playwright/test';
import { exporterPdf, expect, fakeShare, openApp, shot, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

const jourIso = (decalage = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Serveur des archives simulé : garde ce qu'il reçoit ; `enPanne()` vrai → pas de réseau. */
async function fakeArchives(page: Page, enPanne: () => boolean = () => false) {
  const recus: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/asp-archive', async (route: Route) => {
    if (enPanne()) return route.abort('internetdisconnected');
    recus.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: { ok: true, entreprise: 'Exemple Rail' } });
  });
  return recus;
}

test('clôture d’un chantier d’hier : rappel, dossier PDF complet, archivé, envoyé à l’entreprise', async ({ page }) => {
  await fakeShare(page);
  const recus = await fakeArchives(page);
  const hier = jourIso(-1);
  const chantier = { id: 'c-hier', created: Date.now(), updated: Date.now(), nom: 'Traverses', date: hier, ligne: '830000', pkDebut: 28.718, pkFin: 28.768, asp: 'Moo', responsable: 'M. Durand' };
  await openApp(page, { home: true, general: true, storage: { 'asp-chantiers-v1': [chantier] } });
  const rappel = page.getByRole('region', { name: 'Missions à clôturer' });
  await expect(rappel).toContainText('Une mission à clôturer');
  await expect(rappel).toContainText('Traverses');
  await expect(rappel).toContainText('Hier');
  await shot(page, '50-rappel-cloture');
  await rappel.getByRole('button', { name: /^Clôturer / }).click();

  const pdf = await exporterPdf(page, { nom: 'Moo Test', signer: true, bouton: 'Clôturer et télécharger' });
  expect(pdf.name).toMatch(/^Dossier-Traverses-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/);
  for (const x of ['Dossier de fin de mission', 'clôturé le', 'Horaires', 'Trains annoncés', 'Plateforme', 'Check-lists', 'Signatures', 'Moo Test']) expect(pdf.plat, x).toContain(x);
  await expect(page.getByRole('status').filter({ hasText: 'Mission clôturée et archivée' })).toBeVisible();
  await expect(rappel).toHaveCount(0);

  // La copie est partie à l'entreprise, avec le code d'accès.
  await expect.poll(() => recus.length).toBe(1);
  expect(recus[0]).toMatchObject({ code: 'TESTTEST', type: 'asp', titre: expect.stringContaining('Traverses'), date: hier, agent: 'Moo Test', nom_fichier: pdf.name });
  expect(String(recus[0].pdf).startsWith('JVBERi0')).toBe(true);

  // Mes archives : le dossier, envoyé ; toujours là après un rechargement.
  await page.reload();
  await page.getByRole('button', { name: /^Mes archives/ }).click();
  const archives = page.getByRole('dialog', { name: 'Mes archives' });
  await archives.getByRole('button', { name: /Ouvrir le dossier Traverses/ }).click();
  const dossier = archives.getByRole('region', { name: /^Dossier : Traverses/ });
  await expect(dossier).toContainText('Copie reçue par Exemple Rail');
  await expect(dossier).toContainText('Mission verrouillée');
  await shot(page, '51-archive');
  await dossier.getByRole('button', { name: 'Télécharger le dossier' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages.at(-1)?.files?.[0]?.name)).toBe(pdf.name);

  // Le chantier n'est plus dans l'annonce.
  await archives.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('main', { name: 'Accueil' }).getByRole('button', { name: /^Annonce :/ }).click();
  await expect(page.getByRole('main', { name: 'Accueil : Annonce' })).not.toContainText('Traverses');
});

test('clôture d’un poste sans réseau : le dossier attend, puis part au renvoi', async ({ page }) => {
  await fakeShare(page);
  let panne = true;
  const recus = await fakeArchives(page, () => panne);
  const poste = { id: 'p1', created: Date.now(), updated: Date.now(), role: 'annonceur', code: 'A1', chantier: 'Ballast', date: jourIso(0), horaire: 'jour', asp: 'Moo', prise: Date.now() - 3600_000, fin: Date.now() - 60_000 };
  await openApp(page, { home: true, storage: { 'asp-postes-v1': [poste] } });
  const rappel = page.getByRole('region', { name: 'Missions à clôturer' });
  await expect(rappel).toContainText('Annonceur A1 · Ballast');
  await expect(rappel).toContainText('finie');
  await rappel.getByRole('button', { name: /^Clôturer / }).click();
  const pdf = await exporterPdf(page, { nom: 'Sam Test', bouton: 'Clôturer et télécharger' });
  expect(pdf.name).toMatch(/^Dossier-Compte-rendu-poste-Annonceur-A1-Ballast/);
  expect(pdf.plat).toContain('Dossier de fin de mission');
  await expect(rappel).toHaveCount(0);

  await page.getByRole('button', { name: 'Revenir à l’accueil (changer de mission)' }).click();
  await expect(page.getByRole('button', { name: /^Mes archives/ })).toContainText('1 pas encore envoyé');
  await page.getByRole('button', { name: /^Mes archives/ }).click();
  const archives = page.getByRole('dialog', { name: 'Mes archives' });
  await expect(archives.getByRole('button', { name: /Ouvrir le dossier Annonceur A1/ })).toContainText('En attente');
  await archives.getByRole('button', { name: /Ouvrir le dossier Annonceur A1/ }).click();
  await expect(archives.getByRole('status')).toContainText('en attente de réseau');
  panne = false;
  // L'envoi automatique (retour du réseau, toutes les 5 minutes) peut passer avant le toucher : les deux conviennent.
  await archives
    .getByRole('button', { name: 'Renvoyer' })
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await expect(archives.getByRole('status')).toContainText('Copie reçue par Exemple Rail');
  expect(recus).toHaveLength(1);
  expect(recus[0]).toMatchObject({ type: 'chaine', agent: 'Sam Test' });
});

test('clôture depuis l’écran d’une mission PN : elle devient une archive en lecture seule', async ({ page }) => {
  await fakeShare(page);
  await fakeArchives(page);
  const mission = { id: 'm1', created: Date.now(), updated: Date.now(), role: 'travaux', date: jourIso(0), pn: { numero: '26', ligne: '830000', pk: 47.403 }, fin: Date.now() - 60_000 };
  await openApp(page, { home: true, storage: { 'asp-missions-pn-v1': [mission], 'asp-activite': 'pn' } });
  await expect(page.getByRole('region', { name: 'Missions à clôturer' })).toContainText('PN 26');
  await page.getByRole('button', { name: 'Voir la mission' }).click();
  const ecran = page.getByRole('dialog', { name: /^Mission PN/ });
  await ecran.getByRole('button', { name: /^Clôturer la mission/ }).click();
  await exporterPdf(page, { nom: 'Lou Test', bouton: 'Clôturer et télécharger' });
  // L'écran de la mission, resté ouvert dessous, est devenu son archive.
  const archive = page.getByRole('dialog', { name: /^Archive :/ });
  await expect(archive).toContainText('Mission archivée');
  await expect(archive.getByRole('region', { name: /^Dossier : PN 26/ })).toContainText('clôturée le');
  await expect(archive.getByRole('button', { name: 'Télécharger le dossier' })).toBeVisible();
  await archive.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Voir la mission' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Missions à clôturer' })).toHaveCount(0);
});
