# Roadmap and acceptance gates

## Phase 0 — evidence and foundations

Audit Maia sources into SOURCE_INVENTORY; capture commit hashes/licenses/codecs. Create workspace, lint/build/test scripts, a tiny redistributable fixture generator, project schema tests and a capability screen. Gate: fresh clone builds, fixture license is clear, unsupported codec is named accurately.

## Phase 1 — vertical slice

Import one MP4, display preview, add one clip, trim it, save/reopen/relink and export a tested short result. Gate: output reimports with matching duration (within one output frame) and audible, synchronized source sound; if MP4 encoding is unavailable, expose supported WebM clearly.

## Phase 2 — core editor

Add second clip, split/move, snapping, basic multi-lane audio, gain/mute, undo/redo, title overlay, thumbnails/waveform. Gate: full README journey succeeds after page reload; title and audio appear in export; command invariants tested.

## Phase 3 — Maia integrations

Add audited adapters for chroma key, audio conversion and optional RNNoise. Add SRT import and editable captions; automated subtitle generation only after verifying the source implementation. Gate: individual toggles yield same documented effect in preview and export; turning off an effect preserves original media.

## Phase 4 — hardening and release

Cancellation, large-media diagnostics, worker recovery, keyboard/a11y review, browser matrix and Maia Edge Nginx deploy instructions. Benchmark representative 1080p fixtures and document export memory/time. Gate: reproducible build, notice file, no undisclosed external request, known limitations documented.

Every phase is a separate reviewable PR or small commit series. No feature is complete until a user-visible path and exported result are checked.

## Implementation checkpoint — 2026-09-24

- Phase 0: local source inventory, workspace, strict validation, fixtures, capability probe and license notices implemented. Original demo runtime checks/public catalog re-enumeration remain open.
- Phase 1: import/trim/preview/save/reload/relink and actual MP4 output/reimport covered by browser acceptance.
- Phase 2: two video clips, split/move/snapping, audio tracks/gain/mute, undo/redo, titles and on-demand thumbnails/waveforms implemented. Automated picture/audio/title output checks pass. See VERIFICATION for the limits of synchronization evidence.
- Phase 3: optional Maia adapters remain pending; no unsupported integration is advertised.
- Phase 4: cancellation/recovery, memory diagnostics, native accessible controls, no-external-request check and Nginx instructions implemented. Browser matrix, peak-memory/1080p benchmarks and release distribution review remain open.

Next smallest release task: test representative VFR and rotated phone footage and measure preview/export sync, then benchmark a short 1080p project before widening the browser support claim.
