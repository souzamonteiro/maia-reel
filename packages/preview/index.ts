import { duration, type Project, type Title, type TitlePosition } from "../project";
import { evaluate } from "../timeline";
import { MediaRegistry } from "../media";
/** Map a position preset to canvas X/Y coordinates. */
function titleXY(
  pos: TitlePosition | undefined,
  width: number,
  height: number,
): { x: number; y: number } {
  switch (pos) {
    case "top":        return { x: width * 0.5, y: height * 0.1 };
    case "center":     return { x: width * 0.5, y: height * 0.5 };
    case "top-left":   return { x: width * 0.05, y: height * 0.1 };
    case "top-right":  return { x: width * 0.95, y: height * 0.1 };
    case "bottom-left":  return { x: width * 0.05, y: height * 0.9 };
    case "bottom-right": return { x: width * 0.95, y: height * 0.9 };
    case "bottom":
    default:           return { x: width * 0.5, y: height * 0.9 };
  }
}
export function paintTitle(
  ctx: CanvasRenderingContext2D,
  t: Title,
  width: number,
  height: number,
) {
  const family = t.style.fontFamily ?? "Arial";
  const weight = t.style.fontWeight ?? "normal";
  const italic = t.style.fontStyle === "italic" ? "italic " : "";
  ctx.font = `${italic}${weight} ${t.style.fontSize}px ${family}`;
  ctx.textAlign = t.style.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = t.style.color;
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  const { x, y } = titleXY(t.style.position, width, height);
  const lines = t.text.split("\n");
  lines.forEach((line, i) =>
    ctx.fillText(
      line,
      x,
      y + (i - (lines.length - 1) / 2) * t.style.fontSize * 1.2,
      width * 0.9,
    ),
  );
  ctx.shadowBlur = 0;
}
type Player = {
  el: HTMLVideoElement;
  node: MediaElementAudioSourceNode;
  gain: GainNode;
};
export class Preview {
  private ctx: CanvasRenderingContext2D;
  private audio?: AudioContext;
  private players = new Map<string, Player>();
  private images = new Map<string, HTMLImageElement>();
  private frame = 0;
  private anchor = 0;
  private overload = false;
  private base = 0;
  timeUs = 0;
  playing = false;
  onTime: (t: number) => void = () => {};
  onError: (e: unknown) => void = () => {};
  constructor(
    private canvas: HTMLCanvasElement,
    private project: () => Project,
    private registry: MediaRegistry,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.loop();
  }
  private clock() {
    return this.audio?.currentTime ?? performance.now() / 1000;
  }
  async play() {
    this.audio ??= new AudioContext();
    await this.audio.resume();
    if (this.timeUs >= duration(this.project())) this.timeUs = 0;
    this.base = this.timeUs;
    this.anchor = this.clock();
    this.playing = true;
  }
  pause() {
    this.playing = false;
    for (const p of this.players.values()) p.el.pause();
  }
  seek(us: number) {
    this.timeUs = Math.max(0, Math.min(us, duration(this.project())));
    this.base = this.timeUs;
    this.anchor = this.clock();
    this.onTime(this.timeUs);
  }
  reset() {
    this.pause();
    for (const p of this.players.values()) {
      p.el.pause();
      p.el.removeAttribute("src");
      p.el.load();
      p.node.disconnect();
      p.gain.disconnect();
    }
    this.players.clear();
    this.images.clear();
    this.seek(0);
  }
  dispose() {
    this.reset();
    cancelAnimationFrame(this.frame);
    void this.audio?.close();
  }
  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    const p = this.project();
    if (this.playing) {
      this.timeUs = Math.round(this.base + (this.clock() - this.anchor) * 1e6);
      if (this.timeUs >= duration(p)) {
        this.timeUs = duration(p);
        this.pause();
      }
      this.onTime(this.timeUs);
    }
    if (
      this.canvas.width !== p.canvas.width ||
      this.canvas.height !== p.canvas.height
    ) {
      this.canvas.width = p.canvas.width;
      this.canvas.height = p.canvas.height;
    }
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const active = evaluate(p, this.timeUs);
    if (
      active.clips.filter(
        (c) => p.assets.find((a) => a.id === c.clip.assetId)?.kind !== "image",
      ).length > 8
    ) {
      this.pause();
      if (!this.overload) {
        this.onError(
          Error(
            "Prévia limitada a 8 clipes de áudio/vídeo simultâneos. Reduza as sobreposições.",
          ),
        );
        this.overload = true;
      }
      return;
    }
    this.overload = false;
    const live = new Set(active.clips.map((x) => x.clip.id));
    for (const [id, player] of this.players)
      if (!live.has(id)) {
        player.el.pause();
        player.el.removeAttribute("src");
        player.el.load();
        player.node.disconnect();
        player.gain.disconnect();
        this.players.delete(id);
      }
    for (const item of active.clips) {
      const entry = this.registry.entries.get(item.clip.assetId);
      if (!entry) continue;
      const asset = p.assets.find((a) => a.id === item.clip.assetId)!;
      if (asset.kind === "image") {
        let img = this.images.get(asset.id);
        if (!img) {
          img = new Image();
          img.src = entry.url;
          this.images.set(asset.id, img);
        }
        if (img.complete && img.naturalWidth)
          this.draw(img, img.naturalWidth, img.naturalHeight);
        continue;
      }
      let player = this.players.get(item.clip.id);
      if (!player) {
        this.audio ??= new AudioContext();
        const el = document.createElement("video");
        el.playsInline = true;
        el.preload = "auto";
        el.src = entry.url;
        const node = this.audio.createMediaElementSource(el);
        const gain = this.audio.createGain();
        node.connect(gain).connect(this.audio.destination);
        player = { el, node, gain };
        this.players.set(item.clip.id, player);
      }
      const { el, gain } = player;
      gain.gain.value = item.gain;
      const target = item.sourceUs / 1e6;
      if (
        el.readyState >= 1 &&
        !el.seeking &&
        Math.abs(el.currentTime - target) > (this.playing ? 0.12 : 0.015)
      )
        el.currentTime = target;
      if (this.playing && el.paused && el.readyState >= 2)
        void el.play().catch((e) => {
          this.pause();
          this.onError(e);
        });
      else if (!this.playing && !el.paused) el.pause();
      if (asset.kind === "video" && el.readyState >= 2)
        this.draw(el, el.videoWidth, el.videoHeight);
    }
    for (const t of active.titles)
      paintTitle(ctx, t, this.canvas.width, this.canvas.height);
  };
  private draw(source: CanvasImageSource, w: number, h: number) {
    const scale = Math.min(this.canvas.width / w, this.canvas.height / h);
    this.ctx.drawImage(
      source,
      (this.canvas.width - w * scale) / 2,
      (this.canvas.height - h * scale) / 2,
      w * scale,
      h * scale,
    );
  }
}
