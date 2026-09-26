import {
  duration,
  validate,
  type Project,
  type Title,
  type TitlePosition,
} from "../project";
import { clipEnd, transitionWindows } from "../timeline";

/** Build the x/y position expressions for an FFmpeg drawtext filter. */
function drawtextPosition(pos: TitlePosition | undefined): string {
  switch (pos) {
    case "top":
      return "x=(main_w-text_w)/2:y=main_h*0.10";
    case "center":
      return "x=(main_w-text_w)/2:y=(main_h-text_h)/2";
    case "top-left":
      return "x=main_w*0.05:y=main_h*0.10";
    case "top-right":
      return "x=main_w*0.95-text_w:y=main_h*0.10";
    case "bottom-left":
      return "x=main_w*0.05:y=main_h*0.90-text_h";
    case "bottom-right":
      return "x=main_w*0.95-text_w:y=main_h*0.90-text_h";
    case "bottom":
    default:
      return "x=(main_w-text_w)/2:y=main_h*0.90-text_h";
  }
}

/**
 * Build the drawtext filter option string for a title.
 * The returned string omits `enable=` — callers must append it.
 */
export function titleDrawtextArgs(t: Title): string {
  const family = t.style.fontFamily ?? "Arial";
  const weight = t.style.fontWeight === "bold" ? " Bold" : "";
  const italic = t.style.fontStyle === "italic" ? " Italic" : "";
  const fontName = `${family}${weight}${italic}`;

  // Escape single quotes and colons in text for the filter graph.
  const escapedText = t.text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:");

  const align = t.style.align ?? "center";
  const pos = drawtextPosition(t.style.position);

  return (
    `font='${fontName}':fontsize=${t.style.fontSize}:fontcolor=${t.style.color}` +
    `:text='${escapedText}':${pos}:text_align=${align}` +
    `:shadowcolor=black:shadowx=2:shadowy=2`
  );
}

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
          transitions: transitionWindows(track, clip),
          gain: track.muted ? 0 : clip.gain,
          asset: p.assets.find((a) => a.id === clip.assetId)!,
        })),
      ),
    titles: p.titles,
  };
}
