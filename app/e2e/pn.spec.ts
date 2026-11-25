import type { Locator, Page } from '@playwright/test';
import { EXERCICES_ORDRE } from '../src/pn/ordre';
import { expect, fakeShare, openApp, pointAtPk, shot, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

/** À 200 m du PN 26 de la ligne 830 000 (PK 47+403, La Rochette). */
const PRES_PN26 = pointAtPk('830000', 47.2);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

/** Coche les étapes « Fait à … » une à une jusqu'à ce que `stop` soit visible ; numérote les dépêches demandées. */
async function avancer(ecran: Locator, stop: Locator, depeches: string[]) {
  for (let k = 0; k < 30 && !(await stop.isVisible()); k++) {
    const champ = ecran.getByLabel('N° de dépêche (facultatif)');
    if (await champ.isVisible()) {
      const d = String(12 + depeches.length);
      await champ.fill(d);
      depeches.push(d);
    }
    await ecran.getByRole('button', { name: /^Fait à \d{2}:\d{2}$/ }).click();
  }
  await expect(stop).toBeVisible();
}

test('activité PN : bascule sur l’accueil, PN le plus proche en direct, mission pas à pas, mobile travaux, dérangement et journal', async ({ page }) => {
  await fakeShare(page);
  await openApp(page, { home: true, gps: PRES_PN26 });
  const activite = page.getByRole('radiogroup', { name: 'Activité' });
  await activite.getByRole('radio', { name: 'Agent PN' }).click();
  await expect(page.getByRole('region', { name: 'Première mission PN' })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: 'Dérangement' })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: 'Calcul' })).toHaveCount(0);

  // GPS déjà autorisé : le PN le plus proche s'affiche tout seul.
  await expect(page.getByRole('button', { name: /^PN le plus proche : PN 26, à \d+ m$/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /^Mémo PN/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Question du jour' })).toBeVisible();
  await shot(page, '20-accueil-pn');

  // Nouvelle mission : rôle, PN trouvé par le GPS, équipement, chantier.
  await page.getByRole('button', { name: 'Nouvelle mission PN' }).first().click();
  const assistant = page.getByRole('dialog', { name: 'Nouvelle mission PN' });
  await expect(assistant.getByRole('radio', { name: /^Agent PN en travaux/ })).toHaveAttribute('aria-checked', 'true');
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByRole('button', { name: /Trouver les PN autour de moi/ }).click();
  const pn26 = assistant.getByRole('radiogroup', { name: 'PN proches' }).getByRole('radio', { name: /^PN 26 · \d+ m/ });
  await expect(pn26).toBeVisible({ timeout: 20_000 });
  await pn26.click();
  await expect(assistant.getByLabel('Numéro du PN')).toHaveValue('26');
  await expect(assistant.getByLabel('Route, commune')).toHaveValue('VC · La Rochette');
  await shot(page, '21-mission-pn-gps');
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByRole('button', { name: 'Continuer' }).click();
  await assistant.getByRole('button', { name: 'Commencer la mission' }).click();

  // La mission : l'étape à faire, en grand ; chaque étape faite va au journal avec son heure.
  const mission = page.getByRole('dialog', { name: 'Mission PN · PN 26 · ligne 830 000' });
  await expect(mission.getByRole('heading', { name: /briefing sécurité/ })).toBeVisible();
  await shot(page, '22-mission-pn');
  const depeches: string[] = [];
  await avancer(mission, mission.getByRole('button', { name: 'Un mobile travaux arrive' }), depeches);
  expect(depeches.length).toBeGreaterThanOrEqual(1);
  await expect(mission.getByText(/^PN repris en travaux depuis \d{2}:\d{2}$/)).toBeVisible();
  await expect(mission.locator('.ds-journal').getByText(`Dépêche ${depeches[0]}`, { exact: true })).toBeVisible();
  await shot(page, '23-mission-pn-pendant');

  // Un mobile travaux arrive : les gestes dans l'ordre, puis noté au journal.
  await mission.getByRole('button', { name: 'Un mobile travaux arrive' }).click();
  const mobile = page.getByRole('dialog', { name: 'Arrivée d’un mobile travaux' });
  const gestes = mobile.locator('label.ds-step');
  const n = await gestes.count();
  expect(n).toBeGreaterThanOrEqual(8);
  await expect(mobile.getByRole('button', { name: /^Encore \d+ étape\(s\)$/ })).toBeDisabled();
  for (let k = 0; k < n; k++) await gestes.nth(k).click();
  await shot(page, '24-mobile-travaux');
  await mobile.getByRole('button', { name: 'Terminé : noter au journal' }).click();
  await expect(page.getByText(/Passage du mobile travaux n° 1 \(de \d{2}:\d{2} à \d{2}:\d{2}\) : noté au journal\./)).toBeVisible();
  await expect(mission.getByText(/· 1 mobile, 0 LAM$/)).toBeVisible();

  // Un PN ne marche pas : deux questions, la conduite à tenir, noté au journal.
  await mission.getByRole('button', { name: 'Dérangement' }).click();
  const diag = page.getByRole('dialog', { name: 'Dérangement' });
  await diag.getByRole('radio', { name: /^Un train arrive ou passe/ }).click();
  await diag.getByRole('radio', { name: /^Un ou plusieurs feux rouges éteints/ }).click();
  await expect(diag.getByRole('region', { name: 'Résultat' })).toContainText('Raté de fermeture');
  await shot(page, '25-derangement');
  await diag.getByRole('button', { name: 'Noter au journal de la mission' }).click();
  await diag.getByRole('button', { name: 'Retour' }).click();
  await expect(mission.getByText('Dérangement constaté : raté de fermeture (un ou plusieurs feux rouges éteints)')).toBeVisible();

  // Fin des travaux jusqu'à l'ARF, puis le journal partagé.
  await avancer(mission, mission.getByRole('heading', { name: 'Mission terminée' }), depeches);
  await expect(mission.getByText(/^Terminée à \d{2}:\d{2}/)).toBeVisible();
  await mission.getByRole('button', { name: 'Journal', exact: true }).click();
  const partage = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages[0]);
  expect(partage.text).toContain('PN 26');
  expect(partage.text).toContain('Passage du mobile travaux n° 1');
  expect(partage.text).toContain('Raté de fermeture'.toLowerCase());
  for (const d of depeches) expect(partage.text).toContain(d);

  // Retour à l'accueil : l'activité et la mission restent sur le téléphone.
  await mission.getByRole('button', { name: 'Retour' }).click();
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Activité' }).getByRole('radio', { name: 'Agent PN' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('region', { name: 'Ma mission PN' })).toContainText('PN 26');
});

test('activité PN : onglets Dérangement et Réviser (mémo PN, quiz PN, cas pratique dans l’ordre)', async ({ page }) => {
  await openApp(page, { home: true, storage: { 'asp-activite': 'pn' } });
  await nav(page).getByRole('button', { name: 'Dérangement' }).click();
  const onglet = page.getByRole('main', { name: 'Dérangement' });
  await onglet.getByRole('radio', { name: /^Aucun train n’arrive/ }).click();
  await onglet.getByRole('radio', { name: /^Des feux rouges allumés/ }).click();
  await expect(onglet.getByRole('region', { name: 'Résultat' })).toContainText('Raté d’ouverture');
  await expect(onglet.getByRole('button', { name: 'Noter au journal de la mission' })).toHaveCount(0);

  await nav(page).getByRole('button', { name: 'Réviser' }).click();
  const reviser = page.getByRole('main', { name: 'Réviser' });
  await expect(reviser.locator('.ds-section-title').first()).toHaveText('Agent PN · TES F');
  await reviser.getByRole('button', { name: /^Mémo PN/ }).click();
  const memo = page.getByRole('dialog', { name: 'Mémo PN' });
  await expect(memo.getByText(/Marche-Arrêt/).first()).toBeVisible();
  await memo.getByRole('button', { name: 'Retour' }).click();

  await reviser.getByRole('button', { name: /^Quiz PN/ }).click();
  const quiz = page.getByRole('dialog', { name: 'Quiz' });
  await expect(quiz).toContainText('agent PN, TES F');
  await quiz.getByRole('button', { name: 'Retour' }).click();

  await reviser.getByRole('button', { name: /^Cas pratiques PN/ }).click();
  const ex = EXERCICES_ORDRE[0];
  await page.getByRole('dialog', { name: 'Cas pratiques PN' }).getByRole('button', { name: new RegExp(`^${ex.titre}`) }).click();
  const ecran = page.getByRole('dialog', { name: ex.titre });
  for (const g of ex.etapes) await ecran.locator('.ds-pioche-item', { hasText: g }).click();
  await ecran.getByRole('button', { name: 'Vérifier mon ordre' }).click();
  await expect(ecran.getByRole('region', { name: 'Résultat' })).toContainText('Tout est dans le bon ordre');
  await shot(page, '26-cas-pratique-pn');
  await ecran.getByRole('button', { name: 'Retour' }).click();
  await page.getByRole('dialog', { name: 'Cas pratiques PN' }).getByRole('button', { name: 'Retour' }).click();

  // Retour à l'activité annonce : l'onglet Calcul revient.
  await nav(page).getByRole('button', { name: 'Accueil' }).click();
  await page.getByRole('radiogroup', { name: 'Activité' }).getByRole('radio', { name: 'Annonce' }).click();
  await expect(nav(page).getByRole('button', { name: 'Calcul' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouveau chantier' }).first()).toBeVisible();
});

test('activité PN sur petit écran (320 × 568) : rien ne déborde', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openApp(page, { home: true, gps: PRES_PN26, storage: { 'asp-activite': 'pn' } });
  const deborde = () =>
    page.evaluate(() => {
      const scope = document.querySelectorAll<HTMLElement>('.ds-page *, .ds-screen:not([hidden]) *, .ds-nav *');
      const bad = [...scope].filter((e) => {
        if (e.closest('.ds-chips.scroll, .asp-table-wrap')) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      });
      return { sw: document.documentElement.scrollWidth, bad: bad.slice(0, 5).map((e) => `${e.tagName}.${e.className} « ${e.textContent?.slice(0, 40)} »`) };
    });
  await expect(page.getByRole('button', { name: /^PN le plus proche : PN 26/ })).toBeVisible({ timeout: 20_000 });
  expect(await deborde(), 'accueil').toEqual({ sw: 320, bad: [] });
  await page.getByRole('button', { name: 'Nouvelle mission PN' }).first().click();
  const assistant = page.getByRole('dialog', { name: 'Nouvelle mission PN' });
  for (let k = 0; k < 3; k++) {
    expect(await deborde(), `étape ${k + 1}`).toEqual({ sw: 320, bad: [] });
    await assistant.getByRole('button', { name: 'Continuer' }).click();
  }
  expect(await deborde(), 'étape 4').toEqual({ sw: 320, bad: [] });
  await assistant.getByRole('button', { name: 'Commencer la mission' }).click();
  const mission = page.getByRole('dialog', { name: /^Mission PN/ });
  await expect(mission.getByRole('button', { name: /^Fait à/ })).toBeVisible();
  expect(await deborde(), 'mission').toEqual({ sw: 320, bad: [] });
  await mission.getByRole('button', { name: 'Dérangement' }).click();
  await page.getByRole('dialog', { name: 'Dérangement' }).getByRole('radio', { name: /^Une barrière est cassée/ }).click();
  expect(await deborde(), 'dérangement').toEqual({ sw: 320, bad: [] });
  await page.getByRole('dialog', { name: 'Dérangement' }).getByRole('button', { name: 'Retour' }).click();
  await mission.getByRole('button', { name: 'Retour' }).click();
  for (const tab of ['Dérangement', 'Réviser', 'Accueil']) {
    await nav(page).getByRole('button', { name: tab }).click();
    expect(await deborde(), tab).toEqual({ sw: 320, bad: [] });
  }
});
