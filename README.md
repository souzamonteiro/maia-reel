# Maia Reel

A local-first, browser-based video editor for the Maia Platform ecosystem. Edit video, audio, still images, titles and captions on a single non-destructive timeline, then export a finished file. **Status: architecture and implementation plan; the editor has not yet been implemented.**

## Product promise

A creator can import footage, arrange and trim clips, add music and a title, adjust audio, save a project, reopen it, and export an MP4. Media stays on the creator's machine unless they explicitly choose a future remote service. No login is required.

## Scope

The first release targets desktop Chromium on Ubuntu 24.04 with a responsive browser UI. The app is served as static assets by Nginx and can be hosted on Maia Edge. Firefox and Safari require capability-based validation before any support claim. All browser codec and container combinations must be probed at runtime. No backend is needed for the MVP.

### MVP acceptance journey

1. Import two short H.264/AAC MP4 videos and one WAV/MP3 audio file from local disk; reject unsupported files with a useful message.
2. Put both videos sequentially on the primary video track, trim their ends, split one, move it and undo/redo.
3. Add the audio on an independent track, adjust gain and mute, and add a text title.
4. Play and scrub with image/audio approximately synchronized; save a project file, reload it and relink source media when needed.
5. Export an MP4 with H.264/AAC only if the installed export engine confirms both encoders; otherwise show a supported WebM option. Reimport the result and check duration, picture and audible sound.

## Architectural decisions

- TypeScript + Vite, native browser APIs and small UI modules; avoid a framework migration until demonstrated need.
- A versioned JSON project is the sole edit decision source. Source media are referenced, never embedded in project JSON.
- Integer time units: microseconds in the project model; rational frame rate `{numerator, denominator}`. UI pixel positions are projections of model time.
- A pure timeline evaluator resolves active clips and effects at a time instant. Preview and export share evaluation rules; where render backends differ, verify parity.
- Browser playback uses media elements, canvas and Web Audio. Export initially uses a worker-based FFmpeg WASM adapter. Do not assume an existing FFmpeg build supports a required codec; probe and test.
- Never decode or copy entire source files into memory by default. Use object URLs, thumbnails at sampled intervals and explicit cleanup. FFmpeg WASM export may still have memory limits; bound inputs and offer a clear failure.
- No AI feature is required for the first editor release. RNNoise and subtitle generation can be added through isolated adapters later.

## Repository layout

```
apps/editor/                 UI, panels, canvas and timeline interaction
packages/project/           schema, validation and migrations
packages/timeline/          commands, undo/redo, evaluator
packages/media/             import, probing, thumbnails, waveforms
packages/preview/           preview compositor and audio graph
packages/export/            render plan, FFmpeg WASM adapter, capability checks
packages/integrations/      optional Maia adapters
examples/                   small test fixtures and example project (no copyrighted media)
docs/                       architecture, inventory, roadmap, agent instructions
```

## Start here

Read `docs/SOURCE_INVENTORY.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_FORMAT.md`, `docs/ROADMAP.md` and `AGENTS.md` in that order. Phase 0 audits the existing Maia repositories; implementation starts only after inventory evidence is recorded. `docs/GEMINI_PROMPT.md` is the initial instruction to paste into Gemini. Commands below become active once the first implementation phase creates the Vite workspace: `npm install`, `npm run dev`, `npm test`, `npm run build`.

## License

Apache License 2.0; see `LICENSE`. Keep license notices and attribution for imported source or third-party packages. Verify compatibility and asset/model licenses before incorporation. Copyright 2026 Roberto Luiz Souza Monteiro and contributors.
