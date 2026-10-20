export function photoFilename(photo) {
  const raw = photo.filename || photo.original_filename || (() => {
    try { return decodeURIComponent(new URL(photo.image, window.location.href).pathname.split('/').pop()); }
    catch { return ''; }
  })();
  return (raw || `photo-${photo.id || 'download'}.jpg`).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function fetchPhoto(photo) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(photo.image, { signal: controller.signal });
    if (!response.ok) throw new Error(`Could not download ${photoFilename(photo)}. Please try again.`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') throw new Error('The photo is unavailable. Please refresh and try again.');
    return blob;
  } finally { window.clearTimeout(timer); }
}

export async function downloadPhoto(photo) {
  saveBlob(await fetchPhoto(photo), photoFilename(photo));
}

export async function downloadPhotos(photos, filename, onProgress = () => {}) {
  const { zipSync } = await import('fflate');
  const files = Object.create(null);
  let size = 0;
  for (let index = 0; index < photos.length; index++) {
    const blob = await fetchPhoto(photos[index]);
    size += blob.size;
    if (size > 250 * 1024 * 1024) throw new Error('This download is too large. Select a smaller group of photos and try again.');
    files[`${String(index + 1).padStart(3, '0')}-${photoFilename(photos[index])}`] = new Uint8Array(await blob.arrayBuffer());
    onProgress(index + 1, photos.length);
  }
  saveBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), filename);
}
