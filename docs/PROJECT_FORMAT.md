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

Audio clips use the same clip shape on `kind: audio` tracks. A video clip's embedded audio is a linked sound source unless muted; export mixes it once. `gain` is linear amplitude in [0, 2] for v1. Reject duplicate ids, missing assets, negative/non-integer timestamps, sourceOut <= sourceIn, invalid dimensions/frame rate, unsafe or excessively long title text. Missing media may load as offline placeholders; export blocks until relinked. Never treat filename alone as a secure content identity. Backward migrations are pure functions and preserve unknown future versions by refusing to open them with an explanation.
