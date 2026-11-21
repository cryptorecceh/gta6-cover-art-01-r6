// Vice City Cover Studio — main.js (R6, Bagian A: state + render + hook inti)
// Deterministik kecuali shuffle. ESM, tanpa dependensi. Semua DOM opsional.

import { drawCover, defaultState, normalizeState, layoutPanels, LAYOUTS, GRADES, FILTERS, SIZES } from './cover.js';
import { exportCover, exportAll, exportCoverFile } from './export.js';

const DEFAULT_SIZE = SIZES[0]; // 1080x1080
const COALESCE_MS = 600;
const UNDO_MAX = 50;

let state = defaultState();
let activePanel = 0;
let canvasW = DEFAULT_SIZE.w;
let canvasH = DEFAULT_SIZE.h;

const undoStack = [];
const redoStack = [];
let lastPush = { key: null, time: 0 };

// Snapshot state; referensi foto dishare (bukan di-clone).
function snapshot(st) {
  return { ...st, panels: st.panels.map((p) => ({ ...p })) };
}

function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

// Terapkan state (clamp + normalisasi) lalu render. Tanpa push undo.
function applyState(next) {
  const st = normalizeState(next || {});
  st.titleSize = clampNum(st.titleSize, 0.7, 1.3, 1);
  st.tracking = clampNum(st.tracking, -2, 12, 0);
  st.panels = st.panels.map((p) => ({
    ...p,
    zoom: Math.max(0.5, Number.isFinite(Number(p.zoom)) ? Number(p.zoom) : 1),
  }));
  state = st;
  render();
  return state;
}

// Push snapshot ke undo. Coalescing HANYA untuk nilai kontinu (key yang sama
// dalam 600ms tidak push lagi, jadi satu drag = satu langkah undo).
function pushUndo(key) {
  const now = Date.now();
  const continuous = key !== null && key !== undefined;
  if (continuous && lastPush.key === key && now - lastPush.time < COALESCE_MS) return;
  undoStack.push(snapshot(state));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;
  lastPush = { key: continuous ? key : null, time: now };
}

// Ubah state + push undo + render. Dipakai semua setter.
function commit(next, key) {
  pushUndo(key === undefined ? null : key);
  return applyState(next);
}

function withPanel(index, patch) {
  const st = snapshot(state);
  const i = Math.min(Math.max(0, index | 0), st.panels.length - 1);
  st.panels[i] = { ...st.panels[i], ...patch };
  return st;
}

// Gambar state saat ini ke canvas #stage. Tanpa canvas: diam.
function render() {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById('stage');
  if (!canvas) return;
  if (canvas.width !== canvasW) canvas.width = canvasW;
  if (canvas.height !== canvasH) canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawCover(ctx, state, canvasW, canvasH);
  drawSelectionOutline(ctx);
  syncUI();
}

// Garis putus-putus di sekeliling panel aktif (ikuti tilt kalau inset).
// Hanya di canvas tampilan — export (drawCover langsung) tidak kena.
function drawSelectionOutline(ctx) {
  const panels = layoutPanels(state.layout, canvasW, canvasH);
  const rect = panels[Math.min(activePanel, panels.length - 1)];
  if (!rect) return;
  ctx.save();
  ctx.setLineDash([Math.max(6, canvasW * 0.01), Math.max(4, canvasW * 0.006)]);
  ctx.lineWidth = Math.max(2, canvasW * 0.004);
  ctx.strokeStyle = '#ffd319';
  if (rect.tilt) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(((rect.tilt || 0) * Math.PI) / 180);
    ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
  } else {
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snapshot(state));
  const prev = undoStack.pop();
  lastPush = { key: null, time: 0 };
  applyState(prev);
  return true;
}

function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snapshot(state));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  const next = redoStack.pop();
  lastPush = { key: null, time: 0 };
  applyState(next);
  return true;
}

function setLayout(layout) {
  if (!LAYOUTS.includes(layout)) return state;
  if (layout === state.layout) return state;
  const next = snapshot(state);
  next.layout = layout;
  return commit(next, null);
}

function setGrade(grade) {
  if (!GRADES.some((g) => g.name === grade)) return state;
  if (grade === state.grade) return state;
  const next = snapshot(state);
  next.grade = grade;
  return commit(next, null);
}

function setCaption(text) {
  const next = snapshot(state);
  next.caption = String(text == null ? '' : text);
  return commit(next, null);
}

function setTitleSize(v) {
  const next = snapshot(state);
  next.titleSize = clampNum(v, 0.7, 1.3, state.titleSize);
  return commit(next, 'titleSize');
}

function setTracking(v) {
  const next = snapshot(state);
  next.tracking = clampNum(v, -2, 12, state.tracking);
  return commit(next, 'tracking');
}

function setFilter(filter, index) {
  const i = index === undefined ? activePanel : index;
  return commit(withPanel(i, { filter: String(filter) }), null);
}

function setFit(fit, index) {
  const i = index === undefined ? activePanel : index;
  return commit(withPanel(i, { fit: String(fit) }), null);
}

function setZoom(zoom, index) {
  const i = index === undefined ? activePanel : index;
  const z = Math.max(0.5, Number.isFinite(Number(zoom)) ? Number(zoom) : 1);
  return commit(withPanel(i, { zoom: z }), 'zoom');
}

function setPan(panX, panY, index) {
  const i = index === undefined ? activePanel : index;
  return commit(
    withPanel(i, { panX: Number(panX) || 0, panY: Number(panY) || 0 }),
    'pan',
  );
}

function selectPanel(index) {
  const n = state.panels.length;
  activePanel = Math.min(Math.max(0, index | 0), n - 1);
  render();
  return activePanel;
}

function shuffle() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const next = snapshot(state);
  next.layout = pick(LAYOUTS);
  next.grade = pick(GRADES).name;
  const norm = normalizeState(next);
  const filters = ['None', 'Vivid', 'Warm', 'Cool', 'Fade', 'Mono'];
  norm.panels = norm.panels.map((p) => ({ ...p, filter: pick(filters) }));
  return commit(norm, null);
}

function setSize(w, h) {
  const nw = Math.floor(Number(w));
  const nh = Math.floor(Number(h));
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return false;
  canvasW = nw;
  canvasH = nh;
  render();
  return true;
}

function getState() {
  return snapshot(state);
}

if (typeof window !== 'undefined') {
  window.__vc = {
    version: 'r6',
    get state() {
      return state;
    },
    get activePanel() {
      return activePanel;
    },
    setLayout,
    setGrade,
    setCaption,
    setTitleSize,
    setTracking,
    setFilter,
    setFit,
    setZoom,
    setPan,
    selectPanel,
    shuffle,
    undo,
    redo,
    setSize,
    render,
    applyState,
    getState,
    exportCover,
    exportAll,
  };
}

// ---------- Bagian B: wiring kontrol UI ----------
// Semua DOM opsional: elemen yang tidak ada di-skip diam-diam.
// Kontrol panel dibangun SEKALI (buildPanelControls); syncUI hanya update
// NILAI kontrol, tidak pernah rebuild DOM (bug R5: slider hancur saat di-drag).

let controlsBuilt = false;

function $(id) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

function el(tag, attrs, text) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'id') n.id = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
  }
  if (text !== undefined) n.textContent = text;
  return n;
}

function setStatus(msg) {
  const s = $('status');
  if (s) s.textContent = msg;
}

// Kontrol panel aktif (#panel-filter, #panel-fit, #panel-zoom, #panel-panx,
// #panel-pany, #panel-label): dibuat SEKALI di dalam #panel-bar. Kalau sudah
// ada di HTML, pakai yang ada.
function buildPanelControls() {
  const bar = $('panel-bar');
  if (!bar) return;

  let filter = $('panel-filter');
  if (!filter) {
    filter = el('select', { id: 'panel-filter' });
    FILTERS.forEach((f) => filter.appendChild(el('option', { value: f }, f)));
    bar.appendChild(filter);
  } else if (!filter.options.length) {
    FILTERS.forEach((f) => filter.appendChild(el('option', { value: f }, f)));
  }
  filter.addEventListener('change', () => setFilter(filter.value));

  let fit = $('panel-fit');
  if (!fit) {
    fit = el('select', { id: 'panel-fit' });
    ['Fill', 'Fit'].forEach((f) => fit.appendChild(el('option', { value: f }, f)));
    bar.appendChild(fit);
  } else if (!fit.options.length) {
    ['Fill', 'Fit'].forEach((f) => fit.appendChild(el('option', { value: f }, f)));
  }
  fit.addEventListener('change', () => setFit(fit.value));

  let zoom = $('panel-zoom');
  if (!zoom) {
    zoom = el('input', { id: 'panel-zoom', type: 'range', min: '0.5', max: '3', step: '0.05' });
    bar.appendChild(zoom);
  }
  zoom.addEventListener('input', () => setZoom(parseFloat(zoom.value)));

  let panx = $('panel-panx');
  if (!panx) {
    panx = el('input', { id: 'panel-panx', type: 'range', min: '-0.5', max: '0.5', step: '0.01' });
    bar.appendChild(panx);
  }
  let pany = $('panel-pany');
  if (!pany) {
    pany = el('input', { id: 'panel-pany', type: 'range', min: '-0.5', max: '0.5', step: '0.01' });
    bar.appendChild(pany);
  }
  const onPan = () => setPan(parseFloat(panx.value), parseFloat(pany.value));
  panx.addEventListener('input', onPan);
  pany.addEventListener('input', onPan);

  if (!$('panel-label')) bar.appendChild(el('span', { id: 'panel-label' }, ''));
}

// Bangun semua kontrol SEKALI. Dipanggil sekali saat init.
function buildControls() {
  if (controlsBuilt || typeof document === 'undefined') return;
  controlsBuilt = true;

  const layoutBar = $('layout-bar');
  if (layoutBar) {
    if (!layoutBar.querySelector('[data-layout]')) {
      LAYOUTS.forEach((name, i) => {
        layoutBar.appendChild(
          el('button', { type: 'button', 'data-layout': name }, `${i + 1} ${name}`),
        );
      });
    }
    layoutBar.querySelectorAll('[data-layout]').forEach((b) => {
      b.addEventListener('click', () => setLayout(b.getAttribute('data-layout')));
    });
  }

  const gradeBar = $('grade-bar');
  if (gradeBar) {
    if (!gradeBar.querySelector('[data-grade]')) {
      GRADES.forEach((g) => {
        gradeBar.appendChild(el('button', { type: 'button', 'data-grade': g.name }, g.name));
      });
    }
    gradeBar.querySelectorAll('[data-grade]').forEach((b) => {
      b.addEventListener('click', () => setGrade(b.getAttribute('data-grade')));
    });
  }

  const caption = $('caption-input');
  if (caption) caption.addEventListener('input', () => setCaption(caption.value));

  const titleSize = $('title-size');
  if (titleSize) {
    titleSize.min = '0.70';
    titleSize.max = '1.30';
    titleSize.step = '0.01';
    titleSize.addEventListener('input', () => setTitleSize(parseFloat(titleSize.value)));
  }

  const tracking = $('tracking');
  if (tracking) {
    tracking.min = '-2';
    tracking.max = '12';
    tracking.step = '0.5';
    tracking.addEventListener('input', () => setTracking(parseFloat(tracking.value)));
  }

  buildPanelControls();

  const sizeSel = $('size-select');
  if (sizeSel) {
    if (!sizeSel.options.length) {
      SIZES.forEach((s) => {
        sizeSel.appendChild(el('option', { value: `${s.w}x${s.h}` }, `${s.w}×${s.h}`));
      });
    }
    sizeSel.addEventListener('change', () => {
      const [w, h] = sizeSel.value.split('x').map(Number);
      setSize(w, h);
    });
  }

  const shuffleBtn = $('shuffle-btn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      shuffle();
      setStatus('Shuffled');
    });
  }
  const undoBtn = $('undo-btn');
  if (undoBtn) undoBtn.addEventListener('click', () => undo());
  const redoBtn = $('redo-btn');
  if (redoBtn) redoBtn.addEventListener('click', () => redo());

  const exportBtn = $('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCoverFile(state, { w: canvasW, h: canvasH }, 'png')
        .then((name) => setStatus(`Exported ${name}`))
        .catch(() => setStatus('Export failed'));
    });
  }
  const exportAllBtn = $('export-all-btn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      setStatus('Exporting all sizes…');
      exportAll(state)
        .then((names) => setStatus(`Exported ${names.length} files`))
        .catch(() => setStatus('Export failed'));
    });
  }
}

// Update NILAI kontrol dari state — tidak pernah rebuild DOM.
function syncUI() {
  if (typeof document === 'undefined') return;

  const layoutBar = $('layout-bar');
  if (layoutBar) {
    layoutBar.querySelectorAll('[data-layout]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-layout') === state.layout);
    });
  }
  const gradeBar = $('grade-bar');
  if (gradeBar) {
    gradeBar.querySelectorAll('[data-grade]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-grade') === state.grade);
    });
  }

  const caption = $('caption-input');
  if (caption && caption.value !== state.caption) caption.value = state.caption;
  const titleSize = $('title-size');
  if (titleSize) titleSize.value = String(state.titleSize);
  const tracking = $('tracking');
  if (tracking) tracking.value = String(state.tracking);

  const panel = state.panels[activePanel] || state.panels[0];
  const label = $('panel-label');
  if (label) label.textContent = `Panel ${activePanel + 1} of ${state.panels.length}`;
  const filter = $('panel-filter');
  if (filter && panel) filter.value = panel.filter;
  const fit = $('panel-fit');
  if (fit && panel) fit.value = panel.fit;
  const zoom = $('panel-zoom');
  if (zoom && panel) zoom.value = String(panel.zoom);
  const panx = $('panel-panx');
  if (panx && panel) panx.value = String(panel.panX);
  const pany = $('panel-pany');
  if (pany && panel) pany.value = String(panel.panY);

  const sizeSel = $('size-select');
  if (sizeSel) sizeSel.value = `${canvasW}x${canvasH}`;

  const undoBtn = $('undo-btn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  const redoBtn = $('redo-btn');
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// Init: bangun kontrol sekali, lalu render saat DOM siap.
if (typeof document !== 'undefined') {
  const init = () => {
    buildControls();
    applyScene();
    wireCanvas();
    wirePhotoInput();
    wireKeyboard();
    loadSamples();
    render();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

// ---------- Bagian C: foto, interaksi canvas, shortcut, scene ----------
// Semua DOM opsional. Gambar gagal muat = diam-diam dilewati, tanpa crash.

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('bad image'));
    };
    img.src = url;
  });
}

function loadImageSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('missing'));
    img.src = src;
  });
}

function assignPhotoToPanel(img, index) {
  const next = snapshot(state);
  const i = Math.min(Math.max(0, index | 0), next.panels.length - 1);
  next.panels[i] = { ...next.panels[i], photo: img };
  return commit(next, null);
}

// File gambar -> panel mulai dari startIndex, lalu panel berikutnya (wrap).
async function assignFiles(files, startIndex) {
  const list = [...files].filter((f) => f && f.type && f.type.startsWith('image/'));
  if (!list.length) return;
  const imgs = await Promise.all(list.map((f) => loadImageFile(f).catch(() => null)));
  const next = snapshot(state);
  const n = next.panels.length;
  let last = startIndex;
  let loaded = 0;
  imgs.forEach((img, k) => {
    if (!img) return;
    const i = (((startIndex + k) % n) + n) % n;
    next.panels[i] = { ...next.panels[i], photo: img };
    last = i;
    loaded += 1;
  });
  if (!loaded) return;
  commit(next, null);
  selectPanel(last);
  setStatus(`Loaded ${loaded} photo(s)`);
}

function wirePhotoInput() {
  const input = $('photo-input');
  if (!input) return;
  input.addEventListener('change', () => {
    if (input.files && input.files.length) {
      assignFiles(input.files, activePanel);
      input.value = '';
    }
  });
}

// Sample bawaan saat boot; file tidak ada = diam-diam lanjut.
function loadSamples() {
  loadImageSrc('samples/boulevard.jpg')
    .then((img) => {
      if (state.panels[0] && !state.panels[0].photo) assignPhotoToPanel(img, 0);
    })
    .catch(() => {});
  loadImageSrc('samples/pier.jpg')
    .then((img) => {
      if (state.panels[1] && !state.panels[1].photo) assignPhotoToPanel(img, 1);
    })
    .catch(() => {});
}

// Posisi event -> koordinat kanvas (skala dari ukuran tampil ke ukuran asli).
function canvasPoint(e) {
  const canvas = $('stage');
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

// Panel di titik (x, y); inset dicek dengan rotasi balik. -1 kalau di luar.
// Urutan terbalik: panel paling atas (inset) dicek dulu.
function hitPanel(px, py) {
  const panels = layoutPanels(state.layout, canvasW, canvasH);
  for (let i = panels.length - 1; i >= 0; i--) {
    const rc = panels[i];
    let lx = px - (rc.x + rc.w / 2);
    let ly = py - (rc.y + rc.h / 2);
    if (rc.tilt) {
      const a = (-(rc.tilt || 0) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rx = lx * c - ly * s;
      const ry = lx * s + ly * c;
      lx = rx;
      ly = ry;
    }
    if (Math.abs(lx) <= rc.w / 2 && Math.abs(ly) <= rc.h / 2) return i;
  }
  return -1;
}

function wireCanvas() {
  const canvas = $('stage');
  if (!canvas) return;
  canvas.style.touchAction = 'none';
  let drag = null;

  canvas.addEventListener('pointerdown', (e) => {
    const pt = canvasPoint(e);
    if (!pt) return;
    const i = hitPanel(pt.x, pt.y);
    if (i < 0) return;
    selectPanel(i);
    const p = state.panels[i];
    drag = {
      index: i,
      startX: pt.x,
      startY: pt.y,
      panX: p.panX || 0,
      panY: p.panY || 0,
      moved: false,
    };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pt = canvasPoint(e);
    if (!pt) return;
    if (Math.abs(pt.x - drag.startX) > 4 || Math.abs(pt.y - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    const dx = (pt.x - drag.startX) / canvasW;
    const dy = (pt.y - drag.startY) / canvasH;
    setPan(drag.panX + dx, drag.panY + dy, drag.index);
  });

  const endDrag = () => {
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = state.panels[activePanel];
      if (!p) return;
      const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom(Math.min(3, Math.max(0.5, (p.zoom || 1) * f)), activePanel);
    },
    { passive: false },
  );

  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    const pt = canvasPoint(e);
    const i = pt ? hitPanel(pt.x, pt.y) : -1;
    assignFiles(files, i >= 0 ? i : activePanel);
  });
}

function wireKeyboard() {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (
      t &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    ) {
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const k = (e.key || '').toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
      return;
    }
    if (e.altKey) return;
    const k = e.key;
    if (k >= '1' && k <= '7') {
      const layout = LAYOUTS[Number(k) - 1];
      if (layout) setLayout(layout);
      return;
    }
    const lk = (k || '').toLowerCase();
    if (lk === 'g') {
      const gi = GRADES.findIndex((g) => g.name === state.grade);
      const next = GRADES[(gi + 1) % GRADES.length];
      setGrade(next.name);
    } else if (lk === 'e') {
      exportCoverFile(state, { w: canvasW, h: canvasH }, 'png')
        .then((name) => setStatus(`Exported ${name}`))
        .catch(() => setStatus('Export failed'));
    }
  });
}

// Scene dari ?shot=: layout + grade + caption (+ ukuran khusus editor).
const SCENES = {
  trio: { layout: 'Trio', grade: 'Sunset', caption: 'SUNSET HEIST' },
  editor: { layout: 'Trio', grade: 'Sunset', caption: 'SUNSET HEIST', size: { w: 1280, h: 720 } },
  frame: { layout: 'Frame', grade: 'Ocean Drive', caption: 'OCEAN DRIVE' },
  banner: { layout: 'Banner', grade: 'Pastel', caption: 'PASTEL PALMS' },
  quad: { layout: 'Quad', grade: 'Neon Nights', caption: 'NEON SQUAD' },
  solo: { layout: 'Solo', grade: 'Noir', caption: 'LONE WOLF' },
  duo: { layout: 'Duo', grade: 'Ocean Drive', caption: 'DOUBLE TROUBLE' },
  strip: { layout: 'Strip', grade: 'Pastel', caption: 'PALM STRIP' },
};

function applyScene() {
  if (typeof window === 'undefined') return;
  let shot = null;
  try {
    shot = new URLSearchParams(window.location.search).get('shot');
  } catch (_) {
    return;
  }
  const scene = shot && SCENES[shot.toLowerCase()];
  if (!scene) return;
  const next = snapshot(state);
  next.layout = scene.layout;
  next.grade = scene.grade;
  next.caption = scene.caption;
  applyState(next);
  if (scene.size) setSize(scene.size.w, scene.size.h);
}
