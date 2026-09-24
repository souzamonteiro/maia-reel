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
