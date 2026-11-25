/**
 * Mise à jour de l'appli. Le service worker installe la nouvelle version dès qu'elle est publiée ;
 * il reste à recharger la page. On ne le fait jamais pendant un suivi du PK ou un repérage en cours :
 * seulement quand l'appli est au repos, ou quand on la quitte sans saisie en cours (elle est à jour au retour).
 */
let pending = false;
let busy = false;
let idle = true;
let reload: () => void = () => location.reload();

/** Une feuille est ouverte (dépêche, note, export…) : ce qu'on y tape n'est pas encore enregistré. */
let feuilleOuverte = () => typeof document !== 'undefined' && !!document.querySelector('.modal-back');
function maybeReload(hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden') {
  // Appli mise de côté (appel, autre appli) : on recharge seulement si aucune saisie en cours ne serait perdue.
  if (pending && !busy && (idle || (hidden && !feuilleOuverte()))) {
    pending = false;
    reload();
  }
}

/** Le service worker a installé une nouvelle version. */
export function updateReady(): void {
  pending = true;
  maybeReload();
}

/**
 * État de l'appli : `busy` (suivi, repérage, import en cours) interdit le rechargement ;
 * `idle` (rien d'affiché à perdre) l'autorise tout de suite.
 */
export function setUpdateGate(state: { busy: boolean; idle: boolean }): void {
  busy = state.busy;
  idle = state.idle;
  maybeReload();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => maybeReload());
}

/** Pour les tests. */
export function _setReloadForTests(fn: () => void, state = { pending: false, busy: false, idle: true }, feuille = false): void {
  reload = fn;
  feuilleOuverte = () => feuille;
  ({ pending, busy, idle } = state);
}

export function _checkForTests(hidden: boolean): void {
  maybeReload(hidden);
}
