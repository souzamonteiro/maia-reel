export type Asset = {
  id: string;
  kind: "video" | "audio" | "image";
  displayName: string;
  sizeBytes: number;
  lastModifiedMs: number;
  durationUs: number;
};
export type Clip = {
  id: string;
  assetId: string;
  startUs: number;
  sourceInUs: number;
  sourceOutUs: number;
  gain: number;
};
export type Track = {
  id: string;
  kind: "video" | "audio";
  zIndex: number;
  muted: boolean;
  clips: Clip[];
};
export type Title = {
  id: string;
  startUs: number;
  endUs: number;
  text: string;
  style: { fontSize: number; color: string };
};
export type Project = {
  format: "org.maiaplatform.maiareel.project";
  version: 1;
  id: string;
  name: string;
  canvas: {
    width: number;
    height: number;
    frameRate: { numerator: number; denominator: number };
  };
  assets: Asset[];
  tracks: Track[];
  titles: Title[];
};
export const uid = () => crypto.randomUUID();
export const duration = (p: Project) =>
  Math.max(
    0,
    ...p.tracks.flatMap((t) =>
      t.clips.map((c) => c.startUs + c.sourceOutUs - c.sourceInUs),
    ),
    ...p.titles.map((t) => t.endUs),
  );
export function newProject(): Project {
  return {
    format: "org.maiaplatform.maiareel.project",
    version: 1,
    id: uid(),
    name: "Meu filme",
    canvas: {
      width: 1280,
      height: 720,
      frameRate: { numerator: 30, denominator: 1 },
    },
    assets: [],
    tracks: [
      { id: "v1", kind: "video", zIndex: 0, muted: false, clips: [] },
      { id: "a1", kind: "audio", zIndex: 1, muted: false, clips: [] },
    ],
    titles: [],
  };
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
function integer(
  x: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): x is number {
  return (
    typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max
  );
}
function object(x: unknown): asserts x is Record<string, any> {
  check(
    x && typeof x === "object" && !Array.isArray(x),
    "Objeto de projeto inválido.",
  );
}
export function validate(value: unknown): Project {
  object(value);
  const p = value;
  check(
    p.format === "org.maiaplatform.maiareel.project" && p.version === 1,
    "Formato ou versão de projeto não suportado.",
  );
  const ids = new Set<string>();
  const id = (v: unknown) => {
    check(
      typeof v === "string" && v.length > 0 && v.length <= 128 && !ids.has(v),
      "ID inválido ou duplicado.",
    );
    ids.add(v);
  };
  id(p.id);
  check(typeof p.name === "string" && p.name.length <= 200, "Nome inválido.");
  object(p.canvas);
  object(p.canvas.frameRate);
  check(
    integer(p.canvas.width, 2, 3840) &&
      integer(p.canvas.height, 2, 2160) &&
      p.canvas.width % 2 === 0 &&
      p.canvas.height % 2 === 0,
    "Dimensões inválidas (pares, até 3840×2160).",
  );
  check(
    integer(p.canvas.frameRate.numerator, 1, 120000) &&
      integer(p.canvas.frameRate.denominator, 1, 10000) &&
      p.canvas.frameRate.numerator / p.canvas.frameRate.denominator <= 120,
    "Taxa de quadros inválida.",
  );
  check(
    Array.isArray(p.assets) &&
      p.assets.length <= 200 &&
      Array.isArray(p.tracks) &&
      p.tracks.length <= 16 &&
      Array.isArray(p.titles) &&
      p.titles.length <= 200,
    "Coleções inválidas ou excessivas.",
  );
  const assets = new Map<string, Asset>();
  for (const a of p.assets) {
    object(a);
    id(a.id);
    check(
      ["video", "audio", "image"].includes(a.kind) &&
        typeof a.displayName === "string" &&
        a.displayName.length <= 512 &&
        integer(a.sizeBytes) &&
        integer(a.lastModifiedMs) &&
        integer(a.durationUs, 1),
      "Mídia inválida.",
    );
    assets.set(a.id, a as Asset);
  }
  for (const t of p.tracks) {
    object(t);
    id(t.id);
    check(
      ["video", "audio"].includes(t.kind) &&
        integer(t.zIndex) &&
        typeof t.muted === "boolean" &&
        Array.isArray(t.clips) &&
        t.clips.length <= 1000,
      "Faixa inválida.",
    );
    for (const c of t.clips) {
      object(c);
      id(c.id);
      const a = assets.get(c.assetId);
      check(a, "Mídia referenciada não existe.");
      check(
        (t.kind === "audio") === (a.kind === "audio"),
        "Mídia incompatível com a faixa.",
      );
      check(
        integer(c.startUs) &&
          integer(c.sourceInUs) &&
          integer(c.sourceOutUs, 1) &&
          c.sourceOutUs > c.sourceInUs &&
          c.sourceOutUs <= a.durationUs &&
          Number.isSafeInteger(c.startUs + c.sourceOutUs - c.sourceInUs),
        "Intervalo do clipe inválido.",
      );
      check(
        typeof c.gain === "number" &&
          Number.isFinite(c.gain) &&
          c.gain >= 0 &&
          c.gain <= 2,
        "Ganho deve estar entre 0 e 2.",
      );
    }
    if (t.kind === "video") {
      const clips = [...t.clips].sort((a, b) => a.startUs - b.startUs);
      for (let i = 1; i < clips.length; i++)
        check(
          clips[i].startUs >=
            clips[i - 1].startUs +
              clips[i - 1].sourceOutUs -
              clips[i - 1].sourceInUs,
          "Clipes de vídeo não podem se sobrepor na mesma faixa.",
        );
    }
  }
  for (const t of p.titles) {
    object(t);
    id(t.id);
    object(t.style);
    check(
      integer(t.startUs) &&
        integer(t.endUs, 1) &&
        t.endUs > t.startUs &&
        typeof t.text === "string" &&
        t.text.trim().length > 0 &&
        t.text.length <= 300 &&
        !/[\u0000-\u0008\u000b-\u001f]/.test(t.text),
      "Título inválido.",
    );
    check(
      integer(t.style.fontSize, 12, 200) &&
        /^#[0-9a-f]{6}$/i.test(t.style.color),
      "Estilo inválido.",
    );
  }
  return structuredClone(p) as Project;
}
export function parseProject(text: string): Project {
  check(text.length <= 2_000_000, "Projeto excede 2 MB.");
  return validate(JSON.parse(text));
}
