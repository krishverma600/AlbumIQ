import jsQR from 'jsqr';

export function eventCodeFromQr(value) {
  let code = value.trim();
  if (/^https?:\/\//i.test(code)) {
    let url;
    try { url = new URL(code); } catch { throw new Error('This QR code does not contain a valid event link.'); }
    const match = url.pathname.match(/^\/event\/([a-z0-9-]+)\/?$/i);
    if (!match) throw new Error('This is not an event QR code. Upload the QR shared by your photographer.');
    code = match[1];
  }
  code = code.toUpperCase();
  if (!/^(?:WED-[A-Z0-9]{4}|[A-Z0-9]{6})$/.test(code)) throw new Error('This is not an event QR code. Upload the QR shared by your photographer.');
  return code;
}

export function decodeQrPixels(pixels, width, height) {
  return jsQR(pixels, width, height, { inversionAttempts: 'attemptBoth' })?.data || null;
}

export async function readQrFile(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image containing the event QR code.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a QR image smaller than 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const value = decodeQrPixels(pixels.data, pixels.width, pixels.height);
    if (!value) throw new Error('No QR code found. Choose a clear image showing the entire QR code.');
    return eventCodeFromQr(value);
  } finally { URL.revokeObjectURL(url); }
}
