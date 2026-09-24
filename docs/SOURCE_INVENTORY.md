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
