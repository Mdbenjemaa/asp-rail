import type { Locator, Page } from '@playwright/test';
import { EXERCICES_LAM } from '../src/lam/ordre';
import { changerMission, exporterPdf, expect, fakeShare, openApp, pointAtPk, shot, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

/** À une quinzaine de mètres du sémaphore 47 et à 350 m du PN 26 (ligne 830 000). */
const PRES_SEMAPHORE = pointAtPk('830000', 47.05);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

/** Note la dépêche ouverte : n° reçu, et renvoie le numéro proposé par l'appli. */
async function noterDepeche(page: Page, recu: string): Promise<string> {
  const feuille = page.getByRole('dialog', { name: 'Dépêche' });
  await feuille.getByLabel('N° reçu').fill(recu);
  const donne = await feuille.getByLabel('N° que tu donnes').inputValue();
  expect(donne).toMatch(/^\d{2}$/);
  await feuille.getByRole('button', { name: /^Noter la dépêche à \d{2}:\d{2}$/ }).click();
  await expect(feuille).toHaveCount(0);
  return donne;
}

/** Fait les étapes une à une (« Fait à » ou dépêche) jusqu'à ce que `stop` soit visible. */
async function avancer(page: Page, ecran: Locator, stop: Locator, numeros: string[]) {
  for (let k = 0; k < 40 && !(await stop.isVisible()); k++) {
    const dep = ecran.getByRole('button', { name: 'Noter la dépêche', exact: true });
    if (await dep.isVisible()) {
      await dep.click();
      const recu = String(50 + numeros.length * 7);
      numeros.push(recu, await noterDepeche(page, recu));
    } else {
      await ecran.getByRole('button', { name: /^Fait à \d{2}:\d{2}$/ }).click();
    }
  }
  await expect(stop).toBeVisible();
}

test('AP S9 : contrôle DSh en direct, bouclage par dépêches, passage d’un train travaux, aléa et journal', async ({ page }) => {
  await fakeShare(page);
  await openApp(page, { home: true, gps: PRES_SEMAPHORE });
  await changerMission(page, 'lam');
  await expect(page.getByRole('region', { name: 'Première mission LAM / S9' })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: 'Urgences' })).toBeVisible();

  // Case en direct : signal à moins de 30 m → à vérifier.
  const dsh = page.getByRole('button', { name: /^Contrôle pose DSh : À vérifier, Sémaphore 47 à \d+ m$/ });
  await expect(dsh).toBeVisible({ timeout: 20_000 });
  await shot(page, '30-accueil-lam');
  await dsh.click();
  const controle = page.getByRole('dialog', { name: 'Pose d’un DSh' });
  await expect(controle.getByRole('region', { name: 'Ce que dit ta position' })).toContainText('À vérifier');
  await expect(controle.getByText(/^Sémaphore 47 à \d+ m$/)).toBeVisible();
  await expect(controle.getByText(/^PN 26 à \d+ m$/)).toBeVisible();
  await shot(page, '31-controle-dsh');
  await controle.getByRole('button', { name: 'Retour' }).click();

  // Nouvelle mission S9 : bouclage A3 au GPS, DSh + SAM.
  await page.getByRole('button', { name: 'Nouvelle mission LAM / S9' }).first().click();
  const assistant = page.getByRole('dialog', { name: 'Nouvelle mission LAM / S9' });
  await assistant.getByRole('radio', { name: /^AP S9/ }).click();
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByRole('button', { name: /Utiliser ma position GPS/ }).click();
  const ici = assistant.getByRole('radiogroup', { name: 'Position trouvée' }).getByRole('radio', { name: /^Ligne 830 000 · PK 47\+0\d{2}/ });
  await expect(ici).toBeVisible({ timeout: 20_000 });
  await ici.click();
  await expect(ici).toHaveAttribute('aria-checked', 'true');
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByLabel('Repère du bouclage').fill('A3');
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByLabel('RPTx').fill('M. Jean');
  await assistant.getByRole('button', { name: 'Commencer la mission' }).click();

  const mission = page.getByRole('dialog', { name: 'Mission · AP S9 · A3 · ligne 830 000' });
  await expect(mission.getByRole('heading', { name: /briefing/ })).toBeVisible();
  const numeros: string[] = [];
  await avancer(page, mission, mission.getByRole('button', { name: 'Un train travaux doit passer' }), numeros);
  expect(numeros.length).toBe(4);
  // Numéros pris au hasard, sans suite avec le numéro reçu ni ceux déjà échangés.
  for (let k = 1; k < numeros.length; k += 2)
    for (let j = 0; j < k; j++) expect(Math.abs(Number(numeros[k]) - Number(numeros[j])), `${numeros[k]} / ${numeros[j]}`).toBeGreaterThan(2);
  await expect(mission.getByText('Carnet de dépêches · 2')).toBeVisible();
  await expect(mission.getByText(/^Bouclage en place depuis \d{2}:\d{2}$/)).toBeVisible();
  await shot(page, '32-mission-s9-pendant');

  // Passage d'un TTx : retrait puis remise, avec les dépêches.
  await mission.getByRole('button', { name: 'Un train travaux doit passer' }).click();
  const ttx = page.getByRole('dialog', { name: 'Passage d’un train travaux' });
  const gestes = ttx.locator('label.ds-step');
  const n = await gestes.count();
  expect(n).toBe(10);
  for (let k = 0; k < n; k++) {
    await gestes.nth(k).click();
    if (await page.getByRole('dialog', { name: 'Dépêche' }).isVisible()) numeros.push(await noterDepeche(page, String(11 + k)));
  }
  await shot(page, '33-ttx');
  await ttx.getByRole('button', { name: 'Terminé : noter au journal' }).click();
  await expect(page.getByText(/Passage du train travaux n° 1 \(de \d{2}:\d{2} à \d{2}:\d{2}\) : noté au journal\./)).toBeVisible();
  await expect(mission.getByText(/· 1 TTx$/)).toBeVisible();
  await expect(mission.getByText('Carnet de dépêches · 5')).toBeVisible();

  // Aléa : la fiche réflexe, notée au journal.
  await mission.getByRole('button', { name: 'Urgence' }).click();
  const urg = page.getByRole('dialog', { name: 'Urgences' });
  await expect(urg.getByRole('button', { name: /Le LAM part en dérive/ })).toHaveCount(0);
  await urg.getByRole('button', { name: /^Aléa ou doute pendant une mission S9/ }).click();
  await expect(urg.locator('.ds-steps li').first()).toHaveText('Aviser tout de suite le CCh, ou à défaut le RPTx');
  await urg.getByRole('button', { name: 'Noter au journal de la mission' }).click();
  await urg.getByRole('button', { name: 'Retour' }).click();
  await urg.getByRole('button', { name: 'Retour' }).click();

  // Retrait jusqu'à la fin, puis le journal partagé.
  await avancer(page, mission, mission.getByRole('heading', { name: 'Mission terminée' }), numeros);
  await mission.getByRole('button', { name: 'Journal', exact: true }).click();
  const pdf = await exporterPdf(page, { nom: 'Moo Test' });
  expect(pdf.name).toMatch(/^Journal-AP-S9-A3-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/);
  for (const x of ['Journal de mission AP S9', 'AP S9 · A3 · ligne 830 000', 'Agent : Moo Test', 'Plan de situation', 'Carnet de dépêches', 'M. Jean', 'Passage du train travaux n° 1', 'Aléa : aléa ou doute pendant une mission S9'])
    expect(pdf.plat, x).toContain(x);
  for (const x of numeros) expect(pdf.plat).toMatch(new RegExp(`\\b${x}\\b`));
  expect(pdf.images).toBe(0);
  await shot(page, '34-mission-s9-fin');
});

test('AP LAM : vérifications, mise en voie au PN, situations du déplacement, mise hors voie', async ({ page }) => {
  await openApp(page, { home: true, storage: { 'asp-activite': 'lam' } });
  await page.getByRole('button', { name: 'Nouvelle mission LAM / S9' }).first().click();
  const assistant = page.getByRole('dialog', { name: 'Nouvelle mission LAM / S9' });
  await expect(assistant.getByRole('radio', { name: /^AP LAM/ })).toHaveAttribute('aria-checked', 'true');
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByLabel('Point de mise en voie', { exact: true }).fill('PN 26');
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByRole('radiogroup', { name: 'Nombre de LAM' }).getByRole('radio', { name: '2 LAM' }).click();
  await assistant.getByText('Mise en voie ou traversée d’un PN').click();
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByRole('button', { name: 'Commencer la mission' }).click();

  const mission = page.getByRole('dialog', { name: 'Mission · AP LAM · PN 26' });
  await expect(mission.getByText('Au PN : signalisation présentée, véhicules arrêtés, barrières relevées')).toBeVisible();
  await expect(mission.getByText('Vérifier l’agrément des LAM : numéro indiqué et date de validité')).toBeVisible();
  const numeros: string[] = [];
  await avancer(page, mission, mission.getByRole('button', { name: 'Un SAM à franchir' }), numeros);
  await expect(mission.getByText(/^LAM en voie depuis \d{2}:\d{2}$/)).toBeVisible();
  await shot(page, '35-mission-lam-pendant');
  await mission.getByRole('button', { name: 'Un SAM à franchir' }).click();
  const feuille = page.getByRole('dialog', { name: 'Un SAM à franchir' });
  await expect(feuille).toContainText('Jamais de ta propre initiative');
  await feuille.getByRole('button', { name: /^Noter au journal à/ }).click();
  await expect(mission.locator('.ds-journal').getByText('SAM à franchir : LAM arrêté, CCh appelé')).toBeVisible();
  await avancer(page, mission, mission.getByRole('heading', { name: 'Mission terminée' }), numeros);
  expect(numeros.length).toBe(6);
});

test('activité LAM / S9 : onglets Urgences et Réviser (mémo, quiz, cas pratique dans l’ordre)', async ({ page }) => {
  await openApp(page, { home: true, storage: { 'asp-activite': 'lam' } });
  await nav(page).getByRole('button', { name: 'Urgences' }).click();
  const onglet = page.getByRole('main', { name: 'Urgences' });
  await onglet.getByRole('button', { name: /^Le LAM part en dérive/ }).click();
  await expect(onglet.locator('.ds-steps li').first()).toHaveText('Mesures S2B de protection des obstacles inopinés');
  await expect(onglet.getByText('S2B : arrêter les trains')).toBeVisible();
  await expect(onglet.getByRole('button', { name: 'Noter au journal de la mission' })).toHaveCount(0);
  await shot(page, '36-urgences');

  await nav(page).getByRole('button', { name: 'Réviser' }).click();
  const reviser = page.getByRole('main', { name: 'Réviser' });
  await expect(reviser.locator('.ds-section-title').first()).toHaveText('AP LAM · AP S9');
  await reviser.getByRole('button', { name: /^Mémo LAM \/ S9/ }).click();
  const memo = page.getByRole('dialog', { name: 'Mémo LAM / S9' });
  await expect(memo.getByText(/Dispositif de shuntage/).first()).toBeVisible();
  await memo.getByRole('button', { name: 'Retour' }).click();
  await reviser.getByRole('button', { name: /^Quiz LAM \/ S9/ }).click();
  await expect(page.getByRole('dialog', { name: 'Quiz' })).toContainText('AP LAM et AP S9');
  await page.getByRole('dialog', { name: 'Quiz' }).getByRole('button', { name: 'Retour' }).click();

  await reviser.getByRole('button', { name: /^Cas pratiques LAM \/ S9/ }).click();
  const ex = EXERCICES_LAM.find((e) => e.id === 'ttx')!;
  await page.getByRole('dialog', { name: 'Cas pratiques LAM / S9' }).getByRole('button', { name: new RegExp(`^${ex.titre}`) }).click();
  const ecran = page.getByRole('dialog', { name: ex.titre });
  for (const g of ex.etapes) await ecran.locator('.ds-pioche-item', { hasText: new RegExp(`^${g}$`) }).click();
  await ecran.getByRole('button', { name: 'Vérifier mon ordre' }).click();
  await expect(ecran.getByRole('region', { name: 'Résultat' })).toContainText('Tout est dans le bon ordre');
  await expect(ecran).toContainText('Cas pratique LAM / S9');
});

test('activité LAM / S9 sur petit écran (320 × 568) : rien ne déborde', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openApp(page, { home: true, gps: PRES_SEMAPHORE, storage: { 'asp-activite': 'lam' } });
  const deborde = () =>
    page.evaluate(() => {
      const scope = document.querySelectorAll<HTMLElement>('.ds-page *, .ds-screen:not([hidden]) *, .ds-nav *, .modal *');
      const bad = [...scope].filter((e) => {
        if (e.closest('.ds-chips.scroll, .asp-table-wrap')) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      });
      return { sw: document.documentElement.scrollWidth, bad: bad.slice(0, 5).map((e) => `${e.tagName}.${e.className} « ${e.textContent?.slice(0, 40)} »`) };
    });
  await expect(page.getByRole('button', { name: /^Contrôle pose DSh : À vérifier/ })).toBeVisible({ timeout: 20_000 });
  expect(await deborde(), 'accueil').toEqual({ sw: 320, bad: [] });
  await page.getByRole('button', { name: 'Nouvelle mission LAM / S9' }).first().click();
  const assistant = page.getByRole('dialog', { name: 'Nouvelle mission LAM / S9' });
  await assistant.getByRole('radio', { name: /^AP S9/ }).click();
  for (let k = 0; k < 3; k++) {
    expect(await deborde(), `étape ${k + 1}`).toEqual({ sw: 320, bad: [] });
    await assistant.getByRole('button', { name: 'Continuer' }).click();
  }
  expect(await deborde(), 'étape 4').toEqual({ sw: 320, bad: [] });
  await assistant.getByRole('button', { name: 'Commencer la mission' }).click();
  const mission = page.getByRole('dialog', { name: /^Mission · AP S9/ });
  await mission.getByRole('button', { name: /^Fait à/ }).click();
  await mission.getByRole('button', { name: /^Fait à/ }).click();
  await mission.getByRole('button', { name: /^Fait à/ }).click();
  await mission.getByRole('button', { name: 'Noter la dépêche', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Dépêche' })).toBeVisible();
  expect(await deborde(), 'dépêche').toEqual({ sw: 320, bad: [] });
  await shot(page, '37-depeche-320');
  await noterDepeche(page, '93');
  expect(await deborde(), 'mission').toEqual({ sw: 320, bad: [] });
  await mission.getByRole('button', { name: 'Retour' }).click();
  for (const tab of ['Urgences', 'Réviser', 'Accueil']) {
    await nav(page).getByRole('button', { name: tab }).click();
    expect(await deborde(), tab).toEqual({ sw: 320, bad: [] });
  }
});
