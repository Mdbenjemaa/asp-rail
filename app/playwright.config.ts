import { existsSync } from 'node:fs';
import { defineConfig, webkit } from '@playwright/test';

/**
 * Tests dans un vrai navigateur (téléphone simulé) : ils ouvrent l'appli construite (dossier dist)
 * et passent sur chaque écran. Lancés par scripts/deploy_pages.sh avant chaque mise en ligne.
 *
 *   npm run build && npm run e2e
 *
 * Chrome : celui du système s'il existe (CHROME_PATH pour en choisir un autre), sinon celui de Playwright
 * (npx playwright install chromium). Safari (WebKit) aussi quand il est installé : npx playwright install webkit.
 */
// Les tests calculent « aujourd'hui » à l'heure de Paris, comme le navigateur simulé (timezoneId) : sinon, entre
// minuit à Paris et minuit UTC, le jour du test et celui de l'appli ne sont pas les mêmes.
process.env.TZ = 'Europe/Paris';
const base = process.env.BASE_PATH ?? '/';
const port = Number(process.env.E2E_PORT ?? 4180);
const webkitPret = (() => {
  try {
    return existsSync(webkit.executablePath());
  } catch {
    return false;
  }
})();
const chrome = process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 3,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Le service worker est coupé, sauf dans le test hors-ligne qui le remet.
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: chrome,
          // Carte WebGL sans carte graphique (serveurs, CI).
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        },
      },
    },
    // Safari (moteur WebKit, celui de l'iPhone), si installé (npx playwright install webkit). Les quelques tests
    // qui simulent des capteurs ou des gestes propres à Chrome sont sautés (test.skip, raison indiquée).
    ...(webkitPret ? [{ name: 'safari', use: { browserName: 'webkit' as const } }] : []),
  ],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}${base}`,
    env: { BASE_PATH: base },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
