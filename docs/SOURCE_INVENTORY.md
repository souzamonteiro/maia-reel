# Maia source inventory and reuse gate

Catalog checked 2026-09-24: https://www.maiaplatform.org/. Descriptions below are from the public catalog, except the video editor README. **Inspect current source and actual license before copying.** Enter repository URL, pinned commit, relevant files, runtime assumptions, license, compatibility and reuse decision in the table during Phase 0.

| Candidate | Publicly described capability | Intended role | Audit result |
| --- | --- | --- | --- |
| https://github.com/souzamonteiro/videoeditorwebapp | Browser video trim, chroma key, canvas preview, MediaRecorder export | UI/algorithm reference; audit export reliability | Pending |
| FFmpeg WASM Browser (follow project link at maiaplatform.org) | Browser media processing with FFmpeg WASM | Inspect build and export adapter | Pending |
| Audio Converter Web App (catalog link) | Browser audio conversion | Format handling ideas | Pending |
| Camera Recorder Web App (catalog link) | Browser camera capture | Later import/capture integration | Pending |
| Screen Recorder Web App (catalog link) | Browser screen capture | Later capture integration | Pending |
| Browser Video Toolkit (catalog link) | Editor, converter, mixer, extractor, title/timeline tools | Audit each actual repo and reusable modules | Pending |
| RNNoise Tools (catalog link) | Native/JS noise suppression | Optional audio effect after MVP | Pending |
| Subtitles Generator (catalog link) | Browser subtitle workflow | Later subtitle import/generation | Pending |
| Maia Recorder (catalog link) | Recording tools | Later capture integration | Pending |

Phase 0 checklist: enumerate exact repository links from site HTML; inspect README, LICENSE and source trees; run demos or minimal smoke tests; document code worth importing versus rewriting; check core build origin and distribution rights; document FFmpeg codecs/encoders with actual probe; record any LGPL/GPL dependencies separately. Do not infer that all tools share the same implementation or license. Do not import entire apps wholesale.

| Repository | Commit | File/module | License | Observed behavior | Integration decision |
| --- | --- | --- | --- | --- | --- |
| Pending | Pending | Pending | Pending | Pending | Pending |

## Local source audit — 2026-09-24

Read the README, root license and implementation references in each checkout. These are source observations, not claims that the original demos passed runtime tests. No application source was copied.

| Repository | Pinned commit | Inspected implementation | License / decision |
| --- | --- | --- | --- |
| [audioconverterwebapp](https://github.com/souzamonteiro/audioconverterwebapp.git) | `ef00876d1acb10fbd79f30169a536e8088f44a0a` | `../audioconverterwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [videoaudioextractorwebapp](https://github.com/souzamonteiro/videoaudioextractorwebapp.git) | `efadeb201e31c827a3f14979753bccee8dc3f006` | `../videoaudioextractorwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [videoeditorwebapp](https://github.com/souzamonteiro/videoeditorwebapp) | `420bda24f1285a0a6adefc667c2ecedb0c70ef4e` | `../videoeditorwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [videotimelineeditorwebapp](https://github.com/souzamonteiro/videotimelineeditorwebapp.git) | `1eb9deb2558d603f9c574ebeec885913aef0a0fc` | `../videotimelineeditorwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [videoaudiomixerwebapp](https://github.com/souzamonteiro/videoaudiomixerwebapp.git) | `9a2313d760372ca9d02e0447c61a881cd9f3a2cc` | `../videoaudiomixerwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [videotitlemakerwebapp](https://github.com/souzamonteiro/videotitlemakerwebapp.git) | `11e8e84d7e13ccfa2669653e6cd14a72888d5b26` | `../videotitlemakerwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [ffmpeg-wasm-browser](https://github.com/souzamonteiro/ffmpeg-wasm-browser) | `676030bb6016e8882d2f535f005699c710d5032e` | `../ffmpeg-wasm-browser/build.sh, dist/ffmpeg.js` | Apache-2.0 wrapper; build enables GPL, nonfree and version3. Do not redistribute this binary; actual encoders unverified. |
| [videoconverterwebapp](https://github.com/souzamonteiro/videoconverterwebapp) | `157a1b552808c073a0c09fe1c218e3c8f451ed02` | `../videoconverterwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [screenrecorderwebapp](https://github.com/souzamonteiro/screenrecorderwebapp) | `4dd46ceb898cf67b1d004d5acd9a97d72d65e51e` | `../screenrecorderwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [camerarecorderwebapp](https://github.com/souzamonteiro/camerarecorderwebapp) | `d398a6c2cf8b016b043c246f9d0b42aaa828716a` | `../camerarecorderwebapp/www/index.html` | Apache-2.0 root license; reference only. New typed implementation. |
| [rnnoise-js](https://github.com/souzamonteiro/rnnoise-js) | `dc5c4b4874347928d694efcf146fafaafa3a4070` | `../rnnoise-js/rnnoise_wrapper.c, rnnoise-node.js` | Apache-2.0 root license; reference only, isolated adapter deferred. |

Timeline/title/mixer apps use canvas + MediaRecorder, with real-time capture. Converter/extractor apps call an Emscripten `createFFmpeg` / `callMain` API, incompatible with the newer worker API without an adapter. Title-maker README advertises MIT but its actual root LICENSE is Apache-2.0; no source copied. Recording and RNNoise integrations remain outside the MVP. Public catalog enumeration and original demo smoke tests remain unverified; exact local Git remotes above replace catalog guesses.

Export decision: install pinned `@ffmpeg/ffmpeg` 0.12.15 (MIT wrapper) and `@ffmpeg/core` 0.12.10 (GPL FFmpeg core); self-host assets, retain separate third-party notices, probe encoders/filters at runtime. Never infer codec support from file extensions or README claims.

Runtime evidence for the newly implemented adapter: Chrome acceptance confirms `libx264` + `aac` and `libvpx` + `libvorbis` using actual composed outputs. The npm core's Opus path failed on the composed test; listing it as an available encoder was insufficient. See `docs/VERIFICATION.md`. Runtime checks do not establish that the older custom Maia core can be redistributed; it remains unused.
