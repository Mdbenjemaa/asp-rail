/**
 * Export PDF d'un journal ou d'une fiche : le nom de l'agent (gardé sur le téléphone), la signature au doigt
 * (gardée pour ce document), puis le PDF créé sur le téléphone et envoyé par le partage du téléphone.
 * Le PDF et la ligne sont préparés dès l'ouverture : au toucher, il ne reste qu'à assembler et partager.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/parts';
import type { InfoExport } from '../lib/pdfKit';
import { garderNomAgent, garderSignature, nomAgent, signatureDe } from '../lib/signature';
import { Modal } from '../components/Sheets';
import { useRetour } from '../lib/back';
import { partagerFichier, type Envoi } from './partage';
import { Champ } from './ui';

export type Constructeur = (info: InfoExport) => File;

const quand = (t: number) => `${new Date(t).toLocaleDateString('fr-FR')} à ${new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

export function FeuilleExportPdf(p: {
  /** Titre du partage (« Journal · PN 26 · ligne 830 000 »). */
  titre: string;
  /** Mission ou chantier : la signature y reste attachée. */
  docId: string;
  defautNom?: string;
  preparer: () => Promise<Constructeur>;
  onClose: () => void;
  onFini: (e: Envoi) => void;
}) {
  const [nom, setNom] = useState(() => nomAgent() || p.defautNom || '');
  const [gardee, setGardee] = useState(() => signatureDe(p.docId));
  const [trace, setTrace] = useState<string | null>(null);
  const [refaire, setRefaire] = useState(false);
  const [construire, setConstruire] = useState<Constructeur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const preparer = useRef(p.preparer);
  useRetour(true, p.onClose);

  useEffect(() => {
    let actif = true;
    preparer
      .current()
      .then((c) => actif && setConstruire(() => c))
      .catch((e: unknown) => actif && setErreur(e instanceof Error ? e.message : 'Préparation impossible.'));
    return () => {
      actif = false;
    };
  }, []);

  const pad = !gardee || refaire;
  const exporter = async () => {
    if (!construire) return;
    const t = Date.now();
    garderNomAgent(nom);
    let sig = gardee && !refaire ? gardee : null;
    if (pad && trace) {
      sig = { png: trace, t };
      garderSignature(p.docId, trace, t);
    }
    setEnvoi(true);
    try {
      // Assemblé et partagé dans le même toucher : le téléphone refuse un partage trop tardif.
      const file = construire({ agent: nom, signature: sig?.png ?? null, signeA: sig?.t ?? null, cree: new Date(t) });
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
        Le PDF se crée sur le téléphone, même sans réseau, avec la date et l’heure de création.
      </p>
      <div className="ds-fields">
        <Champ label="Ton nom (agent)" value={nom} placeholder="Prénom NOM" onChange={setNom} />
      </div>
      <span className="ds-label" style={{ marginTop: 14 }}>
        Ta signature (facultatif)
      </span>
      {pad ? (
        <PadSignature onChange={setTrace} />
      ) : (
        <div className="ds-sig-gardee">
          <img src={gardee!.png} alt="Ta signature" />
          <small>Signé le {quand(gardee!.t)}</small>
          <span>
            <button type="button" className="ds-btn text" onClick={() => setRefaire(true)}>
              Signer à nouveau
            </button>
            <button
              type="button"
              className="ds-btn text"
              onClick={() => {
                garderSignature(p.docId, null, Date.now());
                setGardee(null);
              }}
            >
              Retirer
            </button>
          </span>
        </div>
      )}
      {erreur && <p className="ds-hint error">{erreur}</p>}
      <button className="ds-btn primary big wide" style={{ marginTop: 16 }} disabled={!construire || envoi} onClick={() => void exporter()}>
        <Icon name="file" size={22} />
        {!construire && !erreur ? 'Préparation du PDF…' : envoi ? 'Envoi…' : 'Créer le PDF et partager'}
      </button>
    </Modal>
  );
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
          onChange(ref.current?.toDataURL('image/png') ?? null);
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
