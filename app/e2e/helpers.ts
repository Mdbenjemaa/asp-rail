import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';

/** Lieusaint-Moissy, à côté des voies de la ligne 830 000 (Paris-Lyon à Marseille), PK ≈ 28+718. */
export const LIEUSAINT = { latitude: 48.64362, longitude: 2.56256 };

type Geo = { latitude: number; longitude: number };
interface LineDoc {
  troncons: { pkd: number; pkf: number; g?: number[] }[];
}

const lineCache = new Map<string, LineDoc>();
function lineDoc(code: string): LineDoc {
  let doc = lineCache.get(code);
  if (!doc) {
    doc = JSON.parse(readFileSync(new URL(`../public/data/lines/${code}.json`, import.meta.url), 'utf8')) as LineDoc;
    lineCache.set(code, doc);
  }
  return doc;
}

/** Point de la ligne à ce PK, lu dans la fiche de ligne livrée avec l'appli (même codage que src/lib/pk.ts). */
export function pointAtPk(code: string, pk: number): Geo {
  for (const t of lineDoc(code).troncons) {
    if (!t.g) continue;
    let x = 0;
    let y = 0;
    let p = 0;
    let prev: [number, number, number] | null = null;
    for (let i = 0; i + 2 < t.g.length; i += 3) {
      x += t.g[i];
      y += t.g[i + 1];
      p += t.g[i + 2];
      const cur: [number, number, number] = [x / 1e5, y / 1e5, p / 1000];
      if (prev && pk >= Math.min(prev[2], cur[2]) && pk <= Math.max(prev[2], cur[2]) && prev[2] !== cur[2]) {
        const f = (pk - prev[2]) / (cur[2] - prev[2]);
        return { longitude: prev[0] + (cur[0] - prev[0]) * f, latitude: prev[1] + (cur[1] - prev[1]) * f };
      }
      prev = cur;
    }
  }
  throw new Error(`PK ${pk} absent de la ligne ${code}`);
}

/** Emprise de la ligne : [ouest, sud, est, nord]. */
export function lineBounds(code: string): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const t of lineDoc(code).troncons) {
    let x = 0;
    let y = 0;
    for (let i = 0; t.g && i + 2 < t.g.length; i += 3) {
      x += t.g[i];
      y += t.g[i + 1];
      w = Math.min(w, x / 1e5);
      e = Math.max(e, x / 1e5);
      s = Math.min(s, y / 1e5);
      n = Math.max(n, y / 1e5);
    }
  }
  return [w, s, e, n];
}

type TestMap = import('maplibre-gl').Map;
/** Carte de l'appli (exposée seulement quand le navigateur est piloté par les tests). */
export async function mapReady(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __aspMap?: unknown }).__aspMap);
}

/** Montre ce point au centre de la carte (zoom 17), puis renvoie sa position à l'écran. */
export async function showPoint(page: Page, at: Geo): Promise<{ x: number; y: number }> {
  await mapReady(page);
  const pt = await page.evaluate(
    ([lon, lat]) =>
      new Promise<{ x: number; y: number }>((resolve) => {
        const m = (window as unknown as { __aspMap: TestMap }).__aspMap;
        m.jumpTo({ center: [lon, lat], zoom: 17 });
        m.once('idle', () => resolve(m.project([lon, lat])));
      }),
    [at.longitude, at.latitude],
  );
  const box = (await page.locator('.map').boundingBox())!;
  return { x: box.x + pt.x, y: box.y + pt.y };
}

/** Appui long (clic droit sur ordinateur) sur ce point de la carte : « me placer ici ». */
export async function placeAt(page: Page, at: Geo) {
  const pt = await showPoint(page, at);
  await page.mouse.click(pt.x, pt.y, { button: 'right' });
}

/** « 28+718 » → 28.718 */
export const pkValue = (text: string) => {
  const m = /(-?\d+)\+(\d{3})/.exec(text);
  if (!m) throw new Error(`PK illisible : ${text}`);
  const km = Number(m[1]);
  return km < 0 || m[1].startsWith('-') ? km - Number(m[2]) / 1000 : km + Number(m[2]) / 1000;
};

/** Erreurs attendues : réseau extérieur coupé pendant les tests (fonds de carte, Google…). */
// « Worker failed to load » : Safari le note quand la carte se ferme pendant son chargement (code coupé).
const EXPECTED = /Failed to load resource|net::ERR_|AJAXError|Failed to fetch|NetworkError|Worker failed to load/i;

export interface AppOptions {
  /** Premier lancement : l'avertissement s'affiche (sinon il est déjà accepté). */
  firstRun?: boolean;
  /** Position GPS simulée (null : GPS refusé). */
  gps?: Geo | null;
  /** Préférences déjà enregistrées sur le téléphone. */
  storage?: Record<string, unknown>;
  /** Sans code d'accès gardé : l'écran du code s'affiche. */
  gate?: boolean;
  /** Adresse ouverte (par défaut l'accueil), par exemple « ./#code=ABCD-EF23 ». */
  path?: string;
  /** Rester sur l'accueil (sinon on passe sur l'onglet Carte, pour les tests du repérage) : la mission de « asp-activite » est ouverte. */
  home?: boolean;
  /** Avec `home` : rester sur l'accueil général, sans ouvrir de mission. */
  general?: boolean;
}

type Mission = 'asp' | 'pn' | 'lam';
const CARTE_MISSION: Record<Mission, RegExp> = { asp: /^Annonce :/, pn: /^Agent PN :/, lam: /^AP LAM \/ S9 :/ };

/** Sur l'accueil général, touche la carte d'une mission. */
export async function choisirMission(page: Page, m: Mission) {
  await page.getByRole('main', { name: 'Accueil' }).getByRole('button', { name: CARTE_MISSION[m] }).click();
  await expect(page.getByRole('main', { name: /^Accueil : / })).toBeVisible();
}

/** Depuis l'accueil d'une mission, revient à l'accueil général et en choisit une autre. */
export async function changerMission(page: Page, m: Mission) {
  await page.getByRole('button', { name: 'Revenir à l’accueil (changer de mission)' }).click();
  await choisirMission(page, m);
}

/** Onglet « Carte » de la barre du bas. */
export async function toCarte(page: Page) {
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Carte' }).click();
}

/** Coupe tout ce qui sort de la machine : les tests ne dépendent pas d'Internet. */
async function offlineWorld(context: BrowserContext) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort('internetdisconnected'));
}

export async function openApp(page: Page, opts: AppOptions = {}) {
  const context = page.context();
  await offlineWorld(context);
  if (opts.gps !== null) {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ ...(opts.gps ?? LIEUSAINT), accuracy: 4 });
  }
  const storage: Record<string, unknown> = {
    'asp-install-plus-tard': Date.now(),
    'asp-theme': 'jour',
    ...(opts.firstRun ? {} : { 'asp-ack-v1': true }),
    // Code d'accès déjà vérifié sur ce téléphone (la revérification échoue sans réseau : l'appli reste ouverte).
    ...(opts.gate ? {} : { 'asp-acces': { code: 'TESTTEST', nom: 'Tests', verifie: Date.now() } }),
    ...opts.storage,
  };
  await page.addInitScript((s) => {
    // Une seule fois par onglet : un rechargement garde ce que l'appli a enregistré.
    if (sessionStorage.getItem('e2e-init')) return;
    sessionStorage.setItem('e2e-init', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, storage);
  await page.goto(opts.path ?? './');
  if (!opts.gate) await expect(page.locator('.map canvas')).toBeVisible();
  if (!opts.gate && !opts.firstRun && !opts.home) await toCarte(page);
  if (opts.home && !opts.general && !opts.gate && !opts.firstRun) await choisirMission(page, (opts.storage?.['asp-activite'] as Mission | undefined) ?? 'asp');
}

/** « Me repérer » puis « Utiliser cette position » dès la première mesure. */
export async function locate(page: Page) {
  await page.getByRole('button', { name: 'Me repérer' }).click();
  await page.getByRole('button', { name: 'Utiliser cette position' }).click();
  await expect(page.locator('.banner .banner-eyebrow')).toContainText('Ligne 830 000');
}

/** Capture d'écran pour relecture (seulement avec SHOTS=1). */
export async function shot(page: Page, name: string) {
  if (process.env.SHOTS) await page.screenshot({ path: `e2e-shots/${name}.png` });
}

/** « 28.2685 » → « 28+269 », comme dans l'appli. */
export const fmtPkTest = (km: number) => {
  const m = Math.round(km * 1000);
  const sign = m < 0 ? '-' : '';
  const a = Math.abs(m);
  return `${sign}${Math.floor(a / 1000)}+${String(a % 1000).padStart(3, '0')}`;
};

/** Partage du téléphone simulé : ce qui est partagé est gardé dans window.__partages. */
export async function fakeShare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __partages: ShareData[] };
    w.__partages = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        w.__partages.push(d);
      },
    });
  });
}

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // Safari : un chargement coupé par un rechargement de la page est signalé « due to access control checks ».
      page.on('pageerror', (e) => {
        if (!/due to access control checks/.test(e.message)) errors.push(`Erreur : ${e.message}`);
      });
      page.on('console', (m) => {
        if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push(`Console : ${m.text()}`);
      });
      await use(errors);
      expect(errors, 'erreurs dans la page').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Exporte en PDF depuis la feuille « Exporter en PDF » déjà ouverte : nom de l'agent, signature au doigt (souris),
 * puis partage. Rend le nom du fichier et son texte (pdftotext).
 */
export async function exporterPdf(
  page: Page,
  opts: { nom?: string; signer?: boolean; partage?: number; responsable?: string; signerResponsable?: boolean } = {},
) {
  const feuille = page.getByRole('dialog', { name: 'Exporter en PDF' });
  await expect(feuille).toBeVisible();
  if (opts.nom !== undefined) await feuille.getByLabel('Ton nom (agent)').fill(opts.nom);
  if (opts.responsable !== undefined) await feuille.getByLabel('Nom : responsable du chantier').fill(opts.responsable);
  const signer = async (n: number) => {
    const cadre = feuille.getByLabel('Cadre de signature').nth(n);
    await cadre.scrollIntoViewIfNeeded();
    // La feuille monte en glissant : on attend qu'elle soit à sa place avant de signer.
    let box = (await cadre.boundingBox())!;
    for (let k = 0; k < 20; k++) {
      await page.waitForTimeout(100);
      const b = (await cadre.boundingBox())!;
      if (Math.abs(b.y - box.y) < 0.5) break;
      box = b;
    }
    await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
    await page.mouse.down();
    for (const [dx, dy] of [
      [60, -30],
      [100, 20],
      [150, -25],
      [210, 15],
    ])
      await page.mouse.move(box.x + dx, box.y + box.height * 0.5 + dy, { steps: 4 });
    await page.mouse.up();
    await expect(feuille.getByRole('button', { name: 'Effacer' }).nth(n)).toBeVisible();
  };
  if (opts.signer) await signer(0);
  if (opts.signerResponsable) await signer(opts.signer ? 1 : 0);
  const bouton = feuille.getByRole('button', { name: 'Créer le PDF et partager' });
  await expect(bouton).toBeEnabled({ timeout: 15_000 });
  await bouton.click();
  await expect(feuille).toHaveCount(0);
  const f = await page.evaluate(async (i) => {
    const all = (window as unknown as { __partages: ShareData[] }).__partages.filter((x) => x.files?.length);
    const file = all[i ?? all.length - 1].files![0];
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return { name: file.name, type: file.type, b64: btoa(bin) };
  }, opts.partage);
  const dir = mkdtempSync(join(tmpdir(), 'asp-pdf-'));
  const chemin = join(dir, f.name);
  writeFileSync(chemin, Buffer.from(f.b64, 'base64'));
  const texte = execFileSync('pdftotext', ['-layout', chemin, '-'], { encoding: 'utf8' });
  // Images du PDF (sans les masques de transparence).
  const images = execFileSync('pdfimages', ['-list', chemin], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .slice(2)
    .filter((l) => l.trim().split(/\s+/)[2] === 'image').length;
  return { name: f.name, type: f.type, texte, plat: texte.replace(/\s+/g, ' '), images, chemin, taille: Buffer.from(f.b64, 'base64').length };
}
