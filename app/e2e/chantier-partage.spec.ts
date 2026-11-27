import type { Page } from '@playwright/test';
import { expect, openApp, pointAtPk, shot, showPoint, test } from './helpers';

/** Un agent PN qui partage son PN, sur la même ligne (à 200 m du chantier). */
const PN = pointAtPk('830000', 28.9);

interface Envoi {
  p_session: string;
  p_activite: string;
  p_nom: string;
  p_tel: string;
  p_donnees: { titre: string; etat: string; geo: unknown[] } | null;
}

/** Serveur du chantier partagé simulé : code K7P-3QX, un agent PN qui partage déjà. */
async function fakeSessionServer(page: Page) {
  const envois: Envoi[] = [];
  const session = { ok: true, code: 'K7P3QX', nom: 'Remplacement traverses', expire_le: new Date(Date.now() + 86_400_000).toISOString() };
  await page.route('**/rest/v1/rpc/asp_rejoindre_session', async (route) => {
    const { p_session } = route.request().postDataJSON() as { p_session: string };
    await route.fulfill({ json: p_session === 'K7P3QX' ? session : { ok: false, raison: 'inconnu' } });
  });
  await page.route('**/rest/v1/rpc/asp_voir_session', async (route) => {
    await route.fulfill({
      json: {
        ...session,
        partages: [
          {
            appareil: 'autre-pn-12345',
            activite: 'pn',
            nom: 'Durand',
            tel: '06 11 22 33 44',
            maj: new Date().toISOString(),
            donnees: {
              v: 1,
              titre: 'PN 26 · ligne 830 000',
              etat: 'PN gardé : agent en poste',
              niveau: 'en-place',
              ligne: '830000',
              details: ['Agent de PN', 'PN 26 · VC · Lieusaint'],
              geo: [{ type: 'Feature', properties: { r: 'pn', label: 'PN 26' }, geometry: { type: 'Point', coordinates: [PN.longitude, PN.latitude] } }],
            },
          },
        ],
      },
    });
  });
  await page.route('**/rest/v1/rpc/asp_partager', async (route) => {
    envois.push(route.request().postDataJSON() as Envoi);
    await route.fulfill({ json: { ok: true } });
  });
  return envois;
}

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('chantier partagé : lien reçu, je vois l’agent PN, je partage mon chantier (nom, téléphone), carte, arrêt, quitter et rejoindre par le code', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  const envois = await fakeSessionServer(page);
  const chantier = {
    id: 'c-partage',
    created: Date.now(),
    updated: Date.now(),
    nom: 'Traverses',
    date: aujourdhui(),
    ligne: '830000',
    pkDebut: 28.718,
    pkFin: 28.768,
    voies: [
      { id: 'v1', nom: 'V1', sens: 'croissant', vitesse: 160, role: 'travail', interdite: false },
      { id: 'v2', nom: 'V2', sens: 'decroissant', vitesse: 160, role: 'contigue', interdite: false },
    ],
    agents: [{ id: 'a1', role: 'annonceur', nom: '', entreprise: '', pk: 28.268, surveille: ['v1:croissant'] }],
  };
  await openApp(page, { home: true, path: './#chantier=K7P-3QX', storage: { 'asp-chantiers-v1': [chantier] } });

  // Le lien fait rejoindre le chantier partagé : on voit l'agent PN qui partage déjà.
  const panneau = page.getByRole('region', { name: 'Chantier partagé' });
  await expect(panneau).toContainText('Chantier partagé · K7P-3QX');
  await expect(panneau).toContainText('Remplacement traverses');
  const pn = panneau.locator('.pt-autre').filter({ hasText: 'Durand' });
  await expect(pn).toContainText('PN gardé : agent en poste');
  await expect(pn.getByRole('link', { name: 'Appeler Durand' })).toHaveAttribute('href', 'tel:0611223344');
  expect(new URL(page.url()).hash).toBe('');

  // Je partage mon chantier : envoyé avec mon nom, puis mon téléphone.
  // Un toucher sur l'interrupteur (son libellé change aussitôt : « Je partage… »).
  await panneau.getByLabel(/^Partager mon chantier/).click();
  await expect.poll(() => envois.length, { timeout: 10_000 }).toBeGreaterThan(0);
  const premier = envois[envois.length - 1];
  expect(premier).toMatchObject({ p_session: 'K7P3QX', p_activite: 'asp', p_nom: 'Tests' });
  expect(premier.p_donnees).toMatchObject({ titre: 'Traverses', etat: 'Chaîne d’annonce pas encore en place' });
  expect(premier.p_donnees!.geo.length).toBeGreaterThan(2);
  await panneau.getByLabel('Mon téléphone').fill('06 12 34 56 78');
  await expect.poll(() => envois[envois.length - 1].p_tel, { timeout: 10_000 }).toBe('06 12 34 56 78');
  await expect(panneau.getByLabel(/^Je partage mon chantier/)).toBeChecked();
  await shot(page, '07-chantier-partage');

  // Sur la carte : le PN de Durand ; en le touchant, qui, quoi, l'état, et l'appeler.
  await pn.getByRole('button', { name: 'Voir Durand sur la carte' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Carte' })).toHaveAttribute('aria-current', 'page');
  await page.waitForFunction(() => {
    const m = (window as unknown as { __aspMap: import('maplibre-gl').Map }).__aspMap;
    return m.querySourceFeatures('partage').length > 0;
  });
  const { x, y } = await showPoint(page, PN);
  await page.mouse.click(x, y);
  const fiche = page.locator('.card').filter({ hasText: 'Chantier partagé' });
  await expect(fiche).toContainText('Agent PN · Durand');
  await expect(fiche).toContainText('PN gardé : agent en poste');
  await expect(fiche.getByRole('link', { name: /^Appeler Durand · 06 11 22 33 44/ })).toHaveAttribute('href', 'tel:0611223344');
  await shot(page, '07b-carte-partage');
  await fiche.getByRole('button', { name: 'Fermer' }).click();

  // Arrêter de partager : retiré du serveur.
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Accueil' }).click();
  await panneau.getByLabel(/^Je partage mon chantier/).click();
  await expect(panneau.getByLabel(/^Partager mon chantier/)).not.toBeChecked();
  await expect.poll(() => envois[envois.length - 1].p_donnees).toBeNull();

  // Quitter, puis rejoindre par le code (menu) : un mauvais code est refusé.
  await panneau.getByRole('button', { name: 'Quitter le chantier partagé' }).click();
  await expect(panneau).toHaveCount(0);
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Rejoindre un chantier partagé' }).click();
  const feuille = page.getByRole('dialog', { name: 'Chantier partagé' });
  await feuille.getByLabel('Code chantier').fill('zzz zzz');
  await expect(feuille.getByLabel('Code chantier')).toHaveValue('ZZZ-ZZZ');
  await feuille.getByRole('button', { name: 'Rejoindre le chantier' }).click();
  await expect(feuille.getByRole('alert')).toContainText('Code chantier inconnu');
  await feuille.getByLabel('Code chantier').fill('k7p3qx');
  await feuille.getByRole('button', { name: 'Rejoindre le chantier' }).click();
  await expect(feuille).toContainText('Remplacement traverses');
  await expect(feuille).toContainText('Durand');
});
