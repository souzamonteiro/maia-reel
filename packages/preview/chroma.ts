import type { ChromaKey } from "../project";

const u = (r: number, g: number, b: number) =>
  -0.16874 * r - 0.33126 * g + 0.5 * b + 128;
const v = (r: number, g: number, b: number) =>
  0.5 * r - 0.41869 * g - 0.08131 * b + 128;

/** Mirrors FFmpeg's chromakey filter (UV distance) per pixel so preview matches export. */
export function applyChromaKey(data: Uint8ClampedArray, key: ChromaKey) {
  const kr = parseInt(key.color.slice(1, 3), 16);
  const kg = parseInt(key.color.slice(3, 5), 16);
  const kb = parseInt(key.color.slice(5, 7), 16);
  const ku = u(kr, kg, kb);
  const kv = v(kr, kg, kb);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const diff =
      Math.hypot(u(r, g, b) - ku, v(r, g, b) - kv) / (255 * Math.SQRT2);
    const alpha =
      key.blend > 0.0001
        ? Math.min(1, Math.max(0, (diff - key.similarity) / key.blend))
        : diff > key.similarity
          ? 1
          : 0;
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
}
