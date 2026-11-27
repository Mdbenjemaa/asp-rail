/**
 * Export PDF d'un journal ou d'une fiche : le nom de l'agent (gardé sur le téléphone), la signature au doigt
 * (gardée pour ce document), puis le PDF créé sur le téléphone et envoyé par le partage du téléphone.
 * Le PDF et la ligne sont préparés dès l'ouverture : au toucher, il ne reste qu'à assembler et partager.
 */
import { useEffect, useRef, useState } from 'react';
import policeUrl from '../assets/fonts/DejaVuSans.ttf?url';
import { Icon } from '../components/parts';
import { entreprisePdf } from '../access/entreprise';
import type { InfoExport } from '../lib/pdfKit';
import { garderNomAgent, garderSignature, nomAgent, signatureDe } from '../lib/signature';
import { Modal } from '../components/Sheets';
import { useRetour } from '../lib/back';
import { partagerFichier, type Envoi } from './partage';
import { Champ } from './ui';

export type Constructeur = (info: InfoExport) => File;

/** Police Unicode des PDF (arabe, polonais, grec…), lue une fois depuis l'appli gardée sur le téléphone. */
let police: Promise<string | null> | null = null;
function chargerPolice(): Promise<string | null> {
  police ??= fetch(policeUrl)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((buf) => {
      const octets = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000));
      return btoa(bin);
    })
    .catch(() => {
      police = null; // sans police : les caractères latins courants seulement, on réessaiera
      return null;
    });
  return police;
}

const quand = (t: number) => `${new Date(t).toLocaleDateString('fr-FR')} à ${new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

/** « Responsable du chantier » → « responsable du chantier » ; « ASP » reste « ASP ». */
const minuscule = (t: string) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/** Signature retenue pour l'export : celle déjà gardée, ou un nouveau trait (gardé au moment de l'export). */
interface SigChoisie {
  png: string;
  t: number;
  nouveau: boolean;
}
const dejaGardee = (cle: string): SigChoisie | null => {
  const s = signatureDe(cle);
  return s ? { ...s, nouveau: false } : null;
};
/** Garde un nouveau trait sous sa clé, avec l'heure de l'export. */
function fixer(s: SigChoisie | null, cle: string, t: number): { png: string; t: number } | null {
  if (!s) return null;
  if (!s.nouveau) return s;
  garderSignature(cle, s.png, t);
  return { png: s.png, t };
}

/** Cadre de signature : celle déjà donnée pour ce document (refaire, retirer), sinon un cadre où signer. */
function BlocSignature(p: { titre: string; cle: string; onChange: (s: SigChoisie | null) => void }) {
  const [gardee, setGardee] = useState(() => signatureDe(p.cle));
  const [refaire, setRefaire] = useState(false);
  return (
    <>
      <span className="ds-label" style={{ marginTop: 14 }}>
        {p.titre}
      </span>
      {!gardee || refaire ? (
        <PadSignature onChange={(png) => p.onChange(png ? { png, t: Date.now(), nouveau: true } : null)} />
      ) : (
        <div className="ds-sig-gardee">
          <img src={gardee.png} alt={p.titre} />
          <small>Signé le {quand(gardee.t)}</small>
          <span>
            <button
              type="button"
              className="ds-btn text"
              onClick={() => {
                setRefaire(true);
                p.onChange(null);
              }}
            >
              Signer à nouveau
            </button>
            <button
              type="button"
              className="ds-btn text"
              onClick={() => {
                garderSignature(p.cle, null, Date.now());
                setGardee(null);
                p.onChange(null);
              }}
            >
              Retirer
            </button>
          </span>
        </div>
      )}
    </>
  );
}

export function FeuilleExportPdf(p: {
  /** Titre du partage (« Journal · PN 26 · ligne 830 000 »). */
  titre: string;
  /** Mission ou chantier : la signature y reste attachée. */
  docId: string;
  defautNom?: string;
  preparer: () => Promise<Constructeur>;
  onClose: () => void;
  onFini: (e: Envoi) => void;
  /** Deuxième signature (responsable du chantier) : son nom et sa signature au doigt, gardée pour ce document. */
  second?: { titre: string; defautNom: string };
  /** Texte d'aide au-dessus du formulaire. */
  intro?: string;
}) {
  const [nom, setNom] = useState(() => nomAgent() || p.defautNom || '');
  const [sig, setSig] = useState(() => dejaGardee(p.docId));
  const cle2 = `${p.docId}:second`;
  const [nom2, setNom2] = useState(p.second?.defautNom ?? '');
  const [sig2, setSig2] = useState(() => (p.second ? dejaGardee(cle2) : null));
  const [construire, setConstruire] = useState<Constructeur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const preparer = useRef(p.preparer);
  useRetour(true, p.onClose);

  useEffect(() => {
    let actif = true;
    Promise.all([preparer.current(), chargerPolice()])
      .then(([c, pol]) => actif && setConstruire(() => (info: InfoExport) => c({ ...info, police: pol })))
      .catch((e: unknown) => actif && setErreur(e instanceof Error ? e.message : 'Préparation impossible.'));
    return () => {
      actif = false;
    };
  }, []);

  const exporter = async () => {
    if (!construire) return;
    const t = Date.now();
    garderNomAgent(nom);
    const s1 = fixer(sig, p.docId, t);
    const s2 = p.second ? fixer(sig2, cle2, t) : null;
    setEnvoi(true);
    try {
      // Assemblé et partagé dans le même toucher : le téléphone refuse un partage trop tardif.
      const file = construire({
        agent: nom,
        signature: s1?.png ?? null,
        signeA: s1?.t ?? null,
        cree: new Date(t),
        entreprise: entreprisePdf(),
        second: p.second ? { nom: nom2.trim(), signature: s2?.png ?? null, signeA: s2?.t ?? null } : undefined,
      });
      p.onFini(await partagerFichier(file, p.titre));
    } catch (e) {
      setErreur(e instanceof Error ? `PDF impossible : ${e.message}` : 'PDF impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal title="Exporter en PDF" onClose={p.onClose}>
      <p className="ds-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        {p.intro ?? 'Le PDF se crée sur le téléphone, même sans réseau, avec la date et l’heure de création.'}
      </p>
      <div className="ds-fields">
        <Champ label="Ton nom (agent)" value={nom} placeholder="Prénom NOM" onChange={setNom} />
      </div>
      <BlocSignature titre="Ta signature (facultatif)" cle={p.docId} onChange={setSig} />
      {p.second && (
        <>
          <div className="ds-fields" style={{ marginTop: 16 }}>
            <Champ label={`Nom : ${minuscule(p.second.titre)}`} value={nom2} placeholder="Prénom NOM" onChange={setNom2} />
          </div>
          <BlocSignature titre={`Signature : ${minuscule(p.second.titre)} (facultatif)`} cle={cle2} onChange={setSig2} />
        </>
      )}
      {erreur && <p className="ds-hint error">{erreur}</p>}
      <button className="ds-btn primary big wide" style={{ marginTop: 16 }} disabled={!construire || envoi} onClick={() => void exporter()}>
        <Icon name="file" size={22} />
        {!construire && !erreur ? 'Préparation du PDF…' : envoi ? 'Envoi…' : 'Créer le PDF et partager'}
      </button>
    </Modal>
  );
}

/** Image PNG du cadre, réduite à 500 px de large : assez net à l'impression, léger dans le PDF. */
function versPng(c: HTMLCanvasElement): string {
  const k = Math.min(1, 500 / c.width);
  if (k === 1) return c.toDataURL('image/png');
  const o = document.createElement('canvas');
  o.width = Math.round(c.width * k);
  o.height = Math.round(c.height * k);
  o.getContext('2d')?.drawImage(c, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}

/** Cadre où signer au doigt (ou à la souris). Rend l'image PNG du trait, ou null si le cadre est vide. */
function PadSignature({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dessin = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#10131a';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const g = () => ref.current?.getContext('2d') ?? null;

  return (
    <div className="ds-sig">
      <canvas
        ref={ref}
        aria-label="Cadre de signature"
        onPointerDown={(e) => {
          const ctx = g();
          if (!ctx) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dessin.current = true;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.1, y + 0.1);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          const ctx = g();
          if (!dessin.current || !ctx) return;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (!dessin.current) return;
          dessin.current = false;
          setVide(false);
          onChange(ref.current ? versPng(ref.current) : null);
        }}
        onPointerCancel={() => {
          dessin.current = false;
        }}
      />
      {vide && <span className="ds-sig-aide">Signe ici avec le doigt</span>}
      {!vide && (
        <button
          type="button"
          className="ds-btn text ds-sig-effacer"
          onClick={() => {
            const c = ref.current;
            c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
            setVide(true);
            onChange(null);
          }}
        >
          Effacer
        </button>
      )}
    </div>
  );
}
