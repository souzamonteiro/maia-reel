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
