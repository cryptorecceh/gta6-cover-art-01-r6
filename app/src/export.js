// Vice City Cover Studio — export.js (R6)
// Export deterministik: tanpa Date.now / Math.random. ESM, tanpa dependensi.

import { drawCover, SIZES, FORMATS } from './cover.js';

const MIME = { png: 'image/png', jpeg: 'image/jpeg' };
const EXPORT_JPEG_QUALITY = 0.9;
const EXPORT_DELAY_MS = 150;

// "SUNSET HEIST" -> "sunset-heist".
export function slugify(text) {
  const slug = String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'cover';
}

export function fileName(state, size, format) {
  const base = slugify(state && state.caption ? state.caption : 'cover');
  return `${base}-${size.w}x${size.h}.${format}`;
}

// Gambar state ke canvas baru ukuran size (butuh DOM).
export function renderToCanvas(state, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, state, size.w, size.h);
  return canvas;
}

function canvasToBlob(canvas, format, quality) {
  const mime = MIME[format] || MIME.png;
  const opts = format === 'jpeg' ? quality : undefined;
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob failed'));
    }, mime, opts);
  });
}

// PNG selalu; JPEG pakai quality (default 0.95).
export function exportCover(state, size, format = 'png', quality = 0.95) {
  const fmt = format === 'jpeg' ? 'jpeg' : 'png';
  const q =
    fmt === 'jpeg'
      ? Math.min(1, Math.max(0, Number.isFinite(Number(quality)) ? Number(quality) : 0.95))
      : undefined;
  const canvas = renderToCanvas(state, size);
  return canvasToBlob(canvas, fmt, q);
}

// Unduh satu file export. Return nama file.
export async function exportCoverFile(state, size, format = 'png', quality = 0.95) {
  const fmt = format === 'jpeg' ? 'jpeg' : 'png';
  const blob = await exportCover(state, size, fmt, quality);
  const name = fileName(state, size, fmt);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Export 4 ukuran x PNG + JPEG q0.9, jeda 150ms antar file. Return nama file.
export async function exportAll(state) {
  const names = [];
  for (const size of SIZES) {
    for (const format of FORMATS) {
      const quality = format === 'jpeg' ? EXPORT_JPEG_QUALITY : 0.95;
      names.push(await exportCoverFile(state, size, format, quality));
      await sleep(EXPORT_DELAY_MS);
    }
  }
  return names;
}
