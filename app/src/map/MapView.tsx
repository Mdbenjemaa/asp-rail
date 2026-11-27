import { useEffect, useRef } from 'react';
import {
  addProtocol,
  Map as MapLibreMap,
  ScaleControl,
  AttributionControl,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type VectorTileSource,
} from 'maplibre-gl';
// MapLibre 6 cherche son worker à côté de son propre fichier : une fois l'appli compilée, on lui donne l'adresse du worker empaqueté par Vite.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PMTiles, Protocol } from 'pmtiles';
import { ChunkedSource, DATA_URL, PMTILES_URL, RailTilesSource } from '../lib/data';
import { angleDiff, setMapBearing, subscribeHeading } from '../lib/heading';
import { PREVIEW } from '../lib/env';
import type { LonLat } from '../lib/geo';
import { FILTERS, type Filters } from '../lib/layers';
import { buildStyle, glyphProtocol, INTERACTIVE_LAYERS, type Basemap, type Overlays } from './style';

setWorkerUrl(workerUrl);

// Protocole PMTiles global, avec une source qui garde les morceaux déjà vus (carte des voies sans réseau).
const protocol = new Protocol();
addProtocol('pmtiles', protocol.tile);
const railSource = PREVIEW ? new ChunkedSource(`${DATA_URL}rail/`) : new RailTilesSource(PMTILES_URL);
if (PREVIEW) addProtocol('glyph', glyphProtocol);
protocol.add(new PMTiles(railSource));

/**
 * Après une coupure de réseau, la bibliothèque PMTiles garde ses échecs en mémoire : on repart d'une
 * lecture neuve du fichier et la carte redemande ses tuiles des voies.
 */
function retryRail(m: MapLibreMap) {
  protocol.add(new PMTiles(railSource));
  const src = m.getSource('rail') as VectorTileSource | undefined;
  src?.setUrl(`pmtiles://${PMTILES_URL}`);
}

function setSource(m: MapLibreMap | null, id: string, data: FeatureCollection | null) {
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
  const apply = () => (m?.getSource(id) as GeoJSONSource | undefined)?.setData(data ?? empty);
  if (!m) return;
  if (m.getSource(id)) apply();
  else m.once('styledata', apply);
}

export interface FocusRequest {
  center: LonLat;
  zoom?: number;
  /** Zone à montrer en entier (une ligne), à la place du centre. */
  bounds?: [LonLat, LonLat];
  seq: number;
}

interface Props {
  basemap: Basemap;
  /** Mode nuit : fond et couleurs sombres. */
  night: boolean;
  filters: Filters;
  me: FeatureCollection | null;
  target: FeatureCollection | null;
  acces: FeatureCollection | null;
  /** Mes signalements (points colorés selon la gravité). */
  signal?: FeatureCollection | null;
  /** Chantier de l'ASP affiché sur la carte. */
  asp?: FeatureCollection | null;
  focus: FocusRequest | null;
  /** Suivi : position à garder visible (la carte ne bouge que si le point va sortir de l'écran). */
  keepInView?: LonLat | null;
  /** L'utilisateur a déplacé ou zoomé la carte lui-même. */
  onUserMove?: () => void;
  /** La carte tourne dans la direction du téléphone (sinon nord en haut). */
  orient?: boolean;
  /** Change à chaque demande de « nord en haut » (bouton boussole après une rotation à deux doigts). */
  northSeq?: number;
  /** L'utilisateur a tourné la carte avec deux doigts. */
  onUserRotate?: () => void;
  onFeature: (f: MapGeoJSONFeature, at: LonLat) => void;
  onLongPress: (at: LonLat) => void;
  onMapTap: () => void;
  /**
   * Agent du chantier déplacé à la main (appui long dessus, puis glisser) : rend la position posée sur la voie
   * (ou null pour ne pas bouger). « fin » : le doigt est relâché.
   */
  onAgentDrag?: (id: string, at: LonLat, phase: 'debut' | 'move' | 'fin' | 'annule') => LonLat | null;
  /** Agent à placer (« Déplacer A1 » dans sa fiche) : le prochain toucher ou glisser sur la carte le pose, sans appui long. */
  placerAgent?: string | null;
}

/** Temps d'appui sur un agent avant de pouvoir le déplacer (plus court que « me placer ici »). */
const APPUI_AGENT_MS = 400;

/**
 * Marges de la zone de carte vraiment visible : le bandeau du PK en haut, la fiche et la barre d'actions
 * en bas (téléphone), ou la colonne de gauche (ordinateur).
 */
function viewPadding(m: MapLibreMap) {
  const el = m.getContainer();
  const box = el.getBoundingClientRect();
  if (el.clientWidth >= 900) return { top: 20, bottom: 20, left: 460, right: 20 };
  const banner = document.querySelector('.top-zone .banner')?.getBoundingClientRect();
  const bottom = document.querySelector('.bottom-zone')?.getBoundingClientRect();
  return {
    top: Math.max(60, Math.round((banner ? banner.bottom : box.top) - box.top + 16)),
    bottom: Math.max(20, Math.round(box.bottom - (bottom ? bottom.top : box.bottom) + 16)),
    left: 0,
    right: 0,
  };
}

/** Faisceau de direction : un cône bleu qui s'estompe, pointe en bas (posée sur le point GPS). */
function beamImage(): ImageData {
  const w = 120;
  const h = 150;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const spread = (32 * Math.PI) / 180;
  const grad = g.createRadialGradient(w / 2, h, 0, w / 2, h, h);
  grad.addColorStop(0, 'rgba(37, 99, 235, 0.55)');
  grad.addColorStop(0.7, 'rgba(37, 99, 235, 0.18)');
  grad.addColorStop(1, 'rgba(37, 99, 235, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w / 2, h);
  g.arc(w / 2, h, h, -Math.PI / 2 - spread, -Math.PI / 2 + spread);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, w, h);
}

/** Le bandeau et la fiche du bas cachent une partie de la carte : on centre dans la zone libre. */
function goTo(m: MapLibreMap, f: FocusRequest, animate: boolean) {
  const padding = viewPadding(m);
  if (f.bounds) {
    // absolutePadding : notre marge remplace celle de la carte (sinon elles s'ajoutent et la ligne ne tient plus).
    m.fitBounds(f.bounds as LngLatBoundsLike, { padding, absolutePadding: true, maxZoom: 15, duration: animate ? 1200 : 0 });
    return;
  }
  const zoom = f.zoom ?? Math.max(m.getZoom(), 16);
  if (animate) m.flyTo({ center: f.center, zoom, duration: 1200, padding });
  else m.jumpTo({ center: f.center, zoom, padding });
}

export function MapView({
  basemap, night, filters, me, target, acces, signal = null, asp = null, focus, keepInView, onUserMove, onFeature, onLongPress, onMapTap, onAgentDrag, placerAgent = null,
  orient = false, northSeq = 0, onUserRotate,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const latest = useRef({ night, filters, me, target, acces, signal, asp, focus, onFeature, onLongPress, onMapTap, onUserMove, orient, onUserRotate, onAgentDrag, placerAgent });
  latest.current = { night, filters, me, target, acces, signal, asp, focus, onFeature, onLongPress, onMapTap, onUserMove, orient, onUserRotate, onAgentDrag, placerAgent };
  const heading = useRef<number | null>(null);
  const waitingMove = useRef(false);
  /** Mode « direction » quitté par une rotation à deux doigts : la carte reste comme l'agent l'a mise. */
  const keepBearing = useRef(false);

  /** Faisceau tourné selon la direction du téléphone ; carte tournée aussi si demandé. */
  const applyHeading = (m: MapLibreMap | null) => {
    if (!m || !m.getLayer('me-beam')) return;
    const h = heading.current;
    m.setLayoutProperty('me-beam', 'visibility', h === null ? 'none' : 'visible');
    if (h !== null) m.setLayoutProperty('me-beam', 'icon-rotate', Math.round(h));
    if (!latest.current.orient || h === null || Math.abs(angleDiff(m.getBearing(), h)) < 3) return;
    if (!m.isMoving()) m.rotateTo(h, { duration: 250 });
    else if (!waitingMove.current) {
      // Carte en mouvement (recentrage) : on tourne dès qu'elle s'arrête.
      waitingMove.current = true;
      m.once('moveend', () => {
        waitingMove.current = false;
        applyHeading(m);
      });
    }
  };
  const appliedFocus = useRef(0);
  /** Un même recentrage n'est fait qu'une fois (demande arrivée avant ou après le chargement de la carte). */
  const applyFocus = (m: MapLibreMap, f: FocusRequest, animate: boolean) => {
    if (f.seq === appliedFocus.current) return;
    appliedFocus.current = f.seq;
    goTo(m, f, animate);
  };
  const overlays = (): Overlays => ({
    me: latest.current.me,
    target: latest.current.target,
    acces: latest.current.acces,
    signal: latest.current.signal,
    asp: latest.current.asp,
  });
  const syncOverlays = (m: MapLibreMap) => {
    const o = overlays();
    setSource(m, 'me', o.me);
    setSource(m, 'target', o.target);
    setSource(m, 'acces', o.acces);
    setSource(m, 'signal', o.signal);
    setSource(m, 'asp', o.asp);
    applyHeading(m);
  };

  // Création de la carte.
  useEffect(() => {
    let cancelled = false;
    let m: MapLibreMap | null = null;
    (async () => {
      const style = await buildStyle(basemap, latest.current.filters, overlays(), latest.current.night);
      if (cancelled || !container.current) return;
      const created = new MapLibreMap({
        container: container.current,
        style,
        bounds: [[-5.2, 41.3], [9.6, 51.2]],
        fitBoundsOptions: { padding: 20 },
        // Crédits (« i ») ajoutés plus bas, à gauche au-dessus de l'échelle : la colonne de droite reste aux boutons.
        attributionControl: false,
        maxPitch: 0,
        dragRotate: false,
      });
      m = created;
      // Tests automatiques (navigateur piloté) : accès à la carte pour viser un point précis.
      if (navigator.webdriver) (window as Window & { __aspMap?: MapLibreMap }).__aspMap = created;
      // Rotation à deux doigts permise (le bouton boussole remet le nord en haut). Pas au clic droit :
      // sur ordinateur, il sert à « me placer ici ».
      created.on('rotate', () => setMapBearing(created.getBearing()));
      created.on('rotatestart', (e: { originalEvent?: Event }) => {
        if (!e.originalEvent) return;
        if (latest.current.orient) keepBearing.current = true;
        latest.current.onUserRotate?.();
      });
      created.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
      created.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      map.current = created;
      // Le style a été préparé avant la création : on y remet les points arrivés entre-temps.
      created.once('load', () => {
        syncOverlays(created);
        // Recentrage demandé pendant que la carte se préparait.
        const f = latest.current.focus;
        if (f) applyFocus(created, f, false);
        // Les crédits s'ouvrent au démarrage : on les replie vite (bouton « i ») pour libérer la carte.
        setTimeout(() => {
          const attrib = container.current?.querySelector('.maplibregl-ctrl-attrib');
          attrib?.classList.remove('maplibregl-compact-show');
          attrib?.removeAttribute('open');
        }, 3000);
      });

      // Déplacer un agent du chantier : appui long dessus (il se « soulève »), glisser le long de la voie, relâcher.
      let glisse: { id: string; fc: FeatureCollection; at: LonLat } | null = null;
      let appuiAgent: ReturnType<typeof setTimeout> | null = null;
      let departAgent: { x: number; y: number } | null = null;
      let sansClic = 0;
      // L'agent sous le doigt : son rond ou son nom (A1…), le plus proche si plusieurs (un doigt est large).
      const agentSous = (pt: { x: number; y: number }): string | null => {
        if (!latest.current.onAgentDrag || !created.getLayer('u-asp-agent')) return null;
        const couches = ['u-asp-agent', 'u-asp-agent-label'].filter((l) => created.getLayer(l));
        const fs = created.queryRenderedFeatures(
          [
            [pt.x - 26, pt.y - 26],
            [pt.x + 26, pt.y + 26],
          ],
          { layers: couches },
        );
        let best: { id: string; d: number } | null = null;
        for (const f of fs) {
          const id = f.properties?.aid;
          if (typeof id !== 'string' || f.geometry.type !== 'Point') continue;
          const q = created.project(f.geometry.coordinates as [number, number]);
          const d = Math.hypot(q.x - pt.x, q.y - pt.y);
          if (!best || d < best.d) best = { id, d };
        }
        return best?.id ?? null;
      };
      const poser = (id: string, at: LonLat) => {
        if (!glisse) return;
        glisse.fc = {
          ...glisse.fc,
          features: glisse.fc.features.map((f) => (f.properties?.aid === id && f.geometry.type === 'Point' ? { ...f, geometry: { type: 'Point', coordinates: at } } : f)),
        };
        setSource(created, 'asp', glisse.fc);
      };
      const annulerAppuiAgent = () => {
        if (appuiAgent) clearTimeout(appuiAgent);
        appuiAgent = null;
      };
      /** Appui qui commence : sur un agent, on prépare le déplacement. Rend vrai si c'est un agent. */
      const prendre = (id: string, at: LonLat) => {
        const fc = latest.current.asp;
        if (!fc) return;
        glisse = { id, fc, at };
        created.dragPan.disable();
        created.getCanvas().style.cursor = 'grabbing';
        const p = latest.current.onAgentDrag?.(id, at, 'debut');
        if (p) poser(id, p);
      };
      const appuiDebut = (pt: { x: number; y: number }, at: LonLat): boolean => {
        annulerAppuiAgent();
        // « Déplacer A1 » choisi dans sa fiche : il vient tout de suite sous le doigt.
        const aPlacer = latest.current.placerAgent;
        if (aPlacer) {
          prendre(aPlacer, at);
          return true;
        }
        const id = agentSous(pt);
        if (!id) return false;
        departAgent = pt;
        appuiAgent = setTimeout(() => {
          appuiAgent = null;
          try {
            navigator.vibrate?.(25);
          } catch {
            /* pas de vibreur (iPhone) */
          }
          prendre(id, at);
        }, APPUI_AGENT_MS);
        return true;
      };
      const appuiBouge = (pt: { x: number; y: number }, at: LonLat, ev?: Event) => {
        if (glisse) {
          ev?.preventDefault();
          glisse.at = at;
          const p = latest.current.onAgentDrag?.(glisse.id, at, 'move');
          if (p) poser(glisse.id, p);
          return;
        }
        if (departAgent && Math.hypot(pt.x - departAgent.x, pt.y - departAgent.y) > 10) annulerAppuiAgent();
      };
      // Deux doigts pendant qu'on tient un agent (zoomer pour trouver où le poser) : il revient à sa place.
      const lacher = () => {
        annulerAppuiAgent();
        departAgent = null;
        if (!glisse) return;
        const { id, at } = glisse;
        glisse = null;
        if (latest.current.asp) setSource(created, 'asp', latest.current.asp);
        created.dragPan.enable();
        created.getCanvas().style.cursor = '';
        latest.current.onAgentDrag?.(id, at, 'annule');
      };
      // Fin de l'appui : l'agent est posé là où le doigt était en dernier (le « touchend » n'a plus de position).
      const appuiFin = () => {
        annulerAppuiAgent();
        departAgent = null;
        if (!glisse) return;
        const { id, at } = glisse;
        glisse = null;
        created.dragPan.enable();
        created.getCanvas().style.cursor = '';
        sansClic = Date.now() + 500; // le relâcher n'ouvre pas la fiche de l'agent
        latest.current.onAgentDrag?.(id, at, 'fin');
      };
      created.on('mousedown', (e) => {
        if (e.originalEvent.button === 0) appuiDebut(e.point, [e.lngLat.lng, e.lngLat.lat]);
      });
      created.on('mousemove', (e) => appuiBouge(e.point, [e.lngLat.lng, e.lngLat.lat], e.originalEvent));
      created.on('mouseup', () => appuiFin());
      // Bouton relâché hors de la carte (sur une fiche par-dessus) : on pose quand même l'agent.
      window.addEventListener('mouseup', () => appuiFin());

      created.on('click', (e) => {
        if (Date.now() < sansClic) return;
        const { x, y } = e.point;
        const box: [[number, number], [number, number]] = [[x - 12, y - 12], [x + 12, y + 12]];
        const layers = INTERACTIVE_LAYERS.filter((id) => created.getLayer(id));
        const hits = created.queryRenderedFeatures(box, { layers });
        if (hits.length) latest.current.onFeature(hits[0], [e.lngLat.lng, e.lngLat.lat]);
        else latest.current.onMapTap();
      });

      // Appui long (iPhone : pas d'événement « contextmenu ») → « me placer ici ».
      let timer: ReturnType<typeof setTimeout> | null = null;
      let startPt: { x: number; y: number } | null = null;
      const cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
      };
      created.on('touchstart', (e) => {
        if (e.points.length !== 1) {
          lacher();
          return cancel();
        }
        startPt = e.point;
        const at: LonLat = [e.lngLat.lng, e.lngLat.lat];
        cancel();
        // Sur un agent du chantier : l'appui long le déplace (pas de « me placer ici »).
        if (appuiDebut(e.point, at)) return;
        timer = setTimeout(() => latest.current.onLongPress(at), 650);
      });
      created.on('touchmove', (e) => {
        appuiBouge(e.point, [e.lngLat.lng, e.lngLat.lat], e.originalEvent);
        if (startPt && Math.hypot(e.point.x - startPt.x, e.point.y - startPt.y) > 10) cancel();
      });
      created.on('touchend', () => {
        cancel();
        appuiFin();
      });
      created.on('touchcancel', () => {
        cancel();
        appuiFin();
      });
      created.on('movestart', (e) => {
        if ((e as { originalEvent?: Event }).originalEvent) cancel();
      });
      // Geste de l'utilisateur (glisser, pincer, molette) : la carte devient libre pendant le suivi.
      const userGesture = (e: { originalEvent?: Event }) => {
        if (e.originalEvent) latest.current.onUserMove?.();
      };
      created.on('dragstart', userGesture);
      created.on('zoomstart', userGesture);
      // Clic droit, ou appui long sur Android (qui envoie aussi « contextmenu ») : pas sur un agent qu'on déplace.
      created.on('contextmenu', (e) => {
        if (glisse || appuiAgent || agentSous(e.point)) {
          e.preventDefault();
          return;
        }
        latest.current.onLongPress([e.lngLat.lng, e.lngLat.lat]);
      });
      // Image du faisceau de direction, dessinée à la demande (aussi après un changement de fond).
      created.on('styleimagemissing', (e: { id: string }) => {
        if (e.id === 'asp-faisceau' && !created.hasImage('asp-faisceau')) created.addImage('asp-faisceau', beamImage(), { pixelRatio: 2 });
      });

      // Tuiles indisponibles (pas de réseau) : pas d'alerte, mais on réessaie quand le réseau revient.
      let railFailed = false;
      const warned = new Set<string>();
      created.on('error', (ev) => {
        const e = ev as unknown as { error?: Error; sourceId?: string };
        if (e.sourceId === 'rail') railFailed = true;
        const msg = e.error?.message ?? 'erreur de carte';
        if (!warned.has(msg)) {
          warned.add(msg);
          console.warn('Carte :', msg);
        }
      });
      const retry = () => {
        if (!railFailed || document.visibilityState !== 'visible' || navigator.onLine === false) return;
        railFailed = false;
        retryRail(created);
      };
      window.addEventListener('online', retry);
      document.addEventListener('visibilitychange', retry);
      const retryTimer = setInterval(retry, 30_000);
      created.once('remove', () => {
        window.removeEventListener('online', retry);
        document.removeEventListener('visibilitychange', retry);
        clearInterval(retryTimer);
      });
    })();
    return () => {
      cancelled = true;
      m?.remove();
      map.current = null;
    };
    // La carte n'est créée qu'une fois ; le fond change via setStyle ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement de fond de carte, ou passage jour / nuit.
  const firstBasemap = useRef(true);
  useEffect(() => {
    if (firstBasemap.current) {
      firstBasemap.current = false;
      return;
    }
    let cancelled = false;
    buildStyle(basemap, latest.current.filters, overlays(), night).then((style) => {
      const m = map.current;
      if (cancelled || !m) return;
      m.setStyle(style);
      m.once('styledata', () => syncOverlays(m));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, night]);

  // Filtres → visibilité des couches.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      for (const f of FILTERS) {
        for (const id of f.layers) {
          if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', filters[f.key] ? 'visible' : 'none');
        }
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once('styledata', apply);
  }, [filters]);

  // Position de l'utilisateur, destination, accès importés.
  useEffect(() => setSource(map.current, 'me', me), [me]);

  // Direction du téléphone (boussole ou GPS).
  useEffect(
    () =>
      subscribeHeading((h) => {
        heading.current = h;
        applyHeading(map.current);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Bouton boussole après une rotation à deux doigts : nord en haut.
  useEffect(() => {
    if (northSeq && map.current) map.current.rotateTo(0, { duration: 400 });
  }, [northSeq]);
  // Bouton boussole : la carte suit la direction, ou revient le nord en haut.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (orient) {
      keepBearing.current = false;
      applyHeading(m);
    } else if (keepBearing.current) keepBearing.current = false;
    else if (Math.abs(m.getBearing()) > 0.5) m.rotateTo(0, { duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orient]);
  useEffect(() => setSource(map.current, 'target', target), [target]);
  useEffect(() => setSource(map.current, 'acces', acces), [acces]);
  useEffect(() => setSource(map.current, 'signal', signal), [signal]);
  useEffect(() => setSource(map.current, 'asp', asp), [asp]);

  // Recentrage demandé (si la carte n'est pas encore prête, il se fera à son chargement).
  useEffect(() => {
    if (focus && map.current) applyFocus(map.current, focus, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Suivi : la carte reste où elle est tant que le point est bien visible, sinon elle le ramène au centre.
  useEffect(() => {
    const m = map.current;
    if (!m || !keepInView) return;
    const pad = viewPadding(m);
    const el = m.getContainer();
    const pt = m.project(keepInView);
    const margin = 40;
    const inside =
      pt.x >= pad.left + margin &&
      pt.x <= el.clientWidth - pad.right - margin &&
      pt.y >= pad.top + margin &&
      pt.y <= el.clientHeight - pad.bottom - margin;
    if (!inside) m.easeTo({ center: keepInView, padding: pad, duration: 700 });
  }, [keepInView]);

  return <div ref={container} className="map" />;
}
