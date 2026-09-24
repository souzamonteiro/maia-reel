# Instructions for coding agents

This repository is a specification starter. Follow the roadmap in order. Read the README and all docs before modifying code. Inspect the real Maia repositories before importing functionality; record paths, commit hashes, licenses and test evidence in `docs/SOURCE_INVENTORY.md`. The site descriptions are leads, not proof of usable APIs.

Work in small vertical slices. Every slice must run in the browser and include a meaningful verification of behavior. Do not mark a feature complete because its UI is visible. Prefer minimal dependencies, TypeScript, camelCase identifiers, English comments, accessible HTML and simple CSS. No Maven. Do not commit generated media, huge WASM binaries, source footage or credentials.

Preserve a single authoritative project model. Do not keep a parallel timeline state inside DOM nodes. Route all edits through validated commands with reversible undo/redo. Never silently change project schema or clip timing. Use shared evaluation rules for preview and export. Detect runtime capabilities and surface precise unsupported-format errors. Do not claim frame-perfect preview until demonstrated with VFR and mixed-frame-rate media.

At each phase: state plan; implement; run tests/build; manually verify the acceptance journey; update docs and `docs/DECISIONS.md`; report changed files, commands run, results and remaining gaps. If blocked, implement the smallest independently testable part and report the blocker. Do not replace existing Maia repositories or copy code across licenses without inventory review.
