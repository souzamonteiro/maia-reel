# Implementation verification — 2026-09-24

Environment: Linux, Node 22.14.0, npm 11.1.0, Chrome 149.0.7827.53, native FFmpeg for independent output inspection. Browser tests run against a built static site on loopback port 5174 without cross-origin isolation headers. The development server runs on loopback port 5173.

## Commands and results

| Command | Result |
| --- | --- |
| `npm ci` | Fresh dependency reinstall passed; pinned packages and engine asset preparation |
| `npm run fixtures` | Synthetic video, audio and image fixtures generated; ignored by Git |
| `npm run lint` | TypeScript and Prettier checks passed |
| `npm test` | 9 tests passed |
| `npm run build` | Production build passed; separate worker and self-hosted core |
| `EDITOR_URL=http://127.0.0.1:5174 npm run test:browser` | Full browser acceptance journey passed |
| `npm audit` | Zero reported vulnerabilities |
| `git diff --check` | Passed |

A first formatting check found a residual Prettier layout difference in the browser test; formatting was rerun and the final check passed. Vite 6.4.1 initially reported a vulnerability; the lockfile now pins 6.4.3 and the final audit is clean.

## What the browser test proves

- Unsupported fake MP4 signature is rejected without adding an asset.
- Import of two H.264/AAC videos at 30 and 24 fps and a WAV; append, trim, split, move, gain, title, undo and redo.
- Additional audio-track creation/undo; single-job thumbnail and bounded waveform generation.
- Play clock advances; canvas preview was visually inspected in the generated screenshot.
- JSON download, page reload, offline placeholders, explicit media relink confirmations.
- Installed encoder/filter probe; actual MP4 and WebM output downloads and MP4 reimport.
- Worker cancellation and fresh worker recovery.
- Edge-case journey: PNG still image, video without an audio stream, a half-second timeline gap, offline-export blocking and confirmed relink. Independent pixel samples verify black/red/green at the expected times; decoded output samples verify silence.
- No page requests to external origins and no uncaught page errors.

## Independent output evidence

| Measurement | Result |
| --- | --- |
| Expected project duration | 4.000 s |
| MP4 | H.264 + AAC; 1280×720, 30 fps; 4.000000 s |
| WebM | VP8 + Vorbis; 4.003000 s |
| Duration tolerance | Both within one 30 fps frame |
| MP4 export wall time, including worker setup | 5.565 s |
| WebM export wall time, including worker setup | 21.944 s |
| Mixed audio mean volume | -23.8 dB |
| Preview/export title-region mean absolute pixel error | 2.612 on a 0–255 scale (threshold 12) |

Audio samples were decoded independently with native FFmpeg. Frequency checks find the first source's 440 Hz tone before the picture cut, the second source's 880 Hz tone after it, and the music's 220 Hz tone in the mix. A sampled later output frame is blue as expected from the second clip. These are automated signal checks, not a claim of human listening or frame-perfect lip sync. The screenshot was visually reviewed, but a full interactive human acceptance session remains advisable before release.

Initial WebM exports using libopus trapped with a WASM memory error on the real filter graph even though a simple lavfi Opus probe passed. The verified implementation uses libvorbis. Every export now has a fresh worker and a single encoder thread; see DECISIONS for reproduction context. No silent codec/extension substitution occurs.

## Artifacts and changed areas

Generated evidence (ignored): `test-results/editor.png`, `project.maiareel.json`, `output.mp4`, `output.webm`, `verification.json`. Regenerate using the documented commands.

Implemented files: `apps/editor/main.ts`, `apps/editor/style.css`; project/timeline modules; media registry and visuals; preview compositor; export planner/worker adapter; package/TypeScript/Vite configuration; synthetic fixture and engine-preparation scripts; project, browser and edge-case tests; NOTICE and public license texts. README, source inventory, decisions, deployment, roadmap and this verification report describe the implementation.

## Remaining release gates

Optional phase 3 Maia effect/capture/RNNoise/subtitle integrations are not implemented. Original Maia demos were inspected in source rather than runtime-tested, and public catalog enumeration was not repeated. Production deployment on an actual Maia Edge host, Firefox/Safari/mobile acceptance, VFR/rotation/HDR coverage, representative 1080p performance and peak WASM memory benchmarks, and distribution of complete corresponding FFmpeg/core dependency sources remain release work. The application is a working MVP, not a claim that all four roadmap phases are complete.
