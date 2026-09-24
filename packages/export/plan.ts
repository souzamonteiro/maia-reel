import { duration, validate, type Project } from "../project";
import { clipEnd } from "../timeline";
/** Stable, validated source intervals shared with the preview evaluator. */
export function createRenderPlan(project: Project) {
  const p = validate(project);
  return {
    project: p,
    durationUs: duration(p),
    segments: [...p.tracks]
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
      .flatMap((track) =>
        track.clips.map((clip) => ({
          track,
          clip,
          endUs: clipEnd(clip),
          gain: track.muted ? 0 : clip.gain,
          asset: p.assets.find((a) => a.id === clip.assetId)!,
        })),
      ),
    titles: p.titles,
  };
}
