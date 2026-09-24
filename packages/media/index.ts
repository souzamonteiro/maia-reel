import { uid, type Asset } from "../project";
export type MediaEntry = { file: File; url: string };
export class MediaRegistry {
  entries = new Map<string, MediaEntry>();
  attach(id: string, file: File) {
    const old = this.entries.get(id);
    if (old) URL.revokeObjectURL(old.url);
    this.entries.set(id, { file, url: URL.createObjectURL(file) });
  }
  clear() {
    for (const e of this.entries.values()) URL.revokeObjectURL(e.url);
    this.entries.clear();
  }
  async probe(file: File): Promise<Asset> {
    if (!file.size) throw Error(`${file.name}: arquivo vazio.`);
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const ascii = new TextDecoder().decode(head);
    const image =
      (head[0] === 137 && ascii.slice(1, 4) === "PNG") ||
      (head[0] === 255 && head[1] === 216);
    const supported =
      image ||
      ascii.slice(4, 8) === "ftyp" ||
      ascii.startsWith("RIFF") ||
      ascii.startsWith("OggS") ||
      ascii.startsWith("fLaC") ||
      ascii.startsWith("ID3") ||
      (head[0] === 255 && (head[1] & 224) === 224) ||
      (head[0] === 26 && head[1] === 69);
    if (!supported)
      throw Error(
        `${file.name}: assinatura de contêiner não suportada. Use MP4, WebM, WAV, MP3, Ogg, FLAC, PNG ou JPEG.`,
      );
    const url = URL.createObjectURL(file);
    try {
      if (image) {
        const img = new Image();
        img.src = url;
        await img.decode();
        return {
          id: uid(),
          kind: "image",
          displayName: file.name,
          sizeBytes: file.size,
          lastModifiedMs: file.lastModified,
          durationUs: 5_000_000,
        };
      }
      const el = document.createElement("video");
      el.preload = "auto";
      el.src = url;
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("Tempo limite ao ler mídia.")),
            15000,
          );
          el.onloadeddata = () => {
            clearTimeout(timer);
            resolve();
          };
          el.onerror = () => {
            clearTimeout(timer);
            reject(
              Error(
                `Codec não decodificável neste navegador (${file.type || "tipo desconhecido"}).`,
              ),
            );
          };
        });
        if (!Number.isFinite(el.duration) || el.duration <= 0)
          throw Error(
            "Duração indisponível. Remuxe o arquivo antes de importar.",
          );
        return {
          id: uid(),
          kind: el.videoWidth ? "video" : "audio",
          displayName: file.name,
          sizeBytes: file.size,
          lastModifiedMs: file.lastModified,
          durationUs: Math.round(el.duration * 1e6),
        };
      } finally {
        el.removeAttribute("src");
        el.load();
      }
    } catch (e) {
      throw Error(`${file.name}: ${e instanceof Error ? e.message : e}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
