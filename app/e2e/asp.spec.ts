import type { Page } from '@playwright/test';
import { exporterPdf, expect, fakeShare, fmtPkTest, openApp, pkValue, pointAtPk, shot, showPoint, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

/** Vérification du code par le serveur, simulée : seul ABCDEF23 est valable (tant que `actif()`). */
async function fakeCodeServer(page: Page, actif: () => boolean = () => true) {
  const appels: string[] = [];
  await page.route('**/rest/v1/rpc/asp_verifier_code', async (route) => {
    const { p_code } = route.request().postDataJSON() as { p_code: string };
    appels.push(p_code);
    await route.fulfill({ json: p_code === 'ABCDEF23' && actif() ? { ok: true, nom: 'Équipe test' } : { ok: false } });
  });
  return appels;
}

test('code d’accès : mauvais code refusé, bon code gardé sur le téléphone, puis code coupé', async ({ page }) => {
  let actif = true;
  const appels = await fakeCodeServer(page, () => actif);
  await openApp(page, { gate: true });
  await expect(page.getByRole('heading', { name: 'ASP Rail' })).toBeVisible();
  await shot(page, '01-code');
  const code = page.getByRole('textbox', { name: 'Code d’accès' });
  const entrer = page.getByRole('button', { name: 'Entrer' });
  await code.fill('abc');
  await entrer.click();
  await expect(page.getByRole('alert')).toContainText('8 signes');
  await code.fill('zzzz zzzz');
  await expect(code).toHaveValue('ZZZZ-ZZZZ');
  await entrer.click();
  await expect(page.getByRole('alert')).toContainText('Code inconnu ou coupé');
  await code.fill('abcd ef23');
  await expect(code).toHaveValue('ABCD-EF23');
  await entrer.click();
  await expect(page.locator('.map canvas')).toBeVisible();

  // Gardé : l'appli s'ouvre directement, et revérifie le code en arrière-plan.
  await page.reload();
  await expect(page.locator('.map canvas')).toBeVisible();
  await expect.poll(() => appels.filter((c) => c === 'ABCDEF23').length).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('heading', { name: /Équipe/ })).toBeVisible();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toContainText('ABCD-EF23 · Équipe test');

  // Coupé par l'administrateur : à la vérification suivante, l'appli se ferme.
  actif = false;
  await page.reload();
  await expect(page.getByText('Ton code n’est plus actif')).toBeVisible();
  await expect(page.locator('.map canvas')).toHaveCount(0);
});

test('lien reçu par message : le code se remplit tout seul et l’appli s’ouvre', async ({ page }) => {
  await fakeCodeServer(page);
  await openApp(page, { gate: true, path: './#code=ABCD-EF23' });
  await expect(page.locator('.map canvas')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
});

test('sans réseau au premier lancement : message clair', async ({ page }) => {
  await openApp(page, { gate: true });
  await page.getByRole('textbox', { name: 'Code d’accès' }).fill('ABCDEF23');
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page.getByRole('alert')).toContainText(/ne répond pas|Pas de réseau/);
});

test('espace administrateur : connexion, créer un code, le partager, le couper, le réactiver, le supprimer', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await fakeShare(page);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', email: 'admin@test.fr', role: 'authenticated', aud: 'authenticated', exp: now + 3600 })}.sig`;
  const codes: Record<string, unknown>[] = [];
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const { email, password } = route.request().postDataJSON() as { email: string; password: string };
    if (password !== 'bon-mot-de-passe') {
      return route.fulfill({ status: 400, json: { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
    }
    const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    await route.fulfill({ json: { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r1', user } });
  });
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/rest/v1/rpc/asp_est_admin', (route) => route.fulfill({ json: true }));
  await page.route('**/rest/v1/rpc/asp_creer_code', async (route) => {
    const { p_nom } = route.request().postDataJSON() as { p_nom: string };
    const c = { id: 'c1', code: 'KM7PQ2XZ', nom: p_nom, cree_le: new Date().toISOString(), coupe_le: null, derniere_utilisation: null };
    codes.unshift(c);
    await route.fulfill({ json: c });
  });
  await page.route('**/rest/v1/asp_codes**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: codes });
    const id = /id=eq\.([^&]+)/.exec(req.url())?.[1];
    const i = codes.findIndex((c) => c.id === id);
    if (req.method() === 'PATCH') Object.assign(codes[i], req.postDataJSON());
    if (req.method() === 'DELETE') codes.splice(i, 1);
    await route.fulfill({ status: 204, body: '' });
  });

  await openApp(page, { gate: true });
  await page.getByRole('link', { name: 'Espace administrateur' }).click();
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  await page.getByRole('textbox', { name: 'E-mail' }).fill('admin@test.fr');
  await page.getByLabel('Mot de passe', { exact: true }).fill('faux');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou mot de passe incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).fill('bon-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Connecté : admin@test.fr')).toBeVisible();
  await expect(page.getByText('Aucun code ici.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Nouveau code pour…' }).fill('Karim B.');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  const item = page.locator('.admin-codes li').first();
  await expect(item).toContainText('Karim B.');
  await expect(item).toContainText('KM7P-Q2XZ');
  await expect(item).toContainText('pas encore utilisé');
  await shot(page, '02-admin');
  await item.getByRole('button', { name: 'Partager' }).click();
  const partage = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages[0]);
  expect(partage.text).toContain('KM7P-Q2XZ');
  expect(partage.text).toContain('/#code=KM7P-Q2XZ');

  await item.getByRole('button', { name: 'Couper' }).click();
  await expect(page.locator('.admin-msg')).toContainText('Code de Karim B. coupé');
  expect(codes[0].coupe_le).toBeTruthy();
  await expect(page.getByText('Aucun code ici.')).toBeVisible();
  await page.getByRole('radio', { name: 'Coupés' }).click();
  await page.locator('.admin-codes li').first().getByRole('button', { name: 'Réactiver' }).click();
  await expect(page.locator('.admin-msg')).toContainText('Code de Karim B. réactivé');
  expect(codes[0].coupe_le).toBeNull();

  // La session reste ouverte après un rechargement.
  await page.reload();
  await expect(page.getByText('Connecté : admin@test.fr')).toBeVisible();
  await page.locator('.admin-codes li').first().getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText('Aucun code ici.')).toBeVisible();
  expect(codes).toHaveLength(0);
  await page.getByRole('button', { name: 'se déconnecter' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  await page.getByRole('button', { name: /Revenir à l’appli/ }).click();
  await expect(page.getByRole('textbox', { name: 'Code d’accès' })).toBeVisible();
});

/** Les questions du nouveau chantier, en gardant les choix proposés sauf ceux indiqués. */
async function creerChantier(page: Page, choix: { nuit?: boolean; outillage?: RegExp } = {}) {
  await page.getByRole('button', { name: 'Nouveau chantier' }).first().click();
  const ecran = page.getByRole('dialog', { name: 'Nouveau chantier' });
  await expect(ecran.getByRole('heading', { name: 'Où est le chantier ?' })).toBeVisible();
  await expect(ecran.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  await ecran.getByRole('button', { name: /Utiliser ma position GPS/ }).click();
  await expect(ecran.getByText('Position prise')).toBeVisible({ timeout: 20_000 });
  await expect(ecran.getByText('Ligne de Paris-Lyon à Marseille-St-Charles')).toBeVisible();
  const debut = pkValue((await ecran.getByText(/^Ligne 830 000 · PK/).innerText()) ?? '');
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  await expect(ecran.getByRole('heading', { name: 'Comment se passe le chantier ?' })).toBeVisible();
  if (choix.nuit) await ecran.getByRole('radio', { name: /De nuit/ }).click();
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  await expect(ecran.getByRole('radio', { name: /Double voie/ })).toHaveAttribute('aria-checked', 'true');
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  // Vitesse de la ligne à Lieusaint (données ouvertes), proposée pour toutes les voies.
  await expect(ecran.getByText('160 km/h d’après la ligne')).toBeVisible();
  await expect(ecran.getByRole('textbox', { name: 'Vitesse maximale' })).toHaveValue('160');
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  if (choix.outillage) await ecran.getByRole('radio', { name: choix.outillage }).click();
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  await expect(ecran.getByRole('radio', { name: '5 s', exact: true })).toHaveAttribute('aria-checked', 'true');
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  await expect(ecran.getByRole('heading', { name: 'Un cas particulier ?' })).toBeVisible();
  await ecran.getByRole('button', { name: 'Voir le résultat' }).click();
  await expect(ecran.getByRole('heading', { name: 'Ton annonce' })).toBeVisible();
  return { ecran, debut };
}

test('nouveau chantier pas à pas : position, vitesse de la ligne, résultat, annonceurs, fiche, partage et carte', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await fakeShare(page);
  await openApp(page, { home: true });
  await expect(page.getByRole('heading', { name: 'Prépare ton chantier' })).toBeVisible();
  await shot(page, '01-accueil');
  const { ecran, debut } = await creerChantier(page, { outillage: /^1re catégorie/ });
  const fin = debut + 0.05;

  // 1re catégorie, DD 5 s, marge 5 s : 10 s → 450 m à 160 km/h, de chaque côté de la zone.
  await expect(ecran.getByLabel('Délai d’annonce 10 secondes')).toBeVisible();
  const pa = ecran.locator('.ds-pa');
  await expect(pa).toHaveCount(2);
  await expect(pa.nth(0)).toContainText('450 m');
  await expect(pa.nth(0)).toContainText(`PK ${fmtPkTest(debut - 0.45)}`);
  await expect(pa.nth(1)).toContainText(`PK ${fmtPkTest(fin + 0.45)}`);
  await expect(ecran.locator('.ds-status')).toHaveText('Prêt');
  await shot(page, '02-resultat');
  await ecran.getByRole('button', { name: 'Placer un annonceur par sens' }).click();

  // La fiche : prête, avec un annonceur par sens placé au point d'annonce.
  const fiche = page.getByRole('dialog', { name: /^Fiche chantier/ });
  await expect(fiche.locator('.ds-hero .ds-status')).toHaveText('Prêt');
  await expect(fiche.getByRole('button', { name: /^A1 : Annonceur/ })).toContainText(`PK ${fmtPkTest(debut - 0.45)}`);
  await expect(fiche.getByRole('button', { name: /^A2 : Annonceur/ })).toContainText('surveille V2 ▼');
  await shot(page, '03-fiche');

  // Modifier une étape : 2e catégorie → marge 15 s → 20 s → 890 m.
  await fiche.getByRole('button', { name: 'Modifier : Outillage' }).click();
  const modif = page.getByRole('dialog', { name: 'Modifier : Outillage' });
  await modif.getByRole('radio', { name: /^2e catégorie/ }).click();
  await modif.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(fiche.getByLabel('Délai d’annonce 20 secondes')).toBeVisible();
  await expect(fiche.locator('.ds-pa').nth(0)).toContainText('890 m');
  // Le dispositif ne suit pas tout seul : A1 est resté à l'ancien point d'annonce.
  await fiche.getByRole('button', { name: /^A1 : Annonceur/ }).click();
  const agent = page.getByRole('dialog', { name: 'A1 · Annonceur' });
  await agent.getByRole('button', { name: /Au point d’annonce V1/ }).click();
  await agent.getByRole('button', { name: 'OK' }).click();
  await expect(fiche.getByRole('button', { name: /^A1 : Annonceur/ })).toContainText(`PK ${fmtPkTest(debut - 0.89)}`);

  // Check-list : une case cochée est gardée.
  await fiche.getByRole('button', { name: /^Check-lists/ }).click();
  const checks = page.getByRole('dialog', { name: 'Check-lists' });
  await checks.locator('.ds-check input').first().check();
  await checks.getByRole('button', { name: 'Retour' }).click();
  await expect(fiche.getByRole('button', { name: /^Check-lists/ })).toContainText(/^.*1\/\d+/);

  // Partager : résumé par message, puis fiche PDF.
  await fiche.getByRole('button', { name: 'Partager' }).click();
  await page.getByRole('dialog', { name: 'Partager' }).getByRole('button', { name: /Résumé par message/ }).click();
  await expect(page.locator('.ds-snack')).toContainText('Résumé envoyé');
  const resume = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages[0].text ?? '');
  expect(resume).toContain('Ligne 830 000');
  expect(resume).toContain('DD 5 s · MS 15 s · DA 20 s');
  expect(resume).toContain(`890 m → point d’annonce PK ${fmtPkTest(debut - 0.89)}`);
  await fiche.getByRole('button', { name: 'Partager' }).click();
  await page.getByRole('dialog', { name: 'Partager' }).getByRole('button', { name: /Fiche CADA en PDF/ }).click();
  const pdf = await exporterPdf(page, { nom: 'Moo Test', signer: true });
  await expect(page.locator('.ds-snack')).toContainText('PDF envoyé');
  expect(pdf.name).toMatch(/^CADA-.+-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/);
  expect(pdf.type).toBe('application/pdf');
  expect(pdf.texte).toMatch(/Créé le\s+\d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/);
  for (const x of ['Fiche CADA', 'Agent : Moo Test', 'Plan de situation', 'Distances et points d’annonce', 'Signatures', 'Signé sur le téléphone le'])
    expect(pdf.texte, x).toContain(x);
  expect(pdf.images).toBe(1);

  // Retour à l'accueil : c'est le chantier du jour, avec ses points d'annonce.
  await fiche.getByRole('button', { name: 'Retour' }).click();
  const hero = page.getByRole('region', { name: 'Mon chantier' });
  await expect(hero).toContainText('Chantier du jour');
  await expect(hero.locator('.ds-pa').nth(0)).toContainText('890 m');
  await shot(page, '04-accueil');

  // Carte : zone, points d'annonce et annonceurs ; un point rouvre la fiche.
  await hero.getByRole('button', { name: 'Voir sur la carte' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Carte' })).toHaveAttribute('aria-current', 'page');
  const point = await page.waitForFunction(
    () => {
      type M = import('maplibre-gl').Map;
      const m = (window as unknown as { __aspMap: M }).__aspMap;
      const f = m.queryRenderedFeatures({ layers: ['u-asp-pa'] });
      return f.length >= 2 ? ((f[0].geometry as GeoJSON.Point).coordinates as [number, number]) : null;
    },
    undefined,
    { timeout: 15_000 },
  );
  await shot(page, '05-carte');
  const [longitude, latitude] = (await point.jsonValue())!;
  const { x, y } = await showPoint(page, { longitude, latitude });
  await page.mouse.click(x, y);
  await page.locator('.card').getByRole('button', { name: 'Ouvrir le chantier' }).click();
  await expect(page.getByRole('dialog', { name: /^Fiche chantier/ })).toBeVisible();

  // Gardé sur le téléphone : après rechargement, l'accueil le montre, la case cochée est là.
  await page.reload();
  await page.getByRole('region', { name: 'Mon chantier' }).getByRole('button', { name: 'Ouvrir la fiche' }).click();
  await page.getByRole('button', { name: /^Check-lists/ }).click();
  await expect(page.locator('.ds-check input').first()).toBeChecked();
});

test('interdiction obligatoire : signalée, puis réglée en un toucher', async ({ page }) => {
  await openApp(page, { home: true });
  const { ecran } = await creerChantier(page, { nuit: true, outillage: /^2e catégorie/ });
  // 2e catégorie de nuit : interdiction de circulation obligatoire sur la voie de travail.
  await expect(ecran.locator('.ds-alert.stop')).toContainText('Interdiction de circulation obligatoire');
  await expect(ecran.locator('.ds-status')).toHaveText('1 à régler');
  await ecran.getByRole('button', { name: 'J’ai l’avis de voie interdite pour V1' }).click();
  // V1 sort de l'annonce : on annonce V2 dans son sens, et la marge passe à 5 s (voie interdite).
  await expect(ecran.locator('.ds-alert.stop')).toHaveCount(0);
  await expect(ecran.locator('.ds-pa')).toHaveCount(1);
  await expect(ecran.locator('.ds-pa').first()).toContainText('V2');
  await expect(ecran.getByLabel('Délai d’annonce 10 secondes')).toBeVisible();
});

test('bouton retour du téléphone : étape précédente, puis fermeture, puis accueil', async ({ page }) => {
  await openApp(page, { home: true });
  await page.getByRole('button', { name: 'Nouveau chantier' }).first().click();
  const ecran = page.getByRole('dialog', { name: 'Nouveau chantier' });
  await ecran.getByRole('textbox', { name: 'Ligne (code à 6 chiffres)' }).fill('830000');
  await ecran.getByRole('textbox', { name: 'PK de début : kilomètres' }).fill('28');
  await ecran.getByRole('button', { name: 'Continuer' }).click();
  await expect(ecran.getByRole('heading', { name: 'Comment se passe le chantier ?' })).toBeVisible();
  await page.goBack();
  await expect(ecran.getByRole('heading', { name: 'Où est le chantier ?' })).toBeVisible();
  await page.goBack();
  await expect(ecran).toBeHidden();
  // Chantier commencé : gardé en brouillon ; on reste dans l'appli.
  await expect(page.getByRole('region', { name: 'Mon chantier' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Calcul' }).click();
  await expect(page.getByRole('region', { name: 'Calcul rapide' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('main', { name: 'Accueil' })).toBeVisible();
  // Ouvert puis refermé sans rien toucher : pas de chantier vide.
  await page.getByRole('button', { name: 'Nouveau chantier' }).first().click();
  await page.getByRole('dialog', { name: 'Nouveau chantier' }).getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('.asp-chantiers .ds-row')).toHaveCount(0);
});

test('onglets Calcul et Réviser : distance, mémo, quiz et cas pratique', async ({ page }) => {
  await openApp(page, { home: true });
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Calcul' }).click();
  const calcul = page.getByRole('region', { name: 'Calcul rapide' });
  await calcul.getByRole('textbox', { name: 'Autre vitesse' }).fill('170');
  // 170 km/h, 10 s : 480 m (le tableau du support arrondit ici à 470 m, par erreur).
  await expect(calcul.locator('.ds-calc-num b')).toHaveText('480');
  await calcul.getByRole('radiogroup', { name: 'Vitesse maximale' }).getByRole('radio', { name: '200' }).click();
  await expect(calcul.locator('.ds-calc-num b')).toHaveText('560');
  await calcul.getByRole('radiogroup', { name: 'Marge de sécurité' }).getByRole('radio', { name: '15 s' }).click();
  await expect(calcul.locator('.ds-calc-num b')).toHaveText('1120');
  await shot(page, '06-calcul');

  await nav.getByRole('button', { name: 'Réviser' }).click();
  const reviser = page.getByRole('main', { name: 'Réviser' });
  await reviser.getByRole('button', { name: /^Mémo ASP/ }).click();
  const memo = page.getByRole('dialog', { name: 'Mémo ASP' });
  await memo.getByRole('searchbox', { name: 'Chercher dans le mémo' }).fill('Gérard');
  await memo.locator('.ds-row').first().click();
  await expect(page.locator('.asp-screen')).toContainText('Saint-Dizier');
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Mémo ASP' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Mémo ASP' }).getByRole('button', { name: 'Retour' }).click();

  await reviser.getByRole('button', { name: /^Quiz(?! PN| LAM)/ }).click();
  await page.getByRole('button', { name: /^Série de 10 questions/ }).click();
  await page.locator('.asp-reponse').first().click();
  await expect(page.locator('.asp-explication')).toContainText(/Bonne réponse|Pas tout à fait/);
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await expect(page.getByRole('dialog', { name: 'Quiz' }).locator('.screen-title b')).toHaveText('Question 2/10');
  await page.getByRole('button', { name: 'Arrêter la série' }).click();
  await page.getByRole('dialog', { name: 'Quiz' }).getByRole('button', { name: 'Retour' }).click();

  await reviser.getByRole('button', { name: /^Cas pratiques(?! PN| LAM)/ }).click();
  await page.getByRole('button', { name: /^Exercice 1/ }).click();
  const cas = page.getByRole('dialog', { name: /^Exercice 1/ });
  await cas.getByRole('radio', { name: 'Oui' }).click();
  await cas.getByRole('radiogroup', { name: 'Marge de sécurité' }).getByRole('radio', { name: '5 s', exact: true }).click();
  await cas.getByRole('textbox', { name: 'Délai d’annonce' }).fill('10');
  await cas.getByRole('button', { name: 'Vérifier mes réponses' }).click();
  await expect(cas.locator('.asp-verdict.juste').first()).toBeVisible();
  await cas.getByRole('button', { name: 'Voir la correction' }).click();
  await expect(cas.locator('.asp-correction')).toContainText('450 m');
  await cas.getByRole('button', { name: 'Ouvrir ce cas comme un chantier' }).click();
  await expect(page.getByRole('dialog', { name: /^Fiche chantier/ })).toBeVisible();
  await expect(page.locator('.ds-snack')).toContainText('Cas pratique ouvert');
});

test('petit écran (320 × 568) : accueil, parcours, fiche et onglets ne débordent pas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openApp(page, { home: true });
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
  expect(await deborde()).toEqual({ sw: 320, bad: [] });
  await page.getByRole('button', { name: 'Nouveau chantier' }).first().click();
  const ecran = page.getByRole('dialog', { name: 'Nouveau chantier' });
  await ecran.getByRole('button', { name: /Utiliser ma position GPS/ }).click();
  await expect(ecran.getByText('Position prise')).toBeVisible({ timeout: 20_000 });
  for (let k = 0; k < 7; k++) {
    expect(await deborde(), `étape ${k + 1}`).toEqual({ sw: 320, bad: [] });
    const btn = ecran.getByRole('button', { name: /^(Continuer|Voir le résultat)$/ });
    const box = (await btn.boundingBox())!;
    expect(box.y + box.height, `bouton de l’étape ${k + 1} sous le pouce`).toBeLessThanOrEqual(568);
    await btn.click();
  }
  expect(await deborde(), 'résultat').toEqual({ sw: 320, bad: [] });
  await ecran.getByRole('button', { name: 'Placer un annonceur par sens' }).click();
  expect(await deborde(), 'fiche').toEqual({ sw: 320, bad: [] });
  await page.getByRole('dialog', { name: /^Fiche chantier/ }).getByRole('button', { name: 'Retour' }).click();
  for (const tab of ['Calcul', 'Réviser', 'Accueil']) {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: tab }).click();
    expect(await deborde(), tab).toEqual({ sw: 320, bad: [] });
  }
});

test('accueil en direct : position qui suit l’agent, distance à la vitesse de la ligne, mémo, quiz et question du jour', async ({ page }) => {
  await openApp(page, { home: true });
  // GPS déjà autorisé : la case se remplit toute seule, sans rien toucher.
  const ou = page.getByRole('button', { name: /^Où suis-je : ligne 830 000, PK 28\+\d{3}$/ });
  await expect(ou).toBeVisible({ timeout: 20_000 });
  await expect(ou).toContainText('En direct');
  // L'agent marche le long des voies : le PK suit.
  await page.context().setGeolocation({ ...pointAtPk('830000', 29.2), accuracy: 4 });
  await expect(page.getByRole('button', { name: /^Où suis-je : ligne 830 000, PK 29\+[12]\d{2}$/ })).toBeVisible({ timeout: 15_000 });
  // Calcul : vitesse de la ligne à cet endroit (160 km/h) → 450 m à 10 s.
  await expect(page.getByRole('button', { name: 'Calcul rapide : 160 km/h, 450 m à 10 s' })).toBeVisible();
  await shot(page, '07-accueil-direct');

  // Mémo : la règle change toute seule.
  const regle = page.getByRole('button', { name: 'Mémo ASP' }).locator('.ds-quick-rule');
  const avant = await regle.innerText();
  await expect(regle).not.toHaveText(avant, { timeout: 10_000 });

  // Question du jour : la réponse compte dans la progression du quiz, et reste affichée dans la journée.
  const quiz = page.getByRole('button', { name: /^Quiz : / });
  await expect(quiz).toHaveAccessibleName(/^Quiz : 0 %/);
  const qdj = page.getByRole('region', { name: 'Question du jour' });
  await qdj.locator('.ds-qdj-btn').first().click();
  await expect(qdj.locator('.ds-status')).toHaveText(/Bonne réponse|À revoir/);
  const juste = (await qdj.locator('.ds-status').innerText()) === 'Bonne réponse';
  await expect(quiz).toContainText(juste ? /1\/\d+ sues/ : '1 erreur à revoir');
  await expect(qdj.locator('.ds-qdj-expl')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Question du jour' }).locator('.ds-status')).toHaveText(juste ? 'Bonne réponse' : 'À revoir');

  // Un écran ouvert par-dessus : le GPS de l'accueil s'arrête (il reprend au retour).
  await page.getByRole('button', { name: 'Nouveau chantier' }).first().click();
  await page.getByRole('dialog', { name: 'Nouveau chantier' }).getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('button', { name: /^Où suis-je : ligne 830 000/ })).toBeVisible({ timeout: 15_000 });
});
