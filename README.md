# Vice City Cover Studio

[![make.fun](https://img.shields.io/badge/make.fun-bounty-orange)](https://make.fun/bounty/gta6-cover-art-01)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![node](https://img.shields.io/badge/node-22-blue)](./main.ts)

An offline browser web app that turns your photos and a caption into
GTA&nbsp;6-style cover art — the iconic multi-panel poster and
loading-screen look with a Vice City neon-sunset grade.

## What it does

- 7 layouts (Solo, Duo, Trio, Quad, Strip, Banner, Frame) with per-panel
  photo, filter, pan, zoom and Fill/Fit crop
- 6 neon grades, caption lettering in the genre's style with title size
  and tracking controls
- One-click export to the common post sizes (1080×1080, 1080×1350,
  1920×1080, 1080×1920) as PNG or JPEG — or all sizes at once
- Photos never leave your machine; no server, no upload, no watermark

## Run it

```sh
node serve.ts            # http://localhost:8080/
node main.ts --validate-only
node main.ts             # build to /output (+ dossier.json)
```
