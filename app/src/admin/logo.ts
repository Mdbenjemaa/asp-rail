/** Logo d'entreprise : l'image choisie est réduite sur le téléphone (256 px au plus), en PNG, ou en JPEG si trop lourde. */

/** Taille maximale acceptée par le serveur (data URL). */
export const LOGO_MAX = 140_000;

function charger(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error('Image illisible : choisis un fichier PNG ou JPEG.'));
    img.src = url;
  });
}

export async function preparerLogo(f: File, max = 256): Promise<string> {
  if (!f.type.startsWith('image/')) throw new Error('Choisis une image (PNG ou JPEG).');
  const url = URL.createObjectURL(f);
  try {
    const img = await charger(url);
    const lw = img.naturalWidth || img.width;
    const lh = img.naturalHeight || img.height;
    if (!lw || !lh) throw new Error('Image vide.');
    const k = Math.min(1, max / Math.max(lw, lh));
    const w = Math.max(1, Math.round(lw * k));
    const h = Math.max(1, Math.round(lh * k));
    const dessiner = (fond: boolean) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (!g) throw new Error('Image impossible à préparer sur ce téléphone.');
      if (fond) {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
      }
      g.drawImage(img, 0, 0, w, h);
      return c;
    };
    let data = dessiner(false).toDataURL('image/png');
    if (data.length > LOGO_MAX) data = dessiner(true).toDataURL('image/jpeg', 0.85);
    if (data.length > LOGO_MAX) data = dessiner(true).toDataURL('image/jpeg', 0.6);
    if (data.length > LOGO_MAX || !/^data:image\/(png|jpeg);base64,/.test(data)) throw new Error('Logo trop lourd : choisis une image plus simple.');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
