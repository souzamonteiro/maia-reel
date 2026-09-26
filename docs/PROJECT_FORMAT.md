# Project format v1 (`.maiareel.json`)

The file holds editing decisions; footage remains external. All times are integer microseconds; frame rate is rational. Example is illustrative and must be validated by the implementation schema.

```json
{
  "format": "org.maiaplatform.maiareel.project",
  "version": 1,
  "id": "project-1",
  "name": "First edit",
  "canvas": { "width": 1920, "height": 1080, "frameRate": { "numerator": 30, "denominator": 1 } },
  "assets": [{ "id": "asset-1", "kind": "video", "displayName": "intro.mp4", "sizeBytes": 123456, "lastModifiedMs": 0, "durationUs": 10000000 }],
  "tracks": [{ "id": "v1", "kind": "video", "zIndex": 0, "muted": false, "clips": [{ "id": "clip-1", "assetId": "asset-1", "startUs": 0, "sourceInUs": 1000000, "sourceOutUs": 6000000, "gain": 1 }] }],
  "titles": [{ "id": "title-1", "startUs": 0, "endUs": 2000000, "text": "Hello Maia", "style": { "fontSize": 72, "color": "#ffffff" } }]
}
```

Audio clips use the same clip shape on `kind: audio` tracks. Video-track clips may carry an optional `chromaKey: { "color": "#00ff00", "similarity": 0.1, "blend": 0.05 }` (similarity in [0.01, 1], blend in [0, 1]) with FFmpeg `chromakey` semantics; keyed pixels reveal lower video tracks. A video clip's embedded audio is a linked sound source unless muted; export mixes it once. `gain` is linear amplitude in [0, 2] for v1. Reject duplicate ids, missing assets, negative/non-integer timestamps, sourceOut <= sourceIn, invalid dimensions/frame rate, unsafe or excessively long title text. Missing media may load as offline placeholders; export blocks until relinked. Never treat filename alone as a secure content identity. Backward migrations are pure functions and preserve unknown future versions by refusing to open them with an explanation.

## Optional transition extension (2026-09-26)

A v1 clip may now carry `transition: { previousId, durationUs, video, audio }`. Missing means a hard cut (existing v1 projects are unchanged). `previousId` identifies an explicitly adjacent clip on the same track; its end must equal the incoming clip's start. `durationUs` is an integer from 2,000 through 10,000,000; half is applied before and half after the cut. `video` is `none`, `black` or `white`; `audio` is boolean. At least one effect must be enabled, and audio tracks require `video: "none"`. Incoming plus outgoing fade halves may not exceed the clip length. A preceding clip can have only one outgoing transition. Noncontiguous or invalid references are rejected, including edits that break these invariants.

The visual effect linearly blends the clip toward the selected color while preserving keyed alpha, and the audio envelope linearly reduces amplitude to silence at the cut, then restores it. Titles and unrelated tracks are unaffected. This extension must be opened with a transition-aware editor to preserve rendering semantics; older editor builds do not implement these effects.
