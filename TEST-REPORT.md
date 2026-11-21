# TEST-REPORT — Vice City Cover Studio (gta6-cover-art-01 R6)

## Bug yang diperbaiki (sesi 7)

**SCENES TDZ — canvas hitam di semua screenshot.**
`applyScene()` dipanggil dari `init()` (baris ~474) sebelum deklarasi `const SCENES`
(baris ~712) dieksekusi, sehingga `?shot=...` melempar
`Uncaught ReferenceError: Cannot access 'SCENES' before initialization` dan
mematikan init + render pertama. Tanpa `?shot=` tidak kena (short-circuit),
makanya `node --check` lolos.
**Fix:** deklarasi `const SCENES` dipindah ke atas file (baris 470, sebelum blok
init). Tidak ada perubahan perilaku lain.
**Verifikasi fix:** serve + Chrome headless — `?shot=trio` dan `?shot=frame`:
0 console error, canvas berisi (1.071 / 1.098 warna berbeda, blackFrac 0),
caption + layout sesuai scene.

## Screenshot (re-take setelah fix)

| File | Ukuran | Dimensi |
| --- | --- | --- |
| 1-trio.jpg | 133.675 B (131 KiB) | 1080x1080 |
| 2-editor.jpg | 131.686 B (129 KiB) | 1280x1000 |
| 3-frame.jpg | 136.562 B (133 KiB) | 1080x1080 |
| 4-banner.jpg | 132.962 B (130 KiB) | 1080x1080 |

Semua ≤256 KiB; keempat hash sha256 BERBEDA (sebelum fix, 3 file byte-identik
karena canvas hitam).

## Testing driver (`scratch-r6/driver.mjs`, CDP + Chrome headless)

**88/88 PASS**, 0 gagal. Per kelompok:

- (a) Scene — 9 halaman (default + 8 `?shot=`): canvas tidak hitam,
  layout + caption sesuai scene, 0 console error. **36/36**
- (b) Hook `__vc` — `version='r6'`, `state` object, 19 fungsi ada dan
  callable; semua setter mengubah state dengan benar (layout, grade,
  caption, titleSize 1.2, tracking 5, panel aktif, filter Mono, fit Fit,
  zoom 1.5, pan 10/-5, shuffle, setSize 1080x1350, render, applyState,
  exportCover PNG blob > 0). **23/23**
- (c) Undo/redo + coalescing — caption undo/redo pulih; 2x `setTitleSize`
  cepat = 1 langkah undo (kembali ke baseline), redo = 0.9. **4/4**
- (d) exportCover — PNG + JPEG q0.9 untuk semua 4 SIZES, blob > 0. **8/8**
- (e) Determinisme — render 2x state sama → byte PNG identik (hash FNV-1a
  sama). **1/1**
- exportAll — resolve 8 nama file, 8 file terunduh. **2/2**
- (f) `node main.ts --validate-only` — exit 0. **1/1**
- Sisa cek: keberadaan hook + state awal. **13/13**

## Determinisme build

- Build 2x (`MAKEFUN_OUTPUT_DIR` berbeda): `diff -r` IDENTIK.
- Dossier hash sama di kedua build + fresh-tree build:
  `sha256 163676ed7239443c984b80213fe8880ca166ed0920ce9cf38abcf6608b4e637e`
- Dossier 744 KiB (≤1,5 MiB). Fresh-tree `validate-only` exit 0.

## Perintah reproduce

```sh
node scratch-r6/verify-fix.mjs   # smoke test fix SCENES
node scratch-r6/take-shots.mjs   # re-take 4 screenshot
node scratch-r6/driver.mjs       # 88 cek (butuh serve + Chrome headless)
node main.ts --validate-only     # exit 0
```
