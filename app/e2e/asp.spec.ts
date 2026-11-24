import type { Page } from '@playwright/test';
import { expect, fakeShare, fmtPkTest, locate, openApp, pkValue, shot, showPoint, test } from './helpers';

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
  await page.getByRole('button', { name: /^Menu/ }).first().click();
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

test('chantier depuis ma position : vitesse de la ligne, délai et points d’annonce, dispositif, check-list, résumé, PDF et carte', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await fakeShare(page);
  await openApp(page);
  await locate(page);
  await page.getByRole('button', { name: /^Espace ASP/ }).click();
  const hub = page.getByRole('dialog', { name: 'Espace ASP' });
  await expect(hub).toContainText('Il partira de ta position : ligne 830 000');
  await shot(page, '03-hub');
  await hub.getByRole('button', { name: '+ Nouveau chantier' }).click();

  const fiche = page.getByRole('dialog', { name: /^Fiche chantier/ });
  await expect(fiche.getByRole('tab', { name: 'Annonce' })).toHaveAttribute('aria-selected', 'true');
  // Vitesse de la ligne à Lieusaint (données ouvertes) proposée aux deux voies.
  const vitesses = fiche.getByRole('textbox', { name: 'Vitesse maximale' });
  await expect(vitesses).toHaveCount(2);
  await expect(vitesses.nth(0)).toHaveValue('160');
  await expect(vitesses.nth(1)).toHaveValue('160');

  // Zone de 50 m à partir de ma position ; 1re catégorie, DD 5 s, marge 5 s : 10 s → 450 m à 160 km/h.
  const debut = pkValue(await fiche.locator('.screen-title small').innerText());
  const fin = debut + 0.05;
  const bar = page.getByRole('button', { name: 'Voir le résultat du calcul' });
  await expect(bar).toContainText('10 s');
  const pa = fiche.locator('.asp-pa');
  await expect(pa).toHaveCount(2);
  await expect(pa.nth(0)).toContainText('450 m');
  await expect(pa.nth(0)).toContainText(`PK ${fmtPkTest(debut - 0.45)}`);
  await expect(pa.nth(1)).toContainText('450 m');
  await expect(pa.nth(1)).toContainText(`PK ${fmtPkTest(fin + 0.45)}`);
  // Barre du bas : distance et point d'annonce de chaque voie, lisibles en entier sur un téléphone courant.
  await expect(bar.locator('.asp-bar-voies > span').first()).toContainText(`450 m PK ${fmtPkTest(debut - 0.45)}`);
  expect(await bar.locator('.asp-bar-voies > span').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length)).toBe(0);
  await shot(page, '04-annonce');

  // 2e catégorie : marge 15 s → 20 s → 890 m.
  await fiche.getByRole('radiogroup', { name: 'Catégorie d’outillage' }).getByRole('radio', { name: '2e' }).click();
  await expect(bar).toContainText('20 s');
  await expect(pa.nth(0)).toContainText('890 m');
  await expect(pa.nth(0)).toContainText(`PK ${fmtPkTest(debut - 0.89)}`);
  // DD nul sans raison : à régler.
  await fiche.getByRole('button', { name: 'Nul', exact: true }).click();
  await expect(bar).toContainText('à régler');
  await fiche.getByRole('button', { name: '5 s', exact: true }).click();
  await expect(bar).toContainText('20 s');
  await fiche.locator('#asp-resultat').scrollIntoViewIfNeeded();
  await shot(page, '05-resultat');

  // Dispositif : sans annonceur, les deux sens ne sont pas surveillés ; un annonceur par sens règle ça.
  await fiche.getByRole('tab', { name: 'Dispositif' }).click();
  const controles = fiche.locator('.asp-bloc', { hasText: 'Contrôles' });
  await expect(controles).toContainText('À régler');
  await fiche.getByRole('button', { name: 'Proposer un annonceur par sens' }).click();
  await expect(fiche.locator('.asp-agent')).toHaveCount(3);
  await expect(fiche.locator('.asp-code')).toHaveText(['ASP', 'A1', 'A2']);
  await expect(controles).not.toContainText('À régler');
  await expect(fiche.getByRole('textbox', { name: 'Position : kilomètres' }).nth(1)).toHaveValue(String(Math.floor(debut - 0.89)));
  await shot(page, '06-dispositif');

  // Fiches : une case cochée est gardée.
  await fiche.getByRole('tab', { name: 'Fiches' }).click();
  const premiere = fiche.locator('.asp-check-item input').first();
  await premiere.check();
  await expect(fiche.locator('.asp-check-count').first()).toContainText(/^1\//);
  await shot(page, '07-fiches');

  // Résumé par message, puis fiche PDF : envoyés par le partage du téléphone.
  await fiche.getByRole('button', { name: /^Résumé par message/ }).click();
  await expect(page.locator('.asp-toast')).toContainText('Résumé envoyé');
  const resume = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages[0].text ?? '');
  expect(resume).toContain('Ligne 830 000');
  expect(resume).toContain('DD 5 s · MS 15 s · DA 20 s');
  expect(resume).toContain(`890 m → point d’annonce PK ${fmtPkTest(debut - 0.89)}`);
  expect(resume).toContain('A1 annonceur');
  await fiche.getByRole('button', { name: 'Fiche CADA en PDF' }).click();
  await expect(page.locator('.asp-toast')).toContainText('PDF envoyé');
  const pdf = await page.evaluate(async () => {
    const f = (window as unknown as { __partages: ShareData[] }).__partages[1].files![0];
    return { name: f.name, type: f.type, size: f.size, head: await f.slice(0, 5).text() };
  });
  expect(pdf.name).toMatch(/^CADA-.+\.pdf$/);
  expect(pdf.type).toBe('application/pdf');
  expect(pdf.head).toBe('%PDF-');
  expect(pdf.size).toBeGreaterThan(5000);

  // Carte : zone, points d'annonce et annonceurs ; un point ouvre sa fiche.
  await fiche.getByRole('button', { name: 'Voir le chantier sur la carte' }).click();
  await expect(fiche).toBeHidden();
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
  await shot(page, '08-carte');
  const [longitude, latitude] = (await point.jsonValue())!;
  const { x, y } = await showPoint(page, { longitude, latitude });
  await page.mouse.click(x, y);
  await page.locator('.card').getByRole('button', { name: 'Ouvrir le chantier' }).click();
  await expect(page.getByRole('dialog', { name: /^Fiche chantier/ })).toBeVisible();

  // Gardé sur le téléphone : après rechargement, le chantier et la case cochée sont là.
  await page.reload();
  await page.getByRole('button', { name: /^Espace ASP/ }).click();
  await page.getByRole('dialog', { name: 'Espace ASP' }).locator('.asp-chantiers .result').first().click();
  await page.getByRole('tab', { name: 'Fiches' }).click();
  await expect(page.locator('.asp-check-item input').first()).toBeChecked();
});

test('calcul rapide, mémo, quiz et cas pratique', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^Espace ASP/ }).click();
  const hub = page.getByRole('dialog', { name: 'Espace ASP' });

  await hub.getByRole('button', { name: /^Calcul rapide/ }).click();
  const calcul = page.getByRole('dialog', { name: 'Calcul rapide' });
  await calcul.getByRole('textbox', { name: 'Vitesse maximale' }).fill('170');
  await calcul.getByRole('button', { name: '5 s', exact: true }).first().click();
  await calcul.locator('.chips').nth(2).getByRole('button', { name: '5 s', exact: true }).click();
  // 170 km/h, 10 s : 480 m (le tableau du support arrondit ici à 470 m, par erreur).
  await expect(calcul.locator('.asp-kpi-main b')).toHaveText('480');
  await calcul.getByRole('textbox', { name: 'Vitesse maximale' }).fill('200');
  await expect(calcul.locator('.asp-kpi-main b')).toHaveText('560');
  await shot(page, '09-calcul');
  await calcul.getByRole('button', { name: 'Retour' }).click();

  await hub.getByRole('button', { name: /^Mémo ASP/ }).click();
  const memo = page.getByRole('dialog', { name: 'Mémo ASP' });
  await memo.getByRole('textbox', { name: 'Chercher dans le mémo' }).fill('Gérard');
  await memo.locator('.result').first().click();
  await expect(page.locator('.asp-screen')).toContainText('Saint-Dizier');
  await shot(page, '10-memo');
  await page.getByRole('button', { name: 'Retour au mémo' }).click();
  await page.getByRole('dialog', { name: 'Mémo ASP' }).getByRole('button', { name: 'Retour' }).click();

  await hub.getByRole('button', { name: /^Quiz/ }).click();
  await page.getByRole('button', { name: /^Série de 10 questions/ }).click();
  await page.locator('.asp-reponse').first().click();
  await expect(page.locator('.asp-explication')).toContainText(/Bonne réponse|Pas tout à fait/);
  await shot(page, '11-quiz');
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await expect(page.getByRole('dialog', { name: 'Quiz' }).locator('.screen-title b')).toHaveText('Question 2/10');
  await page.getByRole('button', { name: 'Arrêter la série' }).click();
  await page.getByRole('dialog', { name: 'Quiz' }).getByRole('button', { name: 'Retour' }).click();

  await hub.getByRole('button', { name: /^Cas pratiques/ }).click();
  await page.getByRole('button', { name: /^Exercice 1/ }).click();
  const cas = page.getByRole('dialog', { name: /^Exercice 1/ });
  await cas.getByRole('radio', { name: 'Oui' }).click();
  await cas.getByRole('radiogroup', { name: 'Marge de sécurité' }).getByRole('radio', { name: '5 s', exact: true }).click();
  await cas.getByRole('textbox', { name: 'Délai d’annonce' }).fill('10');
  await cas.getByRole('button', { name: 'Vérifier mes réponses' }).click();
  await expect(cas.locator('.asp-verdict.juste').first()).toBeVisible();
  await cas.getByRole('button', { name: 'Voir la correction' }).click();
  await expect(cas.locator('.asp-correction')).toContainText('450 m');
  await shot(page, '12-cas');
  await cas.getByRole('button', { name: 'Ouvrir ce cas comme un chantier' }).click();
  await expect(page.getByRole('dialog', { name: /^Fiche chantier/ })).toBeVisible();
  await expect(page.locator('.asp-toast')).toContainText('Cas pratique ouvert');
});

test('petit écran (320 × 568) : les écrans de l’ASP ne débordent pas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openApp(page);
  await locate(page);
  const deborde = () =>
    page.evaluate(() => {
      const bad = [...document.querySelectorAll<HTMLElement>('.asp-screen *')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      });
      return { sw: document.documentElement.scrollWidth, bad: bad.slice(0, 5).map((e) => `${e.tagName}.${e.className} « ${e.textContent?.slice(0, 40)} » ${Math.round(e.getBoundingClientRect().right)}`) };
    });
  await page.getByRole('button', { name: /^Espace ASP/ }).click();
  expect(await deborde()).toEqual({ sw: 320, bad: [] });
  await page.getByRole('button', { name: '+ Nouveau chantier' }).click();
  for (const tab of ['Chantier', 'Annonce', 'Dispositif', 'Fiches']) {
    await page.getByRole('tab', { name: tab }).click();
    expect(await deborde(), tab).toEqual({ sw: 320, bad: [] });
    if (process.env.SHOTS) await shot(page, `13-petit-${tab}`);
  }
  const bar = (await page.getByRole('button', { name: 'Voir le résultat du calcul' }).boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(568);
  // Barre du résultat : la distance de chaque voie se lit en entier.
  await expect(page.locator('.asp-bar-voies > span').first()).toContainText('450 m');
  const tronques = await page.locator('.asp-bar-voies > span').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(tronques).toBe(0);
});
