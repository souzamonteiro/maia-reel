# Architecture

## Data flow

Import -> media registry -> project commands -> timeline evaluator -> preview compositor/audio graph. The same project snapshot -> export planner -> FFmpeg WASM worker -> downloadable output. Import and project save stay local.

### Module contracts

- `project`: parse, validate and migrate versioned JSON; ids stable across save/load. Reject invalid references and non-finite times.
- `media`: file handles/object URLs and metadata; previewability is distinct from exportability. Relink assets by persistent id plus name/size/last-modified fingerprint, with user confirmation.
- `timeline`: immutable operations (`addAsset`, `insertClip`, `moveClip`, `trimClip`, `splitClip`, `setGain`, `addTitle`, `deleteClip`) returning next project and inverse/history entry. Validate intervals and overlaps.
- `preview`: resolve visible items at time t, compose lower-to-higher video tracks, schedule audio clips through gain nodes. Hide/unmount cleans up media elements, nodes and URLs.
- `export`: compile project into an explicit render plan: normalize sources, trim, set presentation timestamps, overlay titles and mix audio, encode/mux; run in worker with progress, cancellation and cleanup. Escaping of filenames/FFmpeg filter parameters is mandatory.
- `integrations`: adapters may invoke Maia functionality after license/capability audit; they never mutate timeline data directly.

## Editing invariants

Half-open intervals `[startUs, endUs)`; `durationUs = (sourceOutUs-sourceInUs)/speed` rounded by one documented policy. Initial MVP fixes speed at 1.0. Source range must lie within probed duration. Video clips cannot overlap on the primary lane except an explicitly modeled transition. Audio lanes may overlap and mix. At any time, active tracks are ordered by `zIndex`, stable by id. Splitting preserves source continuity, transforms and total project duration. Undo and redo restore exact serialized snapshots for tested commands.

## Sync, media and resource policy

Use an explicit playback clock, avoid re-seeking a video element on every animation frame, and re-anchor after pause/seek; track drift and correct above a measured threshold. Document audio as the preferred playback clock when available. VFR timestamps must be normalized for export; do not assume frame index equals source timestamp. Bound concurrent decoders, thumbnail jobs and export memory. Blob URLs and audio nodes need lifecycle ownership. Import should handle rotation metadata or report an unsupported case. Provide cancellation for long jobs and detect page reload during unsaved work.

## Security and deployment

No upload endpoint. Validate JSON shape, size and MIME signatures where practical; render title text as text rather than HTML; never eval project content. Serve WASM and workers with correct MIME. Only use COOP/COEP if the selected FFmpeg build actually needs threads/SharedArrayBuffer, and verify isolation plus cross-origin assets under Maia Edge Nginx. Pin dependencies and review license notices. The exporter must not silently fall back to a format extension that mismatches the encoded streams.

## Scope boundary

MVP: import, basic timeline, preview, two video clips, audio track, title, save/relink, undo/redo and tested export. Later: chroma key, transitions, multiple video layers, subtitles, recording, RNNoise, proxies, keyframes and optional server render. These are not prerequisites for the first working end-to-end slice.
