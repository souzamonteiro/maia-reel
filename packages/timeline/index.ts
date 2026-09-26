import {
  validate,
  uid,
  type Project,
  type Asset,
  type Clip,
  type ChromaKey,
  type Transition,
  type Title,
  type Track,
} from "../project";
export type Command =
  | { type: "addAsset"; asset: Asset }
  | { type: "addTrack"; track: Track }
  | { type: "insertClip"; trackId: string; clip: Clip }
  | { type: "moveClip"; id: string; startUs: number }
  | {
      type: "trimClip";
      id: string;
      sourceInUs: number;
      sourceOutUs: number;
      startUs?: number;
    }
  | { type: "splitClip"; id: string; atUs: number; newId?: string }
  | { type: "setGain"; id: string; gain: number }
  | { type: "setTransition"; id: string; transition?: Transition }
  | { type: "setChromaKey"; id: string; chromaKey?: ChromaKey }
  | { type: "mute"; trackId: string; muted: boolean }
  | { type: "raiseTrack"; trackId: string; aboveId: string }
  | { type: "deleteClip"; id: string }
  | { type: "addTitle"; title: Title }
  | { type: "deleteTitle"; id: string };
export function command(project: Project, cmd: Command): Project {
  const p = structuredClone(project);
  if (cmd.type === "addAsset") p.assets.push(cmd.asset);
  else if (cmd.type === "addTrack") p.tracks.push(cmd.track);
  else if (cmd.type === "addTitle") p.titles.push(cmd.title);
  else if (cmd.type === "deleteTitle")
    p.titles = p.titles.filter((t) => t.id !== cmd.id);
  else if (cmd.type === "raiseTrack") {
    const up = p.tracks.find((t) => t.id === cmd.trackId);
    const down = p.tracks.find((t) => t.id === cmd.aboveId);
    if (!up || !down) throw Error("Faixa inexistente.");
    const lo = Math.min(up.zIndex, down.zIndex);
    const hi = Math.max(up.zIndex, down.zIndex, lo + 1);
    up.zIndex = hi;
    down.zIndex = lo;
  } else if (cmd.type === "insertClip" || cmd.type === "mute") {
    const t = p.tracks.find((t) => t.id === cmd.trackId);
    if (!t) throw Error("Faixa inexistente.");
    if (cmd.type === "mute") t.muted = cmd.muted;
    else t.clips.push(cmd.clip);
  } else {
    const t = p.tracks.find((t) => t.clips.some((c) => c.id === cmd.id));
    const c = t?.clips.find((c) => c.id === cmd.id);
    if (!t || !c) throw Error("Clipe inexistente.");
    switch (cmd.type) {
      case "moveClip":
        c.startUs = cmd.startUs;
        break;
      case "trimClip":
        c.sourceInUs = cmd.sourceInUs;
        c.sourceOutUs = cmd.sourceOutUs;
        if (cmd.startUs !== undefined) c.startUs = cmd.startUs;
        break;
      case "setTransition":
        if (cmd.transition !== undefined) c.transition = { ...cmd.transition };
        else delete c.transition;
        break;
      case "setGain":
        c.gain = cmd.gain;
        break;
      case "setChromaKey":
        if (cmd.chromaKey) c.chromaKey = { ...cmd.chromaKey };
        else delete c.chromaKey;
        break;
      case "deleteClip":
        t.clips = t.clips.filter((c) => c.id !== cmd.id);
        for (const remaining of t.clips)
          if (remaining.transition?.previousId === cmd.id)
            delete remaining.transition;
        break;
      case "splitClip": {
        const offset = cmd.atUs - c.startUs;
        if (offset <= 0 || offset >= c.sourceOutUs - c.sourceInUs)
          throw Error("Divida dentro do clipe.");
        const newId = cmd.newId ?? uid();
        for (const next of t.clips)
          if (next.transition?.previousId === c.id)
            next.transition.previousId = newId;
        const right = {
          ...c,
          id: newId,
          startUs: cmd.atUs,
          sourceInUs: c.sourceInUs + offset,
        };
        delete right.transition;
        t.clips.push(right);
        c.sourceOutUs = c.sourceInUs + offset;
        break;
      }
    }
  }
  return validate(p);
}
export class History {
  project: Project;
  private past: Project[] = [];
  private future: Project[] = [];
  constructor(p: Project) {
    this.project = validate(p);
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  execute(cmd: Command) {
    const next = command(this.project, cmd);
    this.past.push(this.project);
    if (this.past.length > 100) this.past.shift();
    this.project = next;
    this.future = [];
  }
  undo() {
    const p = this.past.pop();
    if (p) {
      this.future.push(this.project);
      this.project = p;
    }
  }
  redo() {
    const p = this.future.pop();
    if (p) {
      this.past.push(this.project);
      this.project = p;
    }
  }
}
export const clipEnd = (clip: Clip) =>
  clip.startUs + clip.sourceOutUs - clip.sourceInUs;
export function evaluate(p: Project, timeUs: number) {
  return {
    clips: [...p.tracks]
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
      .flatMap((track) =>
        track.clips
          .filter((c) => timeUs >= c.startUs && timeUs < clipEnd(c))
          .map((clip) => {
            const effect = transitionAt(track, clip, timeUs);
            return {
              track,
              clip,
              sourceUs: clip.sourceInUs + timeUs - clip.startUs,
              gain: track.muted ? 0 : clip.gain * effect.audioGain,
              fade: effect.fade,
            };
          }),
      ),
    titles: p.titles.filter((t) => timeUs >= t.startUs && timeUs < t.endUs),
  };
}
export function snap(
  p: Project,
  timeUs: number,
  exceptId: string,
  thresholdUs = 100000,
) {
  const points = [
    0,
    ...p.tracks.flatMap((t) =>
      t.clips
        .filter((c) => c.id !== exceptId)
        .flatMap((c) => [c.startUs, clipEnd(c)]),
    ),
  ];
  return (
    points
      .filter((x) => Math.abs(x - timeUs) <= thresholdUs)
      .sort((a, b) => Math.abs(a - timeUs) - Math.abs(b - timeUs))[0] ?? timeUs
  );
}

/** Relative fade intervals are shared by the preview and export backends. */
export function transitionWindows(track: Track, clip: Clip) {
  const incoming = clip.transition;
  const outgoing = track.clips.find(
    (c) => c.transition?.previousId === clip.id,
  )?.transition;
  const length = clip.sourceOutUs - clip.sourceInUs;
  return [
    ...(incoming
      ? [
          {
            type: "in" as const,
            startUs: 0,
            durationUs: incoming.durationUs / 2,
            transition: incoming,
          },
        ]
      : []),
    ...(outgoing
      ? [
          {
            type: "out" as const,
            startUs: length - outgoing.durationUs / 2,
            durationUs: outgoing.durationUs / 2,
            transition: outgoing,
          },
        ]
      : []),
  ];
}
export function transitionAt(track: Track, clip: Clip, timeUs: number) {
  const localUs = timeUs - clip.startUs;
  let audioGain = 1;
  let fade: { color: "black" | "white"; amount: number } | undefined;
  for (const window of transitionWindows(track, clip)) {
    if (
      localUs < window.startUs ||
      localUs > window.startUs + window.durationUs
    )
      continue;
    const progress = (localUs - window.startUs) / window.durationUs;
    const amount = window.type === "in" ? 1 - progress : progress;
    if (window.transition.audio) audioGain *= 1 - amount;
    if (window.transition.video !== "none")
      fade = { color: window.transition.video, amount };
  }
  return { audioGain, fade };
}
