# Architecture decision log

| Date | Decision | Evidence | Consequence |
| --- | --- | --- | --- |
| 2026-09-24 | Local-first static browser application | Maia Platform browser creative tools and Maia Edge deployment | No mandatory server in MVP |
| 2026-09-24 | Versioned JSON edit model with microsecond time units | Need replayable edits and persistent projects | Media relink needed after reload |
| 2026-09-24 | Capability-gated export | Browser and FFmpeg WASM codecs depend on build | MP4 is offered only when supported |

| 2026-09-24 | Reference-only reuse of the eleven local Maia repositories | Pinned commits and root licenses in SOURCE_INVENTORY; older apps expose DOM state or callMain APIs | No wholesale app copying; implement typed model/worker adapter |
| 2026-09-24 | Pin @ffmpeg/core 0.12.10 separately from Apache app source | Local custom build enables nonfree; npm core declares GPL-2.0-or-later | Separate NOTICE; self-host pinned assets; retain distribution/source obligations |
| 2026-09-24 | Probe encoders and required filters in a dedicated worker | Chrome acceptance produces H.264/AAC output | No universal MP4 claim; offer VP8/Vorbis only after probe |
| 2026-09-24 | Rasterize title layers with the preview canvas routine | Avoid filter-text injection and browser/FFmpeg font disagreement | Same text layout in both backends; PNG layers exist only during export |
| 2026-09-24 | Integer microseconds, fixed speed 1, half-open intervals | Command tests cover split continuity and exact undo/redo | Browser seconds round to nearest integer microsecond; audio delays round to nearest 48 kHz sample; output video normalizes to rational fps |
| 2026-09-24 | AudioContext clock and 120 ms drift correction | Functional playback exercised; no VFR/frame-perfect proof | Label preview approximate; pause when tab hides |
| 2026-09-24 | Bounded, explicit waveform/thumbnail generation | Avoid whole-file decoding on normal import | 20 MiB/two-minute waveform limit, one visualization job at a time |
| 2026-09-24 | Single-thread core without isolation headers | @ffmpeg/core package identifies single-thread build | No COOP/COEP dependency; static root deployment |
| 2026-09-24 | Vite 6.4.3 pinned | npm audit identified vulnerabilities in 6.4.1; 6.4.3 audit clean | Reproducible lockfile; dev host is loopback |
| 2026-09-24 | Use VP8/Vorbis for WebM, not the failing Opus path | Full render with libopus repeatedly trapped out-of-bounds; same graph with libvorbis passed; isolated lavfi Opus smoke alone did not reproduce | Encoder-list checks are insufficient evidence for a whole render; regression test real graph, reset worker per export, force one encoder thread |

Related upstream reports: [Opus trap #591](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/591) and [48 kHz Opus trap #867](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/867). These are context; the codec choice is based on the local reproduction and passing Vorbis export, not an assumption that these reports prove the same root cause.

| 2026-09-24 | Relative Vite asset base and FFmpeg URLs under document base | Maia Edge serves apps under /maia-reel/ | Static Nginx deployment; no Node service or new port. |

- Internationalization uses a local TypeScript message catalog (English, Portuguese, Spanish) and explicit text/attribute bindings. The initial interface is bound before user content is rendered; subsequent messages register their source text. Language changes update bindings without rebuilding the editor or modifying project/history state. Preference is stored independently in `maiaReelLanguage`, with browser-language detection and English fallback. No translation service or new dependency is required.

- Chroma key is an optional per-clip `chromaKey` on video tracks, exported with FFmpeg `chromakey` (yuva420p, transparent letterbox) and previewed with the same UV-distance formula per pixel (FFmpeg averages 3×3, so edges may differ slightly). Keyed clips reveal lower video tracks; a "+ Video track" button provides the background layer.
