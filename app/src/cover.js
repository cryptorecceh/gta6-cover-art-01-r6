// Vice City Cover Studio — cover.js (R6, Bagian A: konstanta + layout + state)
// Deterministik: tanpa Math.random / Date.now. ESM, tanpa dependensi.

export const VERSION = 'r6';

export const LAYOUTS = ['Solo', 'Duo', 'Trio', 'Quad', 'Strip', 'Banner', 'Frame'];

export const GRADES = [
  { name: 'Sunset', tint: 'rgba(255, 94, 20, 0.22)' },
  { name: 'Ocean Drive', tint: 'rgba(0, 170, 220, 0.20)' },
  { name: 'Pastel', tint: 'rgba(255, 170, 205, 0.18)' },
  { name: 'Neon Nights', tint: 'rgba(150, 40, 255, 0.24)' },
  { name: 'Noir', tint: 'rgba(0, 0, 0, 0.28)' },
];

export const FILTERS = ['None', 'Vivid', 'Warm', 'Cool', 'Fade', 'Mono'];

export const SIZES = [
  { w: 1080, h: 1080 },
  { w: 1080, h: 1350 },
  { w: 1920, h: 1080 },
  { w: 1080, h: 1920 },
];

export const FORMATS = ['png', 'jpeg'];

export const QUALITIES = [0.8, 0.9, 0.95];

// Jumlah panel per layout (Frame: 1 hero + 1 polaroid inset).
export const LAYOUT_PANEL_COUNT = {
  Solo: 1,
  Duo: 2,
  Trio: 3,
  Quad: 4,
  Strip: 3,
  Banner: 4,
  Frame: 2,
};

// layoutPanels(layout, W, H) -> [{ x, y, w, h, inset?, tilt? }]
// Koordinat dalam piksel kanvas (0..W, 0..H).
export function layoutPanels(layout, W, H) {
  const full = { x: 0, y: 0, w: W, h: H };
  switch (layout) {
    case 'Solo':
      return [full];
    case 'Duo':
      return [
        { x: 0, y: 0, w: W / 2, h: H },
        { x: W / 2, y: 0, w: W / 2, h: H },
      ];
    case 'Trio': {
      const heroW = W * 0.58;
      return [
        { x: 0, y: 0, w: heroW, h: H },
        { x: heroW, y: 0, w: W - heroW, h: H / 2 },
        { x: heroW, y: H / 2, w: W - heroW, h: H / 2 },
      ];
    }
    case 'Quad':
      return [
        { x: 0, y: 0, w: W / 2, h: H / 2 },
        { x: W / 2, y: 0, w: W / 2, h: H / 2 },
        { x: 0, y: H / 2, w: W / 2, h: H / 2 },
        { x: W / 2, y: H / 2, w: W / 2, h: H / 2 },
      ];
    case 'Strip': {
      const colW = W / 3;
      return [
        { x: 0, y: 0, w: colW, h: H },
        { x: colW, y: 0, w: colW, h: H },
        { x: colW * 2, y: 0, w: colW, h: H },
      ];
    }
    case 'Banner': {
      const bandH = H * 0.72;
      const cellW = W / 3;
      return [
        { x: 0, y: 0, w: W, h: bandH },
        { x: 0, y: bandH, w: cellW, h: H - bandH },
        { x: cellW, y: bandH, w: cellW, h: H - bandH },
        { x: cellW * 2, y: bandH, w: cellW, h: H - bandH },
      ];
    }
    case 'Frame': {
      const insetW = W * 0.28;
      const insetH = insetW * 1.25;
      return [
        full,
        {
          x: W - insetW - W * 0.06,
          y: H - insetH - H * 0.06,
          w: insetW,
          h: insetH,
          inset: true,
          tilt: -4,
        },
      ];
    }
    default:
      return [full];
  }
}

export function defaultPanel() {
  return { photo: null, filter: 'None', panX: 0, panY: 0, zoom: 1, fit: 'Fill' };
}

export function defaultState() {
  return {
    layout: 'Trio',
    grade: 'Sunset',
    caption: 'SUNSET HEIST',
    titleSize: 1,
    tracking: 0,
    panels: [defaultPanel(), defaultPanel(), defaultPanel()],
  };
}

// Lengkapi state: panel yang hilang diisi defaultPanel (jumlah ikut layout).
export function normalizeState(state) {
  const count = LAYOUT_PANEL_COUNT[state.layout] || 1;
  const panels = [];
  for (let i = 0; i < count; i++) {
    panels.push(state.panels && state.panels[i] ? state.panels[i] : defaultPanel());
  }
  return { ...state, panels };
}

// ---------- Bagian B: placeholder art + renderer ----------

// PRNG deterministik (mulberry32).
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACEHOLDER_PALETTES = [
  { skyTop: '#2b1055', skyBot: '#7597de', sun: '#ff9a3d', sunCore: '#ffd319', ground: '#160a24', sill: '#0d0618', accent: '#ff71ce' },
  { skyTop: '#0b1e3a', skyBot: '#1e90c8', sun: '#ff5e78', sunCore: '#ffb3c1', ground: '#071224', sill: '#050a16', accent: '#39d0ff' },
  { skyTop: '#3a0d2e', skyBot: '#e8804f', sun: '#ffe66d', sunCore: '#fff3b0', ground: '#20060f', sill: '#12040a', accent: '#7dffce' },
];

// Gambar placeholder retro deterministik di dalam rect.
// seed = index panel (dipakai sebagai 1000 + seed*77).
export function drawPlaceholderArt(ctx, rect, seed) {
  const rng = mulberry32(1000 + seed * 77);
  const pal = PLACEHOLDER_PALETTES[seed % PLACEHOLDER_PALETTES.length];
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Langit.
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // Bintang.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const stars = 42;
  for (let i = 0; i < stars; i++) {
    const sx = x + rng() * w;
    const sy = y + rng() * h * 0.55;
    const sr = rng() * 1.6 + 0.4;
    ctx.fillRect(sx, sy, sr, sr);
  }

  // Matahari bergaris (synthwave).
  const cx = x + w * 0.5;
  const cy = y + h * 0.4;
  const r = Math.min(w, h) * 0.24;
  const sunGrad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sunGrad.addColorStop(0, pal.sunCore);
  sunGrad.addColorStop(1, pal.sun);
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Garis potong: makin ke bawah makin tebal.
  ctx.fillStyle = pal.skyBot;
  let stripeY = cy + r * 0.05;
  let stripeH = r * 0.03;
  while (stripeY < cy + r) {
    ctx.fillRect(cx - r - 1, stripeY, r * 2 + 2, stripeH);
    stripeY += stripeH + r * 0.09;
    stripeH *= 1.6;
  }

  // Tanah.
  ctx.fillStyle = pal.ground;
  ctx.fillRect(x, y + h * 0.72, w, h * 0.28);

  // Skyline: gedung-gedung gelap + jendela.
  ctx.fillStyle = pal.sill;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.06 + rng() * 0.1);
    const bh = h * (0.08 + rng() * 0.22);
    ctx.fillRect(bx, y + h * 0.72 - bh, bw, bh);
    ctx.fillStyle = pal.accent;
    const wins = Math.floor(rng() * 5);
    for (let k = 0; k < wins; k++) {
      ctx.fillRect(
        bx + rng() * (bw - 3),
        y + h * 0.72 - bh + rng() * (bh - 4),
        2.5,
        3.5,
      );
    }
    ctx.fillStyle = pal.sill;
    bx += bw + w * 0.015;
  }

  // Palem di sudut kiri bawah.
  const px = x + w * 0.12;
  const py = y + h * 0.98;
  const ph = h * 0.3;
  ctx.strokeStyle = pal.sill;
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.quadraticCurveTo(px + w * 0.02, py - ph * 0.6, px + w * 0.06, py - ph);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, w * 0.006);
  for (let f = 0; f < 5; f++) {
    const ang = Math.PI * (1.05 + f * 0.18);
    const fx = px + w * 0.06 + Math.cos(ang) * w * 0.09;
    const fy = py - ph + Math.sin(ang) * h * 0.09;
    ctx.beginPath();
    ctx.moveTo(px + w * 0.06, py - ph);
    ctx.quadraticCurveTo(
      px + w * 0.06 + Math.cos(ang) * w * 0.05,
      py - ph + Math.sin(ang) * h * 0.05 - h * 0.03,
      fx,
      fy,
    );
    ctx.stroke();
  }

  ctx.restore();
}

// Filter panel -> string ctx.filter.
function filterFor(name) {
  switch (name) {
    case 'Vivid':
      return 'saturate(1.5) contrast(1.15)';
    case 'Warm':
      return 'sepia(0.35) saturate(1.3)';
    case 'Cool':
      return 'hue-rotate(-15deg) saturate(1.2)';
    case 'Fade':
      return 'brightness(1.08) contrast(0.9) saturate(0.8)';
    case 'Mono':
      return 'grayscale(1)';
    default:
      return 'none';
  }
}

// Gambar satu panel: foto (Fill=cover, Fit=contain) atau placeholder.
function drawPanel(ctx, rect, panel, index) {
  const { x, y, w, h } = rect;
  if (panel.photo) {
    const img = panel.photo;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw > 0 && ih > 0) {
      const zoom = panel.zoom || 1;
      const scale =
        panel.fit === 'Fit'
          ? Math.min(w / iw, h / ih) * zoom
          : Math.max(w / iw, h / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = x + (w - dw) / 2 + (panel.panX || 0) * w;
      const dy = y + (h - dh) / 2 + (panel.panY || 0) * h;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.filter = filterFor(panel.filter);
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.filter = 'none';
      ctx.restore();
      return;
    }
  }
  drawPlaceholderArt(ctx, rect, index);
}

// Renderer utama: gambar cover lengkap ke ctx ukuran W x H.
export function drawCover(ctx, state, W, H) {
  const st = normalizeState(state);
  const panels = layoutPanels(st.layout, W, H);

  // (1) Base fill.
  ctx.save();
  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, W, H);

  // (2) Panel-panel.
  for (let i = 0; i < panels.length; i++) {
    const rect = panels[i];
    const panel = st.panels[i] || defaultPanel();
    if (rect.inset) {
      // Frame: backing putih + shadow, foto di-clip dalam frame miring.
      const tilt = ((rect.tilt || 0) * Math.PI) / 180;
      const pad = rect.w * 0.09;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = W * 0.02;
      ctx.shadowOffsetX = W * 0.006;
      ctx.shadowOffsetY = H * 0.012;
      ctx.fillStyle = '#f8f4ec';
      ctx.fillRect(-rect.w / 2 - pad, -rect.h / 2 - pad, rect.w + pad * 2, rect.h + pad * 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.restore();
      // Foto di dalam frame miring (clip mengikuti tilt).
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.rect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.clip();
      drawPanel(ctx, { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }, panel, i);
      ctx.restore();
    } else {
      drawPanel(ctx, rect, panel, i);
    }
  }

  // (3) Tint grade.
  const grade = GRADES.find((g) => g.name === st.grade) || GRADES[0];
  ctx.fillStyle = grade.tint;
  ctx.fillRect(0, 0, W, H);

  // (4) Caption.
  const caption = (st.caption || '').toUpperCase();
  if (caption) {
    const titleSize = Math.min(1.3, Math.max(0.7, st.titleSize || 1));
    const tracking = st.tracking || 0;
    let size = W * 0.085 * titleSize;
    const measure = (s) => {
      ctx.font = `900 ${s}px "Arial Black", Arial, sans-serif`;
      let tw = 0;
      for (const ch of caption) tw += ctx.measureText(ch).width;
      return tw + tracking * (caption.length - 1);
    };
    while (size > 8 && measure(size) > W * 0.92) size *= 0.95;
    ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    const baseY = H * 0.9;
    // Scrim bawah.
    const scrim = ctx.createLinearGradient(0, H * 0.8, 0, H);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.8, W, H * 0.2);
    // Accent bar di atas caption.
    const totalW = measure(size);
    const startX = (W - totalW) / 2;
    ctx.fillStyle = '#ffd319';
    ctx.fillRect(startX, baseY - size * 1.35, Math.max(W * 0.06, size * 0.9), size * 0.12);
    // Teks per karakter (tracking manual).
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = 'rgba(10,5,20,0.9)';
    ctx.fillStyle = '#ffffff';
    let cx = startX;
    for (const ch of caption) {
      const cw = ctx.measureText(ch).width;
      ctx.strokeText(ch, cx, baseY);
      ctx.fillText(ch, cx, baseY);
      cx += cw + tracking;
    }
  }

  // (5) Grain + vignette + scanlines.
  const grain = mulberry32(20261121);
  const dots = Math.round((W * H) / 900);
  for (let i = 0; i < dots; i++) {
    const gx = grain() * W;
    const gy = grain() * H;
    ctx.fillStyle = grain() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(gx, gy, 1.2, 1.2);
  }
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);

  ctx.restore();
}
