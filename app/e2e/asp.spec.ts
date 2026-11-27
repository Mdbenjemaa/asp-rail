import type { Page } from '@playwright/test';
import { choisirMission, expect, exporterPdf, fakeShare, fmtPkTest, openApp, pkValue, pointAtPk, shot, showPoint, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

/**
 * Vérification du code par le serveur, simulée : seul ABCDEF23 est valable, tant que `etat()` vaut « actif »
 * (sinon : coupé ou arrivé à sa fin). Garde les appels (code et téléphone).
 */
async function fakeCodeServer(page: Page, etat: () => 'actif' | 'coupe' | 'fin' = () => 'actif', extra: Record<string, unknown> = {}) {
  const appels: string[] = [];
  const appareils = new Set<string>();
  await page.route('**/rest/v1/rpc/asp_verifier_code', async (route) => {
    const { p_code, p_appareil } = route.request().postDataJSON() as { p_code: string; p_appareil?: string };
    appels.push(p_code);
    if (p_appareil) appareils.add(p_appareil);
    const e = p_code === 'ABCDEF23' ? etat() : 'inconnu';
    await route.fulfill({ json: e === 'actif' ? { ok: true, nom: 'Équipe test', hors_ligne_h: 720, expire_le: null, ...extra } : { ok: false, raison: e } });
  });
  return Object.assign(appels, { appareils });
}

/** Recharge la page ; une fois de plus si l'appli se rechargeait déjà elle-même (mise à jour du service worker). */
async function recharger(page: Page) {
  try {
    await page.reload();
  } catch {
    await page.waitForLoadState();
    await page.reload();
  }
}

test('code d’accès : mauvais code refusé, bon code gardé sur le téléphone, puis code coupé', async ({ page }) => {
  let actif = true;
  const appels = await fakeCodeServer(page, () => (actif ? 'actif' : 'coupe'));
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
  await recharger(page);
  await expect(page.locator('.map canvas')).toBeVisible();
  await expect.poll(() => appels.filter((c) => c === 'ABCDEF23').length).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('heading', { name: /Équipe/ })).toBeVisible();
  await page.getByRole('button', { name: /^Réglages/ }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toContainText('ABCD-EF23 · Équipe test');

  // Un seul identifiant de téléphone, toujours le même (pour la liste des téléphones de l'administrateur).
  expect(appels.appareils.size).toBe(1);

  // Coupé par l'administrateur pendant que l'appli est ouverte : elle se ferme dès le retour sur l'appli.
  actif = false;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Ton code n’est plus actif')).toBeVisible();
  await expect(page.locator('.map canvas')).toHaveCount(0);
  await recharger(page);
  await expect(page.getByText('Accès réservé')).toBeVisible();
});

test('code coupé : l’appli ouverte se ferme d’elle-même dans la minute', async ({ page }) => {
  let etat: 'actif' | 'coupe' | 'fin' = 'actif';
  await fakeCodeServer(page, () => etat);
  await page.clock.install();
  await openApp(page, { gate: true, path: './#code=ABCD-EF23', home: true });
  await expect(page.getByRole('main', { name: 'Accueil' })).toBeVisible();
  etat = 'fin';
  await page.clock.runFor(61_000);
  await expect(page.getByText('Ton code est arrivé à sa fin')).toBeVisible();
});

test('code arrivé à sa fin : l’appli ne s’ouvre plus, même sans réseau', async ({ page }) => {
  const maintenant = Date.now();
  // Fin passée gardée sur le téléphone : l'appli ne s'ouvre pas, même hors ligne.
  await openApp(page, { gate: true, storage: { 'asp-acces': JSON.stringify({ code: 'ABCDEF23', nom: 'Démo', verifie: maintenant - 60_000, horsLigneH: 720, fin: maintenant - 1000 }) } });
  await expect(page.getByText('Ton code est arrivé à sa fin')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Code d’accès' })).toHaveValue('ABCD-EF23');
});

test('réseau obligatoire : sans vérification récente, l’appli demande du réseau', async ({ page }) => {
  await openApp(page, { gate: true, storage: { 'asp-acces': JSON.stringify({ code: 'ABCDEF23', nom: 'Démo', verifie: Date.now() - 10 * 60_000, horsLigneH: 0, fin: null }) } });
  await expect(page.getByText('Ce code demande du réseau')).toBeVisible();
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

test('espace administrateur : mot de passe oublié, le lien du mail collé sans l’ouvrir, puis nouveau mot de passe', async ({ page }) => {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', email: 'admin@test.fr', role: 'authenticated', aud: 'authenticated', exp: now + 3600 })}.sig`;
  const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test.fr', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jeton = 'pkce_e2e0123456789abcdefABCDEF';
  let verifie: Record<string, unknown> = {};
  let nouveau = '';
  await page.route('**/auth/v1/recover**', (route) => route.fulfill({ json: {} }));
  await page.route('**/auth/v1/verify**', async (route) => {
    verifie = route.request().postDataJSON() as Record<string, unknown>;
    if (verifie.token_hash !== jeton) return route.fulfill({ status: 403, json: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } });
    await route.fulfill({ json: { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r1', user } });
  });
  await page.route('**/auth/v1/user**', async (route) => {
    if (route.request().method() === 'PUT') nouveau = (route.request().postDataJSON() as { password: string }).password;
    await route.fulfill({ json: user });
  });
  await page.route('**/rest/v1/rpc/asp_mon_role', (route) => route.fulfill({ json: { email: 'admin@test.fr', super: true, entreprises: [{ id: 'e1', nom: 'Entreprise test' }] } }));
  await page.route('**/rest/v1/asp_codes**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/asp_appareils**', (route) => route.fulfill({ json: [] }));
  await openApp(page, { gate: true, path: './#admin' });
  await page.getByLabel('E-mail').fill('admin@test.fr');
  await page.getByRole('button', { name: 'Mot de passe oublié' }).click();
  await expect(page.getByRole('status')).toContainText('un lien pour changer le mot de passe vient d’être envoyé');
  // Lien copié depuis le mail (enveloppé par la messagerie), sans l'ouvrir.
  const lien = `https://www.google.com/url?q=${encodeURIComponent(`https://exemple.supabase.co/auth/v1/verify?token=${jeton}&type=recovery&redirect_to=http://localhost:3000`)}`;
  await page.getByLabel('Lien reçu par mail').fill('https://exemple.supabase.co/auth/v1/verify?token=pkce_mauvais0123456789abcdef&type=recovery');
  await page.getByRole('button', { name: 'Choisir mon mot de passe' }).click();
  await expect(page.getByRole('alert')).toContainText('Lien expiré ou déjà utilisé');
  await page.getByLabel('Lien reçu par mail').fill(lien);
  await page.getByRole('button', { name: 'Choisir mon mot de passe' }).click();
  await expect.poll(() => verifie).toMatchObject({ token_hash: jeton, type: 'recovery' });
  await page.getByLabel('Nouveau mot de passe').fill('mon-nouveau-mdp-1');
  await page.getByRole('button', { name: /^Enregistrer/ }).click();
  await expect.poll(() => nouveau).toBe('mon-nouveau-mdp-1');
  await expect(page.getByRole('tab', { name: 'Chantiers' })).toBeVisible();
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
  await page.route('**/rest/v1/rpc/asp_mon_role', (route) => route.fulfill({ json: { email: 'admin@test.fr', super: true, entreprises: [{ id: 'e1', nom: 'Entreprise test' }] } }));
  let creation: Record<string, unknown> = {};
  await page.route('**/rest/v1/rpc/asp_creer_code', async (route) => {
    creation = route.request().postDataJSON() as Record<string, unknown>;
    const { p_nom, p_duree_h, p_hors_ligne_h } = creation as { p_nom: string; p_duree_h: number | null; p_hors_ligne_h: number };
    const expire_le = p_duree_h ? new Date(Date.now() + p_duree_h * 3600_000).toISOString() : null;
    const c = { id: 'c1', code: 'KM7PQ2XZ', nom: p_nom, cree_le: new Date().toISOString(), coupe_le: null, derniere_utilisation: null, expire_le, hors_ligne_h: p_hors_ligne_h };
    codes.unshift(c);
    await route.fulfill({ json: c });
  });
  // Téléphones vus pour chaque code (le premier code créé est « en ligne » sur un Android).
  await page.route('**/rest/v1/asp_appareils**', (route) =>
    route.fulfill({ json: codes.length ? [{ id: 'a1', code_id: 'c1', agent: 'Android · Chrome · appli installée', premier: new Date().toISOString(), dernier: new Date().toISOString() }] : [] }),
  );
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
  await page.getByRole('combobox', { name: 'Durée du code' }).selectOption({ label: '1 jour' });
  await page.getByRole('combobox', { name: 'Utilisation sans réseau' }).selectOption({ label: 'Réseau obligatoire' });
  await page.getByRole('button', { name: 'Créer le code' }).click();
  await expect.poll(() => creation).toEqual({ p_nom: 'Karim B.', p_duree_h: 24, p_hors_ligne_h: 0, p_entreprise: 'e1' });
  const item = page.locator('.admin-codes > li').first();
  await expect(item).toContainText('Karim B.');
  await expect(item).toContainText('KM7P-Q2XZ');
  await expect(item).toContainText(/Jusqu’au .* · réseau obligatoire/);
  await expect(item).toContainText('pas encore utilisé');
  await expect(page.locator('.admin-msg')).toContainText('jusqu’au');

  // Quelqu'un l'utilise : en ligne, et son téléphone.
  codes[0].derniere_utilisation = new Date().toISOString();
  await page.reload();
  await expect(page.getByText('Connecté : admin@test.fr')).toBeVisible();
  await expect(page.locator('.admin-resume')).toContainText('1 en ligne maintenant');
  await expect(item).toContainText('en ligne maintenant');
  await item.getByRole('button', { name: '1 téléphone' }).click();
  await expect(item.getByRole('list', { name: 'Téléphones de Karim B.' })).toContainText('Android · Chrome · appli installée');
  await shot(page, '02-admin-telephones');
  await shot(page, '02-admin');
  await item.getByRole('button', { name: 'Partager' }).click();
  const partage = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages[0]);
  expect(partage.text).toContain('KM7P-Q2XZ');
  expect(partage.text).toContain('/#code=KM7P-Q2XZ');

  await item.getByRole('button', { name: 'Couper' }).click();
  await expect(page.locator('.admin-msg')).toContainText('Code de Karim B. coupé : l’appli se ferme dans la minute');
  expect(codes[0].coupe_le).toBeTruthy();
  await expect(page.getByText('Aucun code ici.')).toBeVisible();
  await page.getByRole('radio', { name: 'Arrêtés' }).click();
  await page.locator('.admin-codes > li').first().getByRole('button', { name: 'Réactiver' }).click();
  await expect(page.locator('.admin-msg')).toContainText('Code de Karim B. réactivé');
  expect(codes[0].coupe_le).toBeNull();

  // La session reste ouverte après un rechargement.
  await page.reload();
  await expect(page.getByText('Connecté : admin@test.fr')).toBeVisible();
  await page.locator('.admin-codes > li').first().getByRole('button', { name: 'Supprimer' }).click();
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
  await choisirMission(page, 'asp');
  await page.getByRole('region', { name: 'Mon chantier' }).getByRole('button', { name: 'Ouvrir la fiche' }).click();
  await page.getByRole('button', { name: /^Check-lists/ }).click();
  await expect(page.locator('.ds-check input').first()).toBeChecked();
});

test('intervention : heures notées d’un toucher, trains annoncés, incident, fin et compte rendu PDF signé par l’ASP et le responsable', async ({ page }) => {
  await fakeShare(page);
  await openApp(page, { home: true });
  const { ecran } = await creerChantier(page, { outillage: /^1re catégorie/ });
  await ecran.getByRole('button', { name: 'Placer un annonceur par sens' }).click();
  const fiche = page.getByRole('dialog', { name: /^Fiche chantier/ });
  const section = fiche.locator('section').filter({ has: page.getByRole('heading', { name: /^Intervention/ }) });
  await expect(section.locator('.ds-status')).toHaveText('Pas commencée');

  // Un toucher par moment, dans l'ordre.
  await section.getByRole('button', { name: 'Je suis arrivé sur le chantier' }).click();
  await expect(section.locator('.ds-status')).toHaveText(/^En cours depuis \d+ min$/);
  await expect(section.getByRole('button', { name: /^Arrivée sur le chantier : noté à \d{2}:\d{2}/ })).toBeVisible();
  await section.getByRole('button', { name: 'Dispositif en place' }).click();
  // Les boutons tiennent dans la largeur de l'écran.
  const largeur = await section.locator('.ds-list').evaluate((el) => el.getBoundingClientRect().right);
  for (const b of await section.locator('.cr-actions .ds-btn').all()) expect((await b.boundingBox())!.x + (await b.boundingBox())!.width).toBeLessThanOrEqual(largeur + 1);

  // Trains annoncés : +1 par voie et sens, le dernier peut s'annuler.
  await section.getByRole('button', { name: 'Train annoncé sur V1 ▲' }).click();
  await section.getByRole('button', { name: 'Train annoncé sur V1 ▲' }).click();
  await section.getByRole('button', { name: 'Train annoncé sur V2 ▼' }).click();
  await expect(section.locator('.cr-compte')).toHaveText('3 trains annoncés');
  await section.getByRole('button', { name: /^Annuler le dernier train/ }).click();
  await expect(section.locator('.cr-compte')).toHaveText('2 trains annoncés');
  await expect(section).toContainText('V1 ▲ : 2');

  // Un incident, avec l'heure.
  await section.getByRole('button', { name: 'Incident', exact: true }).click();
  const evt = page.getByRole('dialog', { name: 'Noter un incident' });
  await evt.getByLabel('Ce qui s’est passé').fill('Annonce mal perçue sur V2, travaux arrêtés 5 min');
  await evt.getByRole('button', { name: /^Noter à \d{2}:\d{2}$/ }).click();
  await expect(section).toContainText('Annonce mal perçue sur V2');

  await section.getByRole('button', { name: 'Les travaux commencent' }).click();
  await section.getByRole('button', { name: 'Travaux finis, voies dégagées' }).click();
  // Une heure corrigée à la main.
  await section.getByRole('button', { name: /^Fin des travaux : noté à/ }).click();
  const heure = page.getByRole('dialog', { name: 'Fin des travaux' });
  await expect(heure.getByLabel('Heure')).toHaveValue(/^\d{2}:\d{2}$/);
  await heure.getByRole('button', { name: /^Enregistrer/ }).click();
  await shot(page, '06-intervention');

  // Dispositif levé : l'intervention est finie, le compte rendu est proposé.
  await section.getByRole('button', { name: 'Dispositif levé : fin de l’intervention' }).click();
  const finie = page.getByRole('dialog', { name: 'Intervention finie' });
  await expect(finie).toContainText('2 (V1 ▲ : 2)');
  await expect(finie).toContainText('Incidents1');
  await shot(page, '06b-intervention-finie');
  await finie.getByRole('button', { name: 'Compte rendu en PDF' }).click();
  const pdf = await exporterPdf(page, { nom: 'Moo Test', signer: true, responsable: 'M. Durand', signerResponsable: true });
  expect(pdf.name).toMatch(/^Compte-rendu-.+\.pdf$/);
  for (const x of ['Compte rendu d’intervention', 'Horaires', 'Dispositif levé', 'Trains annoncés : 2', 'Annonce mal perçue sur V2', 'Plan de situation', 'Responsable du chantier', 'M. Durand'])
    expect(pdf.plat, x).toContain(x);
  expect(pdf.plat).not.toContain('Non noté');
  expect(pdf.images).toBe(2);
  // Le nom du responsable est gardé dans la fiche.
  await expect(fiche.getByRole('button', { name: /^Équipe et notes/ })).toContainText('Resp. M. Durand');

  await expect(section.getByRole('button', { name: /^Dispositif levé : noté à \d{2}:\d{2}/ })).toBeVisible();
  await expect(section.locator('.ds-status')).toHaveText(/^Finie à \d{2}:\d{2}/);

  // À l'accueil : fini, compte rendu à un toucher.
  await fiche.getByRole('button', { name: 'Retour' }).click();
  const hero = page.getByRole('region', { name: 'Mon chantier' });
  await expect(hero.locator('.cr-rapide .ds-status')).toHaveText(/^Finie à/);
  await shot(page, '06c-accueil-finie');
  await hero.getByRole('button', { name: 'Compte rendu en PDF' }).click();
  await expect(page.getByRole('dialog', { name: 'Exporter en PDF' })).toBeVisible();
  // Les signatures sont gardées pour ce compte rendu.
  await expect(page.getByRole('dialog', { name: 'Exporter en PDF' }).locator('.ds-sig-gardee')).toHaveCount(2);
});

test('carte du chantier : appui long sur un annonceur, on le glisse le long de la voie, son PK suit (et Annuler)', async ({ page, browserName }) => {
  await openApp(page, { home: true });
  const { ecran, debut } = await creerChantier(page, { outillage: /^1re catégorie/ });
  await ecran.getByRole('button', { name: 'Placer un annonceur par sens' }).click();
  const fiche = page.getByRole('dialog', { name: /^Fiche chantier/ });
  await expect(fiche.getByRole('button', { name: /^A1 : Annonceur/ })).toContainText(`PK ${fmtPkTest(debut - 0.45)}`);
  await fiche.getByRole('button', { name: 'Voir le chantier sur la carte' }).click();
  await expect(page.locator('.toast')).toContainText('appui long sur un agent');
  await page.locator('.toast').click(); // un toucher ferme l'astuce

  // A1 (au point d'annonce, 450 m avant le chantier) et le début de la zone de travail, à l'écran.
  type M = import('maplibre-gl').Map;
  const pts = await page.waitForFunction(
    () => {
      const m = (window as unknown as { __aspMap: M }).__aspMap;
      const a1 = m.queryRenderedFeatures({ layers: ['u-asp-agent'] }).find((f) => f.properties?.label === 'A1');
      const zone = m.queryRenderedFeatures({ layers: ['u-asp-zone'] })[0];
      if (!a1 || !zone) return null;
      return { a1: (a1.geometry as GeoJSON.Point).coordinates as [number, number], zone: (zone.geometry as GeoJSON.LineString).coordinates[0] as [number, number] };
    },
    undefined,
    { timeout: 15_000 },
  );
  const { a1, zone } = (await pts.jsonValue())!;
  const ecranPts = await page.evaluate(
    ([p, q]) =>
      new Promise<{ x: number; y: number }[]>((resolve) => {
        const m = (window as unknown as { __aspMap: M }).__aspMap;
        // Entre le bandeau du PK (en haut) et la fiche « Autour de toi » (en bas).
        m.jumpTo({ center: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], zoom: 14.6, bearing: 0, padding: { top: 230, bottom: 380, left: 0, right: 0 } });
        m.once('idle', () => resolve([m.project(p), m.project(q)]));
      }),
    [a1, zone] as const,
  );
  const box = (await page.locator('.map').boundingBox())!;
  const [depart, arrivee] = ecranPts.map((pt) => ({ x: box.x + pt.x, y: box.y + pt.y }));

  // Appui long sur A1, puis glisser jusqu'au début de la zone : le PK suit en direct.
  // Avec le doigt dans Chrome (vrai geste tactile), à la souris dans Safari.
  const etapes = Array.from({ length: 12 }, (_, i) => ({ x: depart.x + ((arrivee.x - depart.x) * (i + 1)) / 12, y: depart.y + ((arrivee.y - depart.y) * (i + 1)) / 12 }));
  const bulle = page.locator('.toast.glisse');
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: depart.x, y: depart.y, id: 1 }] });
    await page.waitForTimeout(600);
    for (const pt of etapes) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...pt, id: 1 }] });
      await page.waitForTimeout(16);
    }
    await expect(bulle).toContainText(/^A1 · PK \d+\+\d{3} · PA V1 ▲ à \d+ m$/);
    // Son trait jusqu'au point d'annonce suit le doigt.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __aspMap: M }).__aspMap.querySourceFeatures('asp').find((f) => f.properties?.role === 'vue')?.properties?.label))
      .toMatch(/^A1 → PA V1 ▲ · \d+ m$/);
    await shot(page, '05b-deplacer-agent');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(depart.x, depart.y);
    await page.mouse.down();
    await page.waitForTimeout(600);
    for (const pt of etapes) await page.mouse.move(pt.x, pt.y);
    await expect(bulle).toContainText(/^A1 · PK \d+\+\d{3} · PA V1 ▲ à \d+ m$/);
    await page.mouse.up();
  }
  // Le relâcher n'a pas déclenché « me placer ici » ni ouvert la fiche de l'agent.
  await expect(page.locator('.card').getByRole('button', { name: 'Ouvrir le chantier' })).toHaveCount(0);

  // Posé sur la voie, près du début de la zone ; enregistré dans la fiche.
  const msg = page.locator('.toast').filter({ hasText: 'A1 déplacé au PK' });
  await expect(msg).toContainText(`(avant : ${fmtPkTest(debut - 0.45)})`);
  await expect(msg).toContainText('doit voir jusqu’au PK');
  const nouveau = pkValue((await msg.innerText()).replace(/^.*déplacé au PK /s, ''));
  expect(Math.abs(nouveau - debut)).toBeLessThan(0.02);
  /** PK gardé du premier annonceur (A1). */
  const pkGarde = () =>
    page.evaluate(() => (JSON.parse(localStorage.getItem('asp-chantiers-v1') ?? '[]') as { agents: { role: string; pk: number }[] }[])[0].agents.find((a) => a.role === 'annonceur')!.pk);
  expect(await pkGarde()).toBeCloseTo(nouveau, 3);

  // Annuler : A1 revient au point d'annonce.
  await msg.getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(pkGarde).toBeCloseTo(debut - 0.45, 3);

  // Sans appui long : toucher A1, « Déplacer A1 », puis toucher la voie là où on le veut.
  // (On attend qu'A1 soit redessiné à son point d'annonce.)
  await expect
    .poll(() =>
      page.evaluate(
        ([x, y]) => {
          const m = (window as unknown as { __aspMap: M }).__aspMap;
          const f = m.queryRenderedFeatures({ layers: ['u-asp-agent'] }).find((g) => g.properties?.label === 'A1');
          if (!f) return 999;
          const q = m.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
          const r = m.getContainer().getBoundingClientRect();
          return Math.hypot(r.x + q.x - x, r.y + q.y - y);
        },
        [depart.x, depart.y] as const,
      ),
    )
    .toBeLessThan(4);
  const fiche1 = page.locator('.card').filter({ hasText: 'Dispositif d’annonce' });
  // Le toucher simulé de WebKit se perd parfois : on retouche tant que la fiche d'A1 n'est pas ouverte.
  await expect(async () => {
    if (!(await fiche1.isVisible())) await page.touchscreen.tap(depart.x, depart.y);
    await expect(fiche1).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(fiche1.getByRole('button', { name: 'Me placer ici' })).toHaveCount(0);
  await fiche1.getByRole('button', { name: 'Déplacer A1' }).click();
  await expect(page.locator('.toast.glisse')).toContainText('Touche la voie là où tu veux A1');
  await page.touchscreen.tap(arrivee.x, arrivee.y);
  await expect(page.locator('.toast').filter({ hasText: 'A1 déplacé au PK' })).toBeVisible();
  expect(Math.abs((await pkGarde()) - debut)).toBeLessThan(0.02);

  // Au chantier, A1 doit voir arriver les trains jusqu'au point d'annonce : un trait pointillé, avec la distance.
  const trait = () =>
    page.evaluate(() => {
      const m = (window as unknown as { __aspMap: M }).__aspMap;
      return m.queryRenderedFeatures({ layers: ['u-asp-vue'] }).map((f) => f.properties?.label as string);
    });
  await expect.poll(async () => (await trait()).join()).toMatch(/A1 → PA V1 ▲ · 4\d\d m/);
  // En le touchant : son point d'annonce, ce qu'il doit voir, et le calcul.
  await page.waitForTimeout(600); // juste après l'avoir posé, un toucher n'ouvre pas sa fiche
  await page.touchscreen.tap(arrivee.x, arrivee.y);
  const fiche2 = page.locator('.card').filter({ hasText: 'Son point d’annonce' });
  await expect(fiche2.locator('.pa-ligne.voir')).toContainText(`PA V1 ▲ · PK ${fmtPkTest(debut - 0.45)}`);
  await expect(fiche2.locator('.pa-ligne.voir')).toContainText(/Doit voir arriver les trains sur 4\d\d m, jusqu’au PK/);
  await expect(fiche2.locator('.pa-calcul')).toContainText(/km\/h × \d+ s \(dégagement \d+ s \+ marge \d+ s\) = 450 m avant le chantier/);
  await shot(page, '05c-point-annonce-agent');
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

test('accueil général : bonjour, mon planning, choix de la mission avec ce qui est en cours, puis retour', async ({ page }) => {
  const d = new Date();
  const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const chantier = { id: 'c-jour', created: Date.now(), updated: Date.now(), nom: 'Traverses', date: jour, ligne: '830000', pkDebut: 28.718, pkFin: 28.768 };
  await openApp(page, { home: true, general: true, storage: { 'asp-chantiers-v1': [chantier] } });
  const accueil = page.getByRole('main', { name: 'Accueil' });
  await expect(accueil.getByRole('heading', { level: 1 })).toHaveText(/^Bon(jour|soir) Tests$/);
  await expect(accueil.getByRole('region', { name: 'Mon planning ETF' })).toBeVisible();
  await expect(accueil.getByRole('heading', { name: 'Choisis ta mission' })).toBeVisible();
  const cartes = accueil.locator('.ac-mission');
  await expect(cartes).toHaveCount(3);
  await expect(cartes.nth(0)).toContainText('Annonce');
  await expect(cartes.nth(0)).toContainText('Dernière');
  // Le chantier du jour et où en est l'annonce, sur la carte de l'annonce.
  await expect(cartes.nth(0)).toContainText('Aujourd’hui · Traverses');
  await expect(cartes.nth(0)).toContainText('Chaîne d’annonce pas encore en place');
  await expect(cartes.nth(1)).toContainText('Rien de prévu aujourd’hui');
  await shot(page, '00-accueil-general');

  // Agent PN : son accueil, avec le nom de la mission en titre ; la barre du bas suit.
  await choisirMission(page, 'pn');
  const mission = page.getByRole('main', { name: 'Accueil : Agent PN' });
  await expect(mission.getByRole('heading', { level: 1 })).toHaveText('Agent PN');
  await shot(page, '00b-accueil-mission');
  await expect(mission.getByRole('button', { name: /Nouvelle mission/ }).first()).toBeVisible();
  // Retour à l'accueil général : l'Agent PN est maintenant la dernière mission.
  await page.getByRole('button', { name: 'Revenir à l’accueil (changer de mission)' }).click();
  await expect(accueil.locator('.ac-mission').nth(1)).toContainText('Dernière');
  // L'annonce : le chantier du jour, comme avant.
  await choisirMission(page, 'asp');
  await expect(page.getByRole('region', { name: 'Mon chantier' })).toContainText('Traverses');
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
  await choisirMission(page, 'asp');
  await expect(page.getByRole('region', { name: 'Question du jour' }).locator('.ds-status')).toHaveText(juste ? 'Bonne réponse' : 'À revoir');

  // Un écran ouvert par-dessus : le GPS de l'accueil s'arrête (il reprend au retour).
  await page.getByRole('button', { name: 'Nouveau chantier' }).first().click();
  await page.getByRole('dialog', { name: 'Nouveau chantier' }).getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('button', { name: /^Où suis-je : ligne 830 000/ })).toBeVisible({ timeout: 15_000 });
});
