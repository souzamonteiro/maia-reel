import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  validate,
  parseProject,
  duration,
  type Project,
} from "../packages/project";
import { command, History, evaluate, snap } from "../packages/timeline";
import { applyChromaKey } from "../packages/preview/chroma";
function fixture(): Project {
  const p = newProject();
  p.assets.push({
    id: "asset",
    kind: "video",
    displayName: "test.mp4",
    sizeBytes: 10,
    lastModifiedMs: 0,
    durationUs: 10e6,
  });
  p.tracks[0].clips.push({
    id: "clip",
    assetId: "asset",
    startUs: 0,
    sourceInUs: 1e6,
    sourceOutUs: 5e6,
    gain: 1,
  });
  return p;
}
test("serialization preserves schema and integer timing", () => {
  const p = fixture();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.equal(duration(p), 4e6);
});
test("rejects invalid references, versions, numbers, overlap and duplicate IDs", () => {
  for (const mutate of [
    (p: any) => (p.version = 2),
    (p: any) => (p.tracks[0].clips[0].assetId = "missing"),
    (p: any) => (p.tracks[0].clips[0].startUs = 0.5),
    (p: any) => (p.tracks[0].clips[0].gain = NaN),
    (p: any) => (p.tracks[0].clips[0].sourceOutUs = 11e6),
    (p: any) => p.assets.push(p.assets[0]),
    (p: any) =>
      p.tracks[0].clips.push({ ...p.tracks[0].clips[0], id: "other" }),
  ]) {
    const p = fixture();
    mutate(p);
    assert.throws(() => validate(p));
  }
});
test("split preserves continuity, duration and exact undo redo", () => {
  const p = fixture();
  const h = new History(p);
  h.execute({ type: "splitClip", id: "clip", atUs: 2e6, newId: "right" });
  const split = JSON.stringify(h.project);
  assert.equal(duration(h.project), duration(p));
  const [left, right] = h.project.tracks[0].clips;
  assert.equal(left.sourceOutUs, right.sourceInUs);
  assert.equal(evaluate(h.project, 2e6).clips[0].clip.id, "right");
  assert.equal(evaluate(h.project, 4e6).clips.length, 0);
  h.undo();
  assert.deepEqual(h.project, p);
  h.redo();
  assert.equal(JSON.stringify(h.project), split);
});
test("trim and move are immutable and reject overlap without damaging history", () => {
  const p = fixture();
  const next = command(p, {
    type: "trimClip",
    id: "clip",
    sourceInUs: 2e6,
    sourceOutUs: 4e6,
  });
  assert.equal(next.tracks[0].clips[0].sourceInUs, 2e6);
  assert.equal(p.tracks[0].clips[0].sourceInUs, 1e6);
  const h = new History(p);
  assert.throws(() =>
    h.execute({
      type: "trimClip",
      id: "clip",
      sourceInUs: 6e6,
      sourceOutUs: 5e6,
    }),
  );
  assert.deepEqual(h.project, p);
  assert.equal(h.canUndo, false);
  h.execute({ type: "moveClip", id: "clip", startUs: 1e6 });
  h.undo();
  h.execute({ type: "setGain", id: "clip", gain: 0.5 });
  assert.equal(h.canRedo, false);
});
test("chroma key is validated, undoable and survives split", () => {
  const p = fixture();
  const key = { color: "#00ff00", similarity: 0.15, blend: 0.1 };
  const h = new History(p);
  h.execute({ type: "setChromaKey", id: "clip", chromaKey: key });
  assert.deepEqual(parseProject(JSON.stringify(h.project)), h.project);
  h.execute({ type: "splitClip", id: "clip", atUs: 2e6, newId: "right" });
  assert.deepEqual(h.project.tracks[0].clips[1].chromaKey, key);
  h.undo();
  h.execute({ type: "setChromaKey", id: "clip" });
  assert.equal(h.project.tracks[0].clips[0].chromaKey, undefined);
  for (const bad of [
    { ...key, color: "green" },
    { ...key, similarity: 0 },
    { ...key, blend: 2 },
  ])
    assert.throws(() =>
      command(p, { type: "setChromaKey", id: "clip", chromaKey: bad }),
    );
});
test("raiseTrack reorders video layers used by evaluation", () => {
  const p = fixture();
  p.tracks.push({
    id: "v2",
    kind: "video",
    zIndex: 2,
    muted: false,
    clips: [{ ...p.tracks[0].clips[0], id: "top" }],
  });
  const ids = (q: Project) => evaluate(q, 1e6).clips.map((x) => x.clip.id);
  assert.deepEqual(ids(validate(p)), ["clip", "top"]);
  const next = command(p, { type: "raiseTrack", trackId: "v1", aboveId: "v2" });
  assert.deepEqual(ids(next), ["top", "clip"]);
});
test("chroma key alpha follows FFmpeg similarity and blend", () => {
  const key = { color: "#00ff00", similarity: 0.1, blend: 0.1 };
  const px = new Uint8ClampedArray([0, 255, 0, 255, 255, 255, 255, 255]);
  applyChromaKey(px, key);
  assert.equal(px[3], 0);
  assert.equal(px[7], 255);
});
test("audio overlaps mix and track mute preserves source gain", () => {
  const p = fixture();
  p.assets.push({ ...p.assets[0], id: "audio", kind: "audio" });
  p.tracks[1].clips = [
    { ...p.tracks[0].clips[0], id: "a", assetId: "audio" },
    { ...p.tracks[0].clips[0], id: "b", assetId: "audio" },
  ];
  const muted = command(validate(p), {
    type: "mute",
    trackId: "a1",
    muted: true,
  });
  assert.equal(evaluate(muted, 0).clips.length, 3);
  assert.equal(evaluate(muted, 0).clips[1].gain, 0);
  assert.equal(muted.tracks[1].clips[0].gain, 1);
});
test("titles obey half-open interval and refuse unsafe style", () => {
  const p = fixture();
  p.titles.push({
    id: "title",
    startUs: 0,
    endUs: 1e6,
    text: "Hello",
    style: { fontSize: 64, color: "#ffffff" },
  });
  assert.equal(evaluate(validate(p), 1e6).titles.length, 0);
  p.titles[0].style.color = "red;evil";
  assert.throws(() => validate(p));
});
test("snapping uses nearby edges only", () => {
  const p = fixture();
  assert.equal(snap(p, 4050000, "other"), 4e6);
  assert.equal(snap(p, 4500000, "other"), 4500000);
  assert.equal(snap(p, 4050000, "clip"), 4050000);
});

test("render plan shares active interval boundaries and track gains", async () => {
  const { createRenderPlan } = await import("../packages/export/plan");
  const p = fixture();
  const plan = createRenderPlan(p);
  const segment = plan.segments[0];
  assert.equal(
    evaluate(p, segment.endUs - 1).clips[0].sourceUs,
    segment.clip.sourceOutUs - 1,
  );
  assert.equal(evaluate(p, segment.endUs).clips.length, 0);
  assert.equal(plan.durationUs, duration(p));
});
test("new audio tracks are reversible and respect project limits", () => {
  const p = fixture();
  const history = new History(p);
  history.execute({
    type: "addTrack",
    track: { id: "music2", kind: "audio", zIndex: 2, muted: false, clips: [] },
  });
  assert.equal(history.project.tracks.length, 3);
  history.undo();
  assert.deepEqual(history.project, p);
});

test("optional cut transitions preserve timing, serialize, evaluate and undo", async () => {
  const p = command(fixture(), {
    type: "splitClip",
    id: "clip",
    atUs: 2e6,
    newId: "right",
  });
  const h = new History(p);
  const transition = {
    previousId: "clip",
    durationUs: 1e6,
    video: "black" as const,
    audio: true,
  };
  h.execute({ type: "setTransition", id: "right", transition });
  assert.equal(duration(h.project), duration(p));
  assert.deepEqual(parseProject(JSON.stringify(h.project)), h.project);
  for (const [time, amount] of [
    [1e6, 0],
    [1.75e6, 0.5],
    [2e6, 1],
    [2.25e6, 0.5],
    [3e6, 0],
  ]) {
    const active = evaluate(h.project, time).clips[0];
    assert.equal(active.fade?.amount ?? 0, amount);
    assert.equal(active.gain, 1 - amount);
  }
  const { createRenderPlan } = await import("../packages/export/plan");
  const plan = createRenderPlan(h.project);
  assert.deepEqual(
    plan.segments.map((s) =>
      s.transitions.map((w) => [w.type, w.startUs, w.durationUs]),
    ),
    [[["out", 1.5e6, 0.5e6]], [["in", 0, 0.5e6]]],
  );
  h.undo();
  assert.deepEqual(h.project, p);
  h.redo();
  assert.deepEqual(h.project.tracks[0].clips[1].transition, transition);
  h.execute({ type: "setTransition", id: "right" });
  assert.equal(evaluate(h.project, 2e6).clips[0].gain, 1);
  assert.equal(evaluate(h.project, 2e6).clips[0].fade, undefined);
});

test("transition validation rejects gaps, overlap, invalid durations and broken edits atomically", () => {
  const p = command(fixture(), {
    type: "splitClip",
    id: "clip",
    atUs: 2e6,
    newId: "right",
  });
  const transition = {
    previousId: "clip",
    durationUs: 1e6,
    video: "white" as const,
    audio: false,
  };
  for (const bad of [
    { ...transition, durationUs: NaN },
    { ...transition, durationUs: 0 },
    { ...transition, durationUs: 1.5 },
    { ...transition, durationUs: 5e6 },
    { ...transition, previousId: "right" },
    { ...transition, previousId: "missing" },
    { ...transition, video: "other" },
    { ...transition, video: "none" },
    null,
  ]) {
    assert.throws(() =>
      command(p, {
        type: "setTransition",
        id: "right",
        transition: bad as any,
      }),
    );
  }
  const h = new History(
    command(p, { type: "setTransition", id: "right", transition }),
  );
  const snapshot = JSON.stringify(h.project);
  assert.throws(() =>
    h.execute({ type: "moveClip", id: "right", startUs: 3e6 }),
  );
  assert.throws(() =>
    h.execute({
      type: "trimClip",
      id: "right",
      sourceInUs: 3e6,
      sourceOutUs: 3.1e6,
    }),
  );
  assert.equal(JSON.stringify(h.project), snapshot);
  assert.equal(h.canUndo, false);
  // Deletion removes the connected effect in the same reversible command.
  h.execute({ type: "deleteClip", id: "clip" });
  assert.equal(h.project.tracks[0].clips[0].transition, undefined);
  h.undo();
  assert.equal(JSON.stringify(h.project), snapshot);
});

test("splitting preserves external transitions without creating a new fade at the split", () => {
  let p = command(fixture(), {
    type: "splitClip",
    id: "clip",
    atUs: 2e6,
    newId: "right",
  });
  p = command(p, {
    type: "setTransition",
    id: "right",
    transition: {
      previousId: "clip",
      durationUs: 1e6,
      video: "black",
      audio: true,
    },
  });
  p = command(p, { type: "splitClip", id: "clip", atUs: 1e6, newId: "middle" });
  assert.equal(
    p.tracks[0].clips.find((c) => c.id === "right")?.transition?.previousId,
    "middle",
  );
  assert.equal(
    p.tracks[0].clips.find((c) => c.id === "middle")?.transition,
    undefined,
  );
  p = command(p, { type: "splitClip", id: "right", atUs: 3e6, newId: "last" });
  assert.equal(
    p.tracks[0].clips.find((c) => c.id === "last")?.transition,
    undefined,
  );
  assert.equal(evaluate(p, 2e6).clips[0].gain, 0);
});

test("audio-only transitions and mute operate independently of visual transitions", () => {
  const p = fixture();
  p.assets[0].kind = "audio";
  p.tracks[0].kind = "audio";
  let q = command(p, {
    type: "splitClip",
    id: "clip",
    atUs: 2e6,
    newId: "right",
  });
  const transition = {
    previousId: "clip",
    durationUs: 1e6,
    video: "none" as const,
    audio: true,
  };
  assert.throws(() =>
    command(q, {
      type: "setTransition",
      id: "right",
      transition: { ...transition, video: "black" },
    }),
  );
  q = command(q, { type: "setTransition", id: "right", transition });
  assert.equal(evaluate(q, 2.25e6).clips[0].gain, 0.5);
  assert.equal(evaluate(q, 2.25e6).clips[0].fade, undefined);
  q = command(q, { type: "mute", trackId: "v1", muted: true });
  assert.equal(evaluate(q, 2.25e6).clips[0].gain, 0);
});

test("neighboring transition windows cannot overlap within a short middle clip", () => {
  let p = command(fixture(), {
    type: "splitClip",
    id: "clip",
    atUs: 1e6,
    newId: "middle",
  });
  p = command(p, { type: "splitClip", id: "middle", atUs: 2e6, newId: "last" });
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  p = command(p, {
    type: "setTransition",
    id: "middle",
    transition: {
      previousId: "clip",
      durationUs: 1.5e6,
      video: "black",
      audio: true,
    },
  });
  assert.throws(() =>
    command(p, {
      type: "setTransition",
      id: "last",
      transition: {
        previousId: "middle",
        durationUs: 1e6,
        video: "white",
        audio: false,
      },
    }),
  );
});
