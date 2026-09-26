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

## Maia Edge subdirectory deployment — 2026-09-24

- `npm ci` completed with the lockfile; the first sandboxed attempt failed DNS,
  and the network-enabled retry succeeded.
- `npm run build`, nine unit tests and `npm run lint` passed.
- `npm run test:deployment` starts an isolated Nginx with the apps host's
  COOP/COEP/CORP headers and the app mounted at `/maia-reel/`. Chrome imported a
  generated red PNG, trimmed to one second, loaded the worker/core, exported MP4
  and decoded the result: 1280×720, 1 second, red center pixel. No page errors or
  HTTP requests outside the app prefix occurred. WASM MIME was application/wasm.
- The initial decoded-pixel check sampled before seeking; the acceptance check
  now explicitly seeks to the middle of the output before reading its center.
- Full original video/audio fixtures were not rerun: native ffmpeg is absent
  from this host's PATH. The new deployment test requires neither ffmpeg nor
  external media. This does not extend the existing audio/browser support claims.
- Live publication was not performed: `sudo -n true` requires an operator
  password. Run `./install.sh` to publish the tested build and portal.

### Internationalization verification

`npm run build`, `npm test` (11 passing), `npm run lint` and `npm run test:deployment` passed. The Nginx/Chrome journey verifies browser Portuguese detection, English selection surviving reload, Spanish playback labels, preservation of unsaved title/trim input and clip labels across switching, followed by successful import/export/redecode (1-second MP4, 1280×720). Unit tests verify locale fallback, matching catalog placeholders and preservation of user arguments. Existing media browser fixtures were not rerun; this test generates its own image without native FFmpeg. Production installation still requires the operator to run `./install.sh` with sudo access.

## Inspector layout and optional transitions — 2026-09-26

- `npm test`: 19 tests passed, including round-trip serialization, exact undo/redo, rejection of invalid/broken transition boundaries, audio-only effects/mute, chained duration limits and splitting/deletion behavior.
- `npm run build`, `npm run lint`, `git diff --check`: passed.
- `npm run test:transitions`: passed in local Chrome. The test starts Vite, generates two PNG images and a 440 Hz PCM WAV, applies effects through the editor, checks language switching and undo/redo, saves JSON, samples preview pixels and Web Audio gains, exports MP4, and independently decodes picture/audio using browser decoders.
- Layout checks at 1440×900, 1280×720, 1024×768, 800×800 and 390×844 confirm the timeline starts within the viewport; desktop inspector/preview bottoms align, panels scroll, and expanding/collapsing titles does not shift the timeline. Visually reviewed `test-results/transitions-layout.png`.
- Both dip-to-white and dip-to-black outputs are exactly 4 seconds. At the cut their sampled RGB values are respectively `[255,255,255]` and `[0,0,0]`. Decoded RMS amplitude is about 0.1228 away from the transition, 0.0613 halfway through the fade, and 0.00145 in the 20 ms window centered on the cut (AAC and the finite measurement window prevent an exact zero measurement).
- Additional actual preview/export checks confirm that transparent PNG pixels and chroma-key holes continue to reveal a blue lower track while the opaque foreground fades to white.
- `npm run test:deployment`: passed the existing Nginx subdirectory, language persistence and one-second MP4 export/redecode journey. The final subsequent changes preserve transparent pixels and exact split serialization; the transition browser suite was rerun after those changes.

Changed files: `apps/editor/main.ts`, `apps/editor/style.css`, `packages/project/index.ts`, `packages/timeline/index.ts`, `packages/preview/index.ts`, `packages/export/index.ts`, `packages/export/plan.ts`, `packages/i18n/catalog.ts`, `tests/project.test.ts`, `tests/transitions.mjs`, `package.json`, `README.md`, `docs/PROJECT_FORMAT.md`, `docs/DECISIONS.md`, and this report.

Artifacts remain ignored in `test-results/`. No deployment or installation was performed. The original external-fixture browser suite was not rerun; the new self-contained journey covers this change. Transitions currently dip through color/silence rather than overlap sources; true crossfades, additional effects, WebM-specific transition verification and other browser engines remain outside this slice. The next transition expansion should explicitly model source handles/overlap before implementing crossfades.
