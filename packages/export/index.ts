import { FFmpeg } from "@ffmpeg/ffmpeg";
import { type Project } from "../project";
import { createRenderPlan } from "./plan";
import { MediaRegistry } from "../media";
import { paintTitle } from "../preview";
export type Format = "mp4" | "webm";
export class Exporter {
  private engine?: FFmpeg;
  private logs: string[] = [];
  private loading?: Promise<void>;
  formats: Format[] = [];
  busy = false;
  onStatus: (s: string) => void = () => {};
  cancel() {
    this.engine?.terminate();
    this.engine = undefined;
    this.formats = [];
    this.loading = undefined;
  }
  async load() {
    if (this.loading) return this.loading;
    if (this.engine) return;
    this.loading = this.initialize();
    try {
      await this.loading;
    } finally {
      this.loading = undefined;
    }
  }
  private async initialize() {
    const ff = new FFmpeg();
    this.engine = ff;
    ff.on("log", ({ message }) => {
      this.logs.push(message);
      if (this.logs.length > 4000) this.logs.shift();
    });
    ff.on("progress", ({ progress }) =>
      this.onStatus(
        `Exportando: ${Math.max(0, Math.min(99, Math.round(progress * 100)))}%`,
      ),
    );
    try {
      await ff.load({
        coreURL: new URL(
          `${import.meta.env.BASE_URL}ffmpeg/ffmpeg-core.js`,
          document.baseURI,
        ).href,
        wasmURL: new URL(
          `${import.meta.env.BASE_URL}ffmpeg/ffmpeg-core.wasm`,
          document.baseURI,
        ).href,
      });
      this.logs = [];
      await ff.exec(["-encoders"]);
      const enc = this.logs.join("\n");
      this.formats = [];
      if (/\blibx264\b/.test(enc) && /\baac\b/.test(enc))
        this.formats.push("mp4");
      if (/\blibvpx\b/.test(enc) && /\blibvorbis\b/.test(enc))
        this.formats.push("webm");
      if (!this.formats.length)
        throw Error("Motor sem par H.264/AAC ou VP8/Vorbis.");
      this.logs = [];
      await ff.exec(["-filters"]);
      const filters = this.logs.join("\n");
      for (const required of [
        "overlay",
        "trim",
        "atrim",
        "setpts",
        "asetpts",
        "scale",
        "pad",
        "fps",
        "aresample",
        "volume",
        "adelay",
        "amix",
        "alimiter",
        "anullsrc",
        "color",
      ]) {
        if (!new RegExp("\\b" + required + "\\b").test(filters))
          throw Error(`Filtro necessário indisponível: ${required}`);
      }
    } catch (e) {
      this.cancel();
      throw e;
    }
  }
  async render(
    project: Project,
    registry: MediaRegistry,
    format: Format,
  ): Promise<Blob> {
    if (this.busy) throw Error("Uma exportação já está em andamento.");
    this.busy = true;
    const files: string[] = [];
    try {
      const plan = createRenderPlan(project);
      const p = plan.project;
      const end = plan.durationUs;
      if (!end) throw Error("Adicione clipes antes de exportar.");
      if (end > 300e6) throw Error("MVP: exportação limitada a 5 minutos.");
      const used = p.assets.filter((a) =>
        p.tracks.some((t) => t.clips.some((c) => c.assetId === a.id)),
      );
      if (used.some((a) => !registry.entries.has(a.id)))
        throw Error("Revincule as mídias offline antes de exportar.");
      if (used.reduce((s, a) => s + a.sizeBytes, 0) > 256 * 1024 * 1024)
        throw Error(
          "Exportação limitada a 256 MB de fontes para proteger a memória WASM.",
        );
      this.engine?.terminate();
      this.engine = undefined;
      await this.load();
      if (!this.formats.includes(format))
        throw Error(`Encoders para ${format} indisponíveis.`);
      const ff = this.engine!;
      const args: string[] = [];
      const inputMap = new Map<string, number>();
      const hasAudio = new Set<string>();
      for (const a of used) {
        const file = registry.entries.get(a.id)!.file;
        const signature =
          a.kind === "image"
            ? new Uint8Array(await file.slice(0, 2).arrayBuffer())
            : undefined;
        const extension = signature
          ? signature[0] === 255
            ? ".jpg"
            : ".png"
          : "";
        const name = `source${inputMap.size}${extension}`;
        this.onStatus(`Preparando ${a.displayName}`);
        await ff.writeFile(name, new Uint8Array(await file.arrayBuffer()));
        files.push(name);
        this.logs = [];
        await ff.exec(["-i", name]);
        if (this.logs.some((x) => /Stream .*Audio:/.test(x)))
          hasAudio.add(a.id);
        inputMap.set(a.id, inputMap.size);
        if (a.kind === "image") args.push("-loop", "1");
        args.push("-i", name);
      }
      const w = p.canvas.width,
        h = p.canvas.height,
        fps = `${p.canvas.frameRate.numerator}/${p.canvas.frameRate.denominator}`,
        seconds = (n: number) => (n / 1e6).toFixed(6);
      const total = seconds(end);
      const filters = [
        `color=c=black:s=${w}x${h}:r=${fps}:d=${total}[base]`,
        `anullsrc=r=48000:cl=stereo,atrim=duration=${total}[silence]`,
      ];
      let current = "base",
        serial = 0;
      const sounds = ["[silence]"];
      for (const { track, clip: c, asset, endUs, gain } of plan.segments) {
        const idx = inputMap.get(c.assetId)!;
        const n = serial++;
        const d = seconds(c.sourceOutUs - c.sourceInUs);
        if (track.kind === "video") {
          filters.push(
            `[${idx}:v]trim=start=${seconds(c.sourceInUs)}:end=${seconds(c.sourceOutUs)},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},setpts=PTS+${seconds(c.startUs)}/TB[v${n}]`,
          );
          filters.push(
            `[${current}][v${n}]overlay=eof_action=pass:enable='gte(t,${seconds(c.startUs)})*lt(t,${seconds(endUs)})'[layer${n}]`,
          );
          current = `layer${n}`;
        }
        if (asset.kind !== "image" && hasAudio.has(asset.id) && gain > 0) {
          filters.push(
            `[${idx}:a]atrim=start=${seconds(c.sourceInUs)}:duration=${d},asetpts=PTS-STARTPTS,aresample=48000,volume=${gain},adelay=${Math.round((c.startUs / 1e6) * 48000)}S:all=1[a${n}]`,
          );
          sounds.push(`[a${n}]`);
        }
      }
      for (let i = 0; i < p.titles.length; i++) {
        const title = p.titles[i];
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        paintTitle(canvas.getContext("2d")!, title, w, h);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) =>
            b ? resolve(b) : reject(Error("Falha ao renderizar título.")),
          ),
        );
        const name = `title${i}.png`;
        await ff.writeFile(name, new Uint8Array(await blob.arrayBuffer()));
        files.push(name);
        args.push("-loop", "1", "-i", name);
        const idx = used.length + i;
        filters.push(
          `[${current}][${idx}:v]overlay=eof_action=pass:enable='gte(t,${seconds(title.startUs)})*lt(t,${seconds(title.endUs)})'[title${i}]`,
        );
        current = `title${i}`;
      }
      filters.push(
        `${sounds.join("")}amix=inputs=${sounds.length}:duration=first:normalize=0,alimiter=limit=1:level=0:latency=1[audio]`,
      );
      const output = `output.${format}`;
      files.push(output);
      const encoding =
        format === "mp4"
          ? [
              "-c:v",
              "libx264",
              "-preset",
              "ultrafast",
              "-crf",
              "23",
              "-c:a",
              "aac",
              "-movflags",
              "+faststart",
            ]
          : ["-c:v", "libvpx", "-b:v", "2M", "-c:a", "libvorbis"];
      this.logs = [];
      const code = await ff.exec([
        "-y",
        ...args,
        "-filter_complex_threads",
        "1",
        "-filter_complex",
        filters.join(";"),
        "-map",
        `[${current}]`,
        "-map",
        "[audio]",
        "-t",
        total,
        "-r",
        fps,
        "-pix_fmt",
        "yuv420p",
        ...encoding,
        "-threads",
        "1",
        output,
      ]);
      if (code !== 0)
        throw Error(
          `FFmpeg falhou (${code}): ${this.logs.slice(-8).join("\n")}`,
        );
      const data = await ff.readFile(output);
      if (typeof data === "string") throw Error("Saída inválida.");
      return new Blob([new Uint8Array(data)], {
        type: format === "mp4" ? "video/mp4" : "video/webm",
      });
    } catch (e) {
      throw Error(
        `${e instanceof Error ? e.message : String(e)}\n${this.logs.slice(-8).join("\n")}`,
      );
    } finally {
      if (this.engine)
        for (const f of files)
          try {
            await this.engine.deleteFile(f);
          } catch {
            /* The worker may have been cancelled. */
          }
      this.engine?.terminate();
      this.engine = undefined;
      this.busy = false;
    }
  }
}
