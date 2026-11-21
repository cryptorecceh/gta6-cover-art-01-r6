#!/usr/bin/env node
// Vice City Cover Studio — entrypoint (Node 22, no dependencies).
// Build: copies app/ + screenshots/ to /output (or $MAKEFUN_OUTPUT_DIR)
// and writes /output/dossier.json via the kit vendor buildDossier.
// --validate-only checks screenshots + dossier/text budgets without copying.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIZES, FORMATS, QUALITIES } from './app/src/cover.js';
import { buildDossier } from './vendor/makefun-app.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TEXT_MAX_BYTES = 160 * 1024;
const DOSSIER_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const SHOT_MAX_FILES = 4;
const SHOT_MAX_BYTES = 256 * 1024;
const SHOT_LONG_MAX = 1280;
const SHOT_SHORT_MIN = 480;

const CAPS = {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: { max: SHOT_MAX_FILES, max_bytes: SHOT_MAX_BYTES },
  app_max_files: 993,
};

const USAGE = `Vice City Cover Studio — main.ts
usage: node main.ts [--validate-only] [--sizes] [--formats] [--help]
  (no flag)     build: copy app/ + screenshots/ to /output (or $MAKEFUN_OUTPUT_DIR)
                and write /output/dossier.json
  --validate-only  check screenshots + dossier/text budgets in this repo, no copy
  --sizes       print the export sizes as JSON
  --formats     print the export formats as JSON
sizes: ${SIZES.map((s) => `${s.w}x${s.h}`).join(', ')}
formats: ${FORMATS.join(', ')} (qualities ${QUALITIES.join(', ')})`;

function pngDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function jpegDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) return null;
    let marker = buf[off + 1];
    while (marker === 0xff) { off += 1; marker = buf[off + 1]; }
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}

function imageDims(file: string): { w: number; h: number } | null {
  const buf = readFileSync(file);
  const ext = extname(file).toLowerCase();
  if (ext === '.png') return pngDims(buf);
  if (ext === '.jpg' || ext === '.jpeg') return jpegDims(buf);
  return null;
}

function checkScreenshots(dir: string): string[] {
  const shots = join(dir, 'screenshots');
  if (!existsSync(shots) || !statSync(shots).isDirectory()) {
    return ['screenshots/ is missing'];
  }
  const errors: string[] = [];
  const files = readdirSync(shots).filter((f) => statSync(join(shots, f)).isFile()).sort();
  if (files.length === 0) errors.push('screenshots/ is empty');
  if (files.length > SHOT_MAX_FILES) errors.push(`screenshots/ has ${files.length} files (max ${SHOT_MAX_FILES})`);
  for (const f of files) {
    const p = join(shots, f);
    const size = statSync(p).size;
    if (size > SHOT_MAX_BYTES) errors.push(`${f} is ${size} bytes (max ${SHOT_MAX_BYTES})`);
    const dims = imageDims(p);
    if (!dims) { errors.push(`${f} is not a readable PNG or JPEG`); continue; }
    const longSide = Math.max(dims.w, dims.h);
    const shortSide = Math.min(dims.w, dims.h);
    if (longSide > SHOT_LONG_MAX) errors.push(`${f} long side ${longSide}px (max ${SHOT_LONG_MAX})`);
    if (shortSide < SHOT_SHORT_MIN) errors.push(`${f} short side ${shortSide}px (min ${SHOT_SHORT_MIN})`);
  }
  return errors;
}

function dossierBytes(dir: string): { bytes: number; error: string | null } {
  try {
    const out = buildDossier(dir, CAPS) as unknown;
    const buf = typeof out === 'string' ? Buffer.from(out, 'utf8') : Buffer.from(out as Uint8Array);
    return { bytes: buf.length, error: null };
  } catch (e) {
    return { bytes: 0, error: `dossier: ${(e as Error).message}` };
  }
}

function validate(dir: string): string[] {
  const shotErrors = checkScreenshots(dir);
  if (shotErrors.length === 1 && shotErrors[0] === 'screenshots/ is missing') return shotErrors;
  const errors = [...shotErrors];
  const d = dossierBytes(dir);
  if (d.error) errors.push(d.error);
  else if (d.bytes > DOSSIER_MAX_BYTES) errors.push(`dossier.json is ${d.bytes} bytes (max ${DOSSIER_MAX_BYTES})`);
  return errors;
}

function build(outDir: string): number {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(ROOT, 'app'), join(outDir, 'app'), { recursive: true });
  cpSync(join(ROOT, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const d = dossierBytes(outDir);
  if (d.error) {
    console.error(`error: ${d.error}`);
    return 1;
  }
  const out = buildDossier(outDir, CAPS) as unknown;
  const buf = typeof out === 'string' ? Buffer.from(out, 'utf8') : Buffer.from(out as Uint8Array);
  writeFileSync(join(outDir, 'dossier.json'), buf);
  const errors = validate(outDir);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    return 1;
  }
  console.log(`built ${outDir} (dossier.json ${buf.length} bytes, ${SIZES.length} sizes, formats ${FORMATS.join('/')})`);
  return 0;
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}
if (args.includes('--sizes')) {
  console.log(JSON.stringify(SIZES));
  process.exit(0);
}
if (args.includes('--formats')) {
  console.log(JSON.stringify(FORMATS));
  process.exit(0);
}
if (args.includes('--validate-only')) {
  const errors = validate(ROOT);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    process.exit(1);
  }
  console.log('validate-only: ok');
  process.exit(0);
}
process.exit(build(resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output')));
