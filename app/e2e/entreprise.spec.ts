import type { Page, Route } from '@playwright/test';
import { choisirMission, expect, fakeShare, openApp, shot, test } from './helpers';

test.describe.configure({ mode: 'parallel' });

/** Logo de test : PNG 1 × 1. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const JETON = 'ab'.repeat(24);

/** Connexion simulée au serveur d'authentification : tout mot de passe donne une session pour cet e-mail. */
async function fakeAuth(page: Page, email: string) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', email, role: 'authenticated', aud: 'authenticated', exp: now + 3600 })}.sig`;
  const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const connexions: { email: string; password: string }[] = [];
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    connexions.push(route.request().postDataJSON() as { email: string; password: string });
    await route.fulfill({ json: { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r1', user } });
  });
  await page.route('**/auth/v1/user**', (route) => route.fulfill({ json: user }));
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
  for (const t of ['asp_codes', 'asp_appareils', 'asp_sessions', 'asp_partages']) await page.route(`**/rest/v1/${t}**`, (route) => route.fulfill({ json: [] }));
  return connexions;
}

const json = (route: Route) => route.request().postDataJSON() as Record<string, unknown>;

interface Ent {
  id: string;
  nom: string;
  modules: { planning: boolean; memo: boolean; quiz: boolean };
  logo_v: number;
  admins: string[];
  invitations: { id: string; email: string; expire_le: string }[];
}

/** Serveur simulé de l'espace administrateur, avec ses entreprises. */
async function fakeEntreprises(page: Page, email: string, sup: boolean, ents: Ent[]) {
  const appels: { f: string; args: Record<string, unknown> }[] = [];
  const resume = (e: Ent) => ({
    ...e,
    cree_le: new Date().toISOString(),
    codes_actifs: 3,
    actifs_jour: 1,
    actifs_7j: 2,
    actifs_30j: 3,
    telephones_7j: 2,
    agents: [{ nom: 'Équipe nuit', vu: new Date(Date.now() - 5 * 60_000).toISOString(), telephones: 2 }],
  });
  await page.route('**/rest/v1/rpc/asp_mon_role', (route) => route.fulfill({ json: { email, super: sup, entreprises: ents.map(({ id, nom }) => ({ id, nom })) } }));
  await page.route('**/rest/v1/rpc/asp_resume_entreprises', (route) => route.fulfill({ json: ents.map(resume) }));
  await page.route('**/rest/v1/asp_entreprises**', (route) => route.fulfill({ json: { logo: null } }));
  await page.route('**/rest/v1/rpc/asp_maj_entreprise', async (route) => {
    const a = json(route);
    appels.push({ f: 'maj', args: a });
    const e = ents.find((x) => x.id === a.p_id)!;
    if (a.p_modules) e.modules = a.p_modules as Ent['modules'];
    if (typeof a.p_nom === 'string') e.nom = a.p_nom;
    await route.fulfill({ json: { id: e.id, nom: e.nom, modules: e.modules, logo_v: e.logo_v, logo: false } });
  });
  await page.route('**/rest/v1/rpc/asp_inviter_admin', async (route) => {
    const a = json(route);
    appels.push({ f: 'inviter', args: a });
    const e = ents.find((x) => x.id === a.p_entreprise)!;
    const expire_le = new Date(Date.now() + 7 * 86_400_000).toISOString();
    e.invitations = [{ id: 'i1', email: String(a.p_email), expire_le }];
    await route.fulfill({ json: { id: 'i1', jeton: JETON, email: a.p_email, expire_le } });
  });
  await page.route('**/rest/v1/rpc/asp_creer_entreprise', async (route) => {
    const a = json(route);
    appels.push({ f: 'creer', args: a });
    const e: Ent = { id: `e${ents.length + 1}`, nom: String(a.p_nom), modules: { planning: false, memo: false, quiz: false }, logo_v: 0, admins: [], invitations: [] };
    ents.push(e);
    await route.fulfill({ json: { id: e.id, nom: e.nom } });
  });
  return appels;
}

test('contenu selon l’entreprise : sans planning, mémo ni quiz, puis tout ; nom et logo sur l’accueil', async ({ page }) => {
  let modules = { planning: false, memo: false, quiz: false };
  const logos: string[] = [];
  await page.route('**/rest/v1/rpc/asp_verifier_code', (route) =>
    route.fulfill({ json: { ok: true, nom: 'Karim', hors_ligne_h: 720, expire_le: null, entreprise: { id: 'e7', nom: 'Exemple Rail', modules, logo_v: 2 } } }),
  );
  await page.route('**/rest/v1/rpc/asp_logo', async (route) => {
    logos.push(String(json(route).p_code));
    await route.fulfill({ json: { ok: true, logo: PNG, v: 2 } });
  });
  await openApp(page, { gate: true, path: './#code=ABCD-EF23' });
  const accueil = page.getByRole('main', { name: 'Accueil' });
  await expect(accueil.getByLabel('Entreprise : Exemple Rail')).toBeVisible();
  await expect(accueil.getByLabel('Entreprise : Exemple Rail').locator('img')).toHaveAttribute('src', PNG);
  expect(logos).toEqual(['ABCDEF23']);
  await expect(accueil.getByRole('region', { name: 'Mon planning ETF' })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('button')).toHaveCount(3);
  await expect(nav.getByRole('button', { name: 'Réviser' })).toHaveCount(0);
  await shot(page, '40-entreprise-sans-contenu');
  await choisirMission(page, 'asp');
  await expect(page.getByRole('button', { name: 'Mémo ASP' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Quiz :/ })).toHaveCount(0);

  // L'administrateur d'ASP Rail active tout : visible à la vérification suivante (ici, au retour sur l'appli).
  modules = { planning: true, memo: true, quiz: true };
  await page.reload();
  await expect(nav.getByRole('button', { name: 'Réviser' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'Accueil' }).getByRole('region', { name: 'Mon planning ETF' })).toBeVisible();
  await choisirMission(page, 'asp');
  await expect(page.getByRole('button', { name: 'Mémo ASP' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Quiz :/ })).toBeVisible();
  // Logo déjà gardé (même version) : pas relu.
  expect(logos).toHaveLength(1);
});

test('administrateur d’ASP Rail : contenu d’une entreprise, lien d’invitation, nouvelle entreprise', async ({ page }) => {
  await fakeShare(page);
  await fakeAuth(page, 'admin@test.fr');
  const ents: Ent[] = [
    { id: 'e1', nom: 'Entreprise test', modules: { planning: true, memo: true, quiz: true }, logo_v: 0, admins: [], invitations: [] },
    { id: 'e2', nom: 'Exemple Rail', modules: { planning: false, memo: false, quiz: false }, logo_v: 0, admins: ['chef@exemple.fr'], invitations: [] },
  ];
  const appels = await fakeEntreprises(page, 'admin@test.fr', true, ents);
  await openApp(page, { gate: true, path: './#admin' });
  await page.getByRole('textbox', { name: 'E-mail' }).fill('admin@test.fr');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mon-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('(administrateur d’ASP Rail)')).toBeVisible();

  await page.getByRole('combobox', { name: 'Entreprise' }).selectOption({ label: 'Exemple Rail' });
  await page.getByRole('tab', { name: 'Entreprise' }).click();
  await expect(page.getByRole('textbox', { name: 'Nom de l’entreprise' })).toHaveValue('Exemple Rail');
  await expect(page.getByRole('region', { name: 'Agents actifs' })).toContainText('Équipe nuit');
  await shot(page, '43-admin-entreprise-haut');
  const memo = page.getByRole('switch', { name: /^Mémos/ });
  await expect(memo).not.toBeChecked();
  await memo.click();
  await expect.poll(() => appels.find((a) => a.f === 'maj')?.args).toEqual({ p_id: 'e2', p_modules: { planning: false, memo: true, quiz: false } });
  await expect(memo).toBeChecked();
  await expect(page.locator('.admin-msg')).toContainText('Mémos : activé pour Exemple Rail');

  // Invitation : un lien à envoyer, valable 7 jours.
  await page.getByLabel('Inviter un administrateur').fill('Adjoint@Exemple.fr');
  await page.getByRole('button', { name: 'Créer le lien' }).click();
  await expect.poll(() => appels.find((a) => a.f === 'inviter')?.args).toEqual({ p_entreprise: 'e2', p_email: 'adjoint@exemple.fr' });
  await expect(page.getByRole('list', { name: 'Invitations en attente' })).toContainText('adjoint@exemple.fr');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();
  const partage = await page.evaluate(() => (window as unknown as { __partages: ShareData[] }).__partages[0]);
  expect(partage.text).toContain('« Exemple Rail »');
  expect(partage.text).toContain(`/#admin&invitation=${JETON}`);
  await shot(page, '41-admin-entreprise');

  // Nouvelle entreprise : créée puis choisie en haut.
  await page.getByRole('textbox', { name: 'Nom de la nouvelle entreprise' }).fill('Nouvelle Voie');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect.poll(() => appels.find((a) => a.f === 'creer')?.args).toEqual({ p_nom: 'Nouvelle Voie' });
  await expect(page.getByRole('combobox', { name: 'Entreprise' })).toHaveValue('e3');
  await expect(page.locator('.admin-msg')).toContainText('sans mémo, quiz ni planning ETF');
});

test('administrateur d’une entreprise : sa seule entreprise, contenu réglé par ASP Rail, pas d’invitation', async ({ page }) => {
  await fakeAuth(page, 'chef@exemple.fr');
  const ents: Ent[] = [{ id: 'e2', nom: 'Exemple Rail', modules: { planning: false, memo: true, quiz: false }, logo_v: 0, admins: ['chef@exemple.fr'], invitations: [] }];
  const appels = await fakeEntreprises(page, 'chef@exemple.fr', false, ents);
  await openApp(page, { gate: true, path: './#admin' });
  await page.getByRole('textbox', { name: 'E-mail' }).fill('chef@exemple.fr');
  await page.getByLabel('Mot de passe', { exact: true }).fill('son-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('ASP Rail · Exemple Rail')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Entreprise' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Entreprise' }).click();
  await expect(page.getByRole('switch', { name: /^Mémos/ })).toBeChecked();
  await expect(page.getByRole('switch', { name: /^Mémos/ })).toBeDisabled();
  await expect(page.getByText('Réglé par l’administrateur d’ASP Rail.')).toBeVisible();
  await expect(page.getByLabel('Inviter un administrateur')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nom de la nouvelle entreprise' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Nom de l’entreprise' }).fill('Exemple Rail Sécurité');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect.poll(() => appels.find((a) => a.f === 'maj')?.args).toEqual({ p_id: 'e2', p_nom: 'Exemple Rail Sécurité' });
  await expect(page.getByText('ASP Rail · Exemple Rail Sécurité')).toBeVisible();
});

test('lien d’invitation : la personne choisit son mot de passe, puis arrive dans l’espace de son entreprise', async ({ page }) => {
  const connexions = await fakeAuth(page, 'chef@exemple.fr');
  await fakeEntreprises(page, 'chef@exemple.fr', false, [{ id: 'e2', nom: 'Exemple Rail', modules: { planning: false, memo: false, quiz: false }, logo_v: 0, admins: ['chef@exemple.fr'], invitations: [] }]);
  await page.route('**/rest/v1/rpc/asp_voir_invitation', (route) =>
    route.fulfill({ json: { ok: true, email: 'chef@exemple.fr', entreprise: 'Exemple Rail', mode: 'creer', expire_le: new Date(Date.now() + 86_400_000).toISOString() } }),
  );
  let envoi: Record<string, unknown> = {};
  await page.route('**/functions/v1/asp-invitation', async (route) => {
    envoi = json(route);
    await route.fulfill({ json: { ok: true, email: 'chef@exemple.fr', entreprise: 'Exemple Rail' } });
  });
  await openApp(page, { gate: true, path: `./#admin&invitation=${JETON}` });
  await expect(page.getByRole('heading', { name: 'Espace « Exemple Rail »' })).toBeVisible();
  await expect(page.getByText('Invitation pour chef@exemple.fr')).toBeVisible();
  await shot(page, '42-invitation');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mon-mot-de-passe');
  await page.getByLabel('Encore une fois').fill('mon-mot-de-pass');
  await page.getByRole('button', { name: 'Enregistrer mon mot de passe' }).click();
  await expect(page.getByRole('alert')).toContainText('pas pareils');
  expect(envoi).toEqual({});
  await page.getByLabel('Encore une fois').fill('mon-mot-de-passe');
  await page.getByRole('button', { name: 'Enregistrer mon mot de passe' }).click();
  await expect.poll(() => envoi).toEqual({ jeton: JETON, mot_de_passe: 'mon-mot-de-passe' });
  await expect(page.locator('.admin-msg')).toContainText('tu administres maintenant « Exemple Rail »');
  await expect(page.getByText('ASP Rail · Exemple Rail')).toBeVisible();
  expect(connexions).toHaveLength(1);
  expect(connexions[0]).toMatchObject({ email: 'chef@exemple.fr', password: 'mon-mot-de-passe' });
  expect(new URL(page.url()).hash).toBe('#admin');
});

test('lien d’invitation déjà utilisé : message clair et retour à la connexion', async ({ page }) => {
  await page.route('**/rest/v1/rpc/asp_voir_invitation', (route) => route.fulfill({ json: { ok: false, raison: 'utilise' } }));
  await openApp(page, { gate: true, path: `./#admin&invitation=${JETON}` });
  await expect(page.getByRole('alert')).toContainText('Ce lien a déjà servi');
  await page.getByRole('button', { name: 'Aller à la connexion' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});
