import {
  duration,
  type ChromaKey,
  type Project,
  type Title,
  type TitlePosition,
} from "../project";
import { evaluate } from "../timeline";
import { MediaRegistry } from "../media";
import { applyChromaKey } from "./chroma";
/** Map a position preset to canvas X/Y coordinates. */
function titleXY(
  pos: TitlePosition | undefined,
  width: number,
  height: number,
): { x: number; y: number } {
  switch (pos) {
    case "top":
      return { x: width * 0.5, y: height * 0.1 };
    case "center":
      return { x: width * 0.5, y: height * 0.5 };
    case "top-left":
      return { x: width * 0.05, y: height * 0.1 };
    case "top-right":
      return { x: width * 0.95, y: height * 0.1 };
    case "bottom-left":
      return { x: width * 0.05, y: height * 0.9 };
    case "bottom-right":
      return { x: width * 0.95, y: height * 0.9 };
    case "bottom":
    default:
      return { x: width * 0.5, y: height * 0.9 };
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
  private layerCanvas?: HTMLCanvasElement;
  private keyCanvas?: HTMLCanvasElement;
  private keyCtx?: CanvasRenderingContext2D;
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
          this.draw(
            img,
            img.naturalWidth,
            img.naturalHeight,
            item.clip.chromaKey,
            item.fade,
          );
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
        this.draw(
          el,
          el.videoWidth,
          el.videoHeight,
          item.clip.chromaKey,
          item.fade,
        );
    }
    for (const t of active.titles)
      paintTitle(ctx, t, this.canvas.width, this.canvas.height);
  };
  private rect(w: number, h: number) {
    const scale = Math.min(this.canvas.width / w, this.canvas.height / h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    return {
      scale,
      dw,
      dh,
      x: Math.round((this.canvas.width - dw) / 2),
      y: Math.round((this.canvas.height - dh) / 2),
    };
  }
  private draw(
    source: CanvasImageSource,
    w: number,
    h: number,
    key?: ChromaKey,
    fade?: { color: "black" | "white"; amount: number },
  ) {
    const { dw, dh, x, y } = this.rect(w, h);
    const layer = (this.layerCanvas ??= document.createElement("canvas"));
    if (
      layer.width !== this.canvas.width ||
      layer.height !== this.canvas.height
    ) {
      layer.width = this.canvas.width;
      layer.height = this.canvas.height;
    }
    const ctx = layer.getContext("2d")!;
    ctx.clearRect(0, 0, layer.width, layer.height);
    if (!key) {
      ctx.fillStyle = "black";
      // Match export's opaque letterbox without flattening transparent PNGs.
      ctx.fillRect(0, 0, layer.width, y);
      ctx.fillRect(0, y + dh, layer.width, layer.height - y - dh);
      ctx.fillRect(0, y, x, dh);
      ctx.fillRect(x + dw, y, layer.width - x - dw, dh);
      ctx.drawImage(source, x, y, dw, dh);
    } else {
      const c = (this.keyCanvas ??= document.createElement("canvas"));
      if (c.width !== dw || c.height !== dh) {
        c.width = dw;
        c.height = dh;
      }
      const k = (this.keyCtx ??= c.getContext("2d", {
        willReadFrequently: true,
      })!);
      k.clearRect(0, 0, dw, dh);
      k.drawImage(source, 0, 0, dw, dh);
      const pixels = k.getImageData(0, 0, dw, dh);
      applyChromaKey(pixels.data, key);
      k.putImageData(pixels, 0, 0);
      ctx.drawImage(c, x, y);
    }
    if (fade) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = fade.amount;
      ctx.fillStyle = fade.color;
      ctx.fillRect(0, 0, layer.width, layer.height);
      ctx.restore();
    }
    this.ctx.drawImage(layer, 0, 0);
  }
  private source(
    clipId: string,
  ): [CanvasImageSource, number, number] | undefined {
    const clip = this.project()
      .tracks.flatMap((t) => t.clips)
      .find((c) => c.id === clipId);
    if (!clip) return;
    const el = this.players.get(clipId)?.el;
    const img = this.images.get(clip.assetId);
    if (el && el.readyState >= 2 && el.videoWidth)
      return [el, el.videoWidth, el.videoHeight];
    if (img?.complete && img.naturalWidth)
      return [img, img.naturalWidth, img.naturalHeight];
  }
  /** Unkeyed source color of a clip at canvas coordinates, or undefined if not visible. */
  sampleColor(clipId: string, cx: number, cy: number): string | undefined {
    const found = this.source(clipId);
    if (!found) return;
    const [source, w, h] = found;
    const { scale, x, y } = this.rect(w, h);
    const sx = (cx - x) / scale,
      sy = (cy - y) / scale;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    // Average a small neighborhood to reduce compression noise.
    ctx.drawImage(
      source,
      Math.max(0, Math.min(w - 4, sx - 2)),
      Math.max(0, Math.min(h - 4, sy - 2)),
      Math.min(4, w),
      Math.min(4, h),
      0,
      0,
      1,
      1,
    );
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return hex(r, g, b);
  }
  /** Background color guess: per-channel median of the frame's top, left and right borders. */
  detectKeyColor(clipId: string): string | undefined {
    const found = this.source(clipId);
    if (!found) return;
    const [W, H] = [32, 18];
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(found[0], 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const channels: number[][] = [[], [], []];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (y > 0 && x > 0 && x < W - 1) continue;
        for (let k = 0; k < 3; k++) channels[k].push(data[(y * W + x) * 4 + k]);
      }
    const median = (v: number[]) =>
      v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
    return hex(median(channels[0]), median(channels[1]), median(channels[2]));
  }
}
const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
