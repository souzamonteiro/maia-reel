import {
  initializeLanguage,
  setText,
  setAttribute,
  t,
} from "../../packages/i18n/ui";
import "./style.css";
import {
  newProject,
  parseProject,
  duration,
  uid,
  type Clip,
} from "../../packages/project";
import { History, snap, type Command } from "../../packages/timeline";
import { MediaRegistry } from "../../packages/media";
import { thumbnail, waveform } from "../../packages/media/visuals";
import { Preview } from "../../packages/preview";
import { Exporter, type Format } from "../../packages/export";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML = `
<header><a class="brand" href="/">◈ <strong>Maia Reel</strong></a><span class="badge">LOCAL · SEM UPLOAD</span><div class="project-name"><span id="projectName">Meu filme</span> <span id="dirty"></span></div><label>Idioma <select id="language" aria-label="Idioma"><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option></select></label><button id="open">Abrir projeto</button><button id="save">Salvar projeto</button></header>
<main><aside class="library"><div class="section-head"><h1>Mídia</h1><span id="assetCount">0 arquivos</span></div><p class="muted">Seu próximo filme começa aqui.</p><button class="primary wide" id="import">＋ Importar arquivos</button><input id="mediaInput" type="file" accept="video/*,audio/*,image/png,image/jpeg" multiple hidden><input id="projectInput" type="file" accept=".json" hidden><input id="relinkInput" type="file" multiple hidden><button id="relink" class="wide">Revincular mídias offline</button><div id="assets" class="assets"></div><p class="hint">Vídeos e imagens entram na faixa visual. Áudios têm uma faixa independente. Imagens duram 5 segundos.</p></aside>
<section class="viewer"><div class="section-head"><h2>Prévia</h2><span id="resolution">1280 × 720 · 30 fps</span></div><div class="canvas-wrap"><canvas id="preview" width="1280" height="720" aria-label="Prévia do projeto"></canvas></div><div class="transport"><button id="rewind" aria-label="Voltar ao início">↤</button><button id="play">Reproduzir</button><output id="time">0.00 / 0.00 s</output><span class="muted">Prévia aproximada</span></div><label class="scrub-label">Posição <input id="scrub" type="range" min="0" max="0" step="1000" value="0"></label></section>
<aside class="inspector"><h2>Clipe selecionado</h2><div id="emptySelection" class="muted">Selecione um clipe na linha do tempo para editar.</div><form id="clipForm" hidden><p id="clipName"></p><label>Posição na timeline (s)<input id="start" type="number" min="0" step="0.001" required></label><label>Entrada na fonte (s)<input id="in" type="number" min="0" step="0.001" required></label><label>Saída na fonte (s)<input id="out" type="number" min="0" step="0.001" required></label><label>Ganho (0–2)<input id="gain" type="number" min="0" max="2" step="0.05" required></label><button class="primary" type="submit">Aplicar corte</button><button type="button" id="move">Mover</button><button type="button" id="setGain">Aplicar ganho</button><button type="button" id="split">Dividir na posição</button><button type="button" id="delete">Excluir clipe</button></form><hr><h2>Título</h2><form id="titleForm"><label>Texto<textarea id="titleText" maxlength="300" rows="2" required placeholder="Uma história para contar"></textarea></label><div class="pair"><label>Início (s)<input id="titleStart" type="number" value="0" min="0" step="0.1" required></label><label>Fim (s)<input id="titleEnd" type="number" value="2" min="0" step="0.1" required></label></div><button type="submit">＋ Adicionar título</button></form><div id="titles"></div></aside>
<section class="timeline"><div class="section-head"><h2>Linha do tempo</h2><div><button id="addAudioTrack">＋ Faixa de áudio</button><button id="undo">Desfazer</button><button id="redo">Refazer</button><label class="inline"><input id="snapping" type="checkbox" checked> Ajustar às bordas</label></div></div><div id="tracks"></div><p class="hint">Clique para selecionar · arraste para mover · Espaço reproduz · Ctrl/⌘ Z desfaz</p></section>
<section class="export-panel"><div><h2>Finalizar seu filme</h2><p class="muted">Processamento local em worker. Até 5 minutos e 256 MB de fontes por exportação.</p></div><button id="probe">Verificar motor</button><select id="format" aria-label="Formato de exportação" disabled></select><button id="export" class="primary" disabled>Exportar vídeo</button><button id="cancel" hidden>Cancelar</button></section>
<details class="capabilities"><summary>Compatibilidade e diagnóstico</summary><p id="capabilities"></p><p id="engine">Motor de exportação ainda não verificado. Nenhuma mídia é enviada.</p></details><div id="status" role="status" aria-live="polite">Importe arquivos para começar.</div></main><footer>MAIA PLATFORM <span>Edição não destrutiva. Seus arquivos originais são preservados.</span></footer>`;
initializeLanguage($("app"));
let history = new History(newProject());
const registry = new MediaRegistry();
let selected = "";
let saved = JSON.stringify(history.project);
let relinkTarget = "";
let importing = false;
const visuals = new Map<string, string>();
let visualBusy = false;
const preview = new Preview($("preview"), () => history.project, registry);
const exporter = new Exporter();
const status = (message: string) => {
  setText($("status"), message);
  $("status").dataset.error = "false";
};
const error = (e: unknown) => {
  status(e instanceof Error ? e.message : String(e));
  $("status").dataset.error = "true";
};
preview.onError = error;
exporter.onStatus = status;
const run = (fn: () => unknown) => {
  try {
    const result = fn();
    if (result instanceof Promise) void result.catch(error);
  } catch (e) {
    error(e);
  }
};
const button = (text: string, fn: () => void, localized = true) => {
  const b = document.createElement("button");
  b.type = "button";
  if (localized) setText(b, text);
  else b.textContent = text;
  b.onclick = () => run(fn);
  return b;
};
function edit(cmd: Command) {
  preview.pause();
  history.execute(cmd);
  render();
}
function selection(): Clip {
  const c = history.project.tracks
    .flatMap((t) => t.clips)
    .find((c) => c.id === selected);
  if (!c) throw Error("Selecione um clipe.");
  return c;
}
const number = (id: string) =>
  Math.round(Number($<HTMLInputElement>(id).value) * 1e6);
function render() {
  const p = history.project;
  $("projectName").textContent = p.name;
  const end = duration(p);
  $("dirty").textContent = JSON.stringify(p) === saved ? "" : "•";
  setText($("assetCount"), `${p.assets.length} arquivos`);
  const rate = p.canvas.frameRate.numerator / p.canvas.frameRate.denominator;
  $("resolution").textContent =
    `${p.canvas.width} × ${p.canvas.height} · ${rate.toFixed(2)} fps`;
  $<HTMLButtonElement>("undo").disabled = !history.canUndo;
  $<HTMLButtonElement>("redo").disabled = !history.canRedo;
  $<HTMLInputElement>("scrub").max = String(end);
  if (preview.timeUs > end) preview.seek(end);
  setText($("play"), preview.playing ? "Pausar" : "Reproduzir");
  $("assets").replaceChildren();
  for (const a of p.assets) {
    const row = document.createElement("article");
    row.className = "asset";
    const title = document.createElement("strong");
    title.textContent = a.displayName;
    const meta = document.createElement("small");
    setText(
      meta,
      `${a.kind} · ${(a.durationUs / 1e6).toFixed(2)} s · ${registry.entries.has(a.id) ? "online" : "OFFLINE"}`,
    );
    if (visuals.has(a.id)) {
      const img = document.createElement("img");
      img.src = visuals.get(a.id)!;
      setAttribute(
        img,
        "alt",
        a.kind === "audio" ? "Forma de onda" : "Miniatura",
      );
      img.className = "asset-visual";
      row.append(img);
    }
    const target = document.createElement("select");
    setAttribute(target, "aria-label", `Faixa para ${a.displayName}`);
    const compatible = p.tracks.filter(
      (t) => t.kind === (a.kind === "audio" ? "audio" : "video"),
    );
    compatible.forEach((t, i) =>
      target.add(
        setText(
          new Option("", t.id),
          `${t.kind === "audio" ? "Áudio" : "Vídeo"} ${i + 1}`,
        ),
      ),
    );
    target.hidden = compatible.length <= 1;
    row.append(
      title,
      target,
      meta,
      button("＋ Adicionar", () => {
        const track = p.tracks.find((t) => t.id === target.value);
        if (!track) throw Error("Projeto sem faixa compatível.");
        const start = Math.max(
          0,
          ...track.clips.map((c) => c.startUs + c.sourceOutUs - c.sourceInUs),
        );
        const clip = {
          id: uid(),
          assetId: a.id,
          startUs: start,
          sourceInUs: 0,
          sourceOutUs: a.durationUs,
          gain: 1,
        };
        selected = clip.id;
        edit({ type: "insertClip", trackId: track.id, clip });
      }),
    );
    if (!registry.entries.has(a.id))
      row.append(
        button("Revincular", () => {
          relinkTarget = a.id;
          $("relinkInput").click();
        }),
      );
    if (registry.entries.has(a.id) && a.kind !== "image" && !visuals.has(a.id))
      row.append(
        button(
          a.kind === "audio" ? "Gerar forma de onda" : "Gerar miniatura",
          () => {
            if (visualBusy) {
              status("Aguarde a visualização atual terminar.");
              return;
            }
            visualBusy = true;
            const entry = registry.entries.get(a.id)!;
            status("Gerando visualização local…");
            void (
              a.kind === "audio"
                ? waveform(entry.file, a.durationUs)
                : thumbnail(entry.url, 1)
            )
              .then((url) => {
                visuals.set(a.id, url);
                render();
                status("Visualização pronta.");
              })
              .catch(error)
              .finally(() => {
                visualBusy = false;
              });
          },
        ),
      );
    $("assets").append(row);
  }
  $("tracks").replaceChildren();
  for (const track of p.tracks) {
    const row = document.createElement("div");
    row.className = "track";
    const name = document.createElement("div");
    name.className = "track-name";
    name.append(
      setText(
        document.createElement("span"),
        track.kind === "video" ? "VÍDEO" : "ÁUDIO",
      ),
      button(track.muted ? "Ativar som" : "Silenciar", () =>
        edit({ type: "mute", trackId: track.id, muted: !track.muted }),
      ),
    );
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.track = track.id;
    const span = Math.max(end, 10e6);
    const playhead = document.createElement("div");
    playhead.className = "playhead";
    playhead.setAttribute("aria-hidden", "true");
    lane.append(playhead);
    for (const clip of track.clips) {
      const a = p.assets.find((a) => a.id === clip.assetId)!;
      const b = button(
        a.displayName,
        () => {
          selected = clip.id;
          render();
        },
        false,
      );
      b.className = `clip ${track.kind} ${clip.id === selected ? "selected" : ""}`;
      b.style.left = `${(clip.startUs / span) * 100}%`;
      b.style.width = `${((clip.sourceOutUs - clip.sourceInUs) / span) * 100}%`;
      b.title = `${a.displayName}: ${(clip.startUs / 1e6).toFixed(3)} s`;
      b.draggable = true;
      b.ondragstart = (e) => e.dataTransfer?.setData("text/plain", clip.id);
      lane.append(b);
    }
    lane.ondragover = (e) => e.preventDefault();
    lane.ondrop = (e) => {
      e.preventDefault();
      run(() => {
        const id = e.dataTransfer?.getData("text/plain");
        if (!id || !track.clips.some((c) => c.id === id)) return;
        const rect = lane.getBoundingClientRect();
        let startUs = Math.max(
          0,
          Math.round(((e.clientX - rect.left) / rect.width) * span),
        );
        if ($<HTMLInputElement>("snapping").checked)
          startUs = snap(p, startUs, id);
        edit({ type: "moveClip", id, startUs });
      });
    };
    row.append(name, lane);
    $("tracks").append(row);
  }
  const clip = p.tracks.flatMap((t) => t.clips).find((c) => c.id === selected);
  $("clipForm").hidden = !clip;
  $("emptySelection").hidden = !!clip;
  if (clip) {
    $("clipName").textContent = p.assets.find(
      (a) => a.id === clip.assetId,
    )!.displayName;
    for (const [id, v] of [
      ["start", clip.startUs / 1e6],
      ["in", clip.sourceInUs / 1e6],
      ["out", clip.sourceOutUs / 1e6],
      ["gain", clip.gain],
    ] as const)
      $<HTMLInputElement>(id).value = String(v);
  }
  $("titles").replaceChildren();
  for (const t of p.titles) {
    $("titles").append(
      button(`Excluir título: ${t.text}`, () =>
        edit({ type: "deleteTitle", id: t.id }),
      ),
    );
  }
  updateTime(preview.timeUs);
}
function updateTime(us: number) {
  for (const line of document.querySelectorAll<HTMLElement>(".playhead"))
    line.style.left = `${(us / Math.max(duration(history.project), 10e6)) * 100}%`;
  $<HTMLInputElement>("scrub").value = String(us);
  $("time").textContent =
    `${(us / 1e6).toFixed(2)} / ${(duration(history.project) / 1e6).toFixed(2)} s`;
  setText($("play"), preview.playing ? "Pausar" : "Reproduzir");
}
preview.onTime = updateTime;
$("import").onclick = () => $("mediaInput").click();
$<HTMLInputElement>("mediaInput").onchange = () =>
  run(async () => {
    if (importing) return;
    importing = true;
    const input = $<HTMLInputElement>("mediaInput");
    const files = [...(input.files ?? [])];
    input.value = "";
    const failures: string[] = [];
    let imported = 0;
    try {
      for (const file of files) {
        try {
          const asset = await registry.probe(file);
          edit({ type: "addAsset", asset });
          registry.attach(asset.id, file);
          imported++;
          render();
          status(
            `${file.name} importado. Clique em Adicionar para inserir na timeline.`,
          );
        } catch (e) {
          failures.push(e instanceof Error ? e.message : String(e));
        }
      }
      status(
        `${imported} arquivo(s) importado(s). Clique em Adicionar para inserir na timeline.${failures.length ? "\n" + failures.join("\n") : ""}`,
      );
    } finally {
      importing = false;
    }
  });
$("clipForm").onsubmit = (e) => {
  e.preventDefault();
  run(() =>
    edit({
      type: "trimClip",
      id: selection().id,
      sourceInUs: number("in"),
      sourceOutUs: number("out"),
    }),
  );
};
$("move").onclick = () =>
  run(() =>
    edit({ type: "moveClip", id: selection().id, startUs: number("start") }),
  );
$("setGain").onclick = () =>
  run(() =>
    edit({
      type: "setGain",
      id: selection().id,
      gain: Number($<HTMLInputElement>("gain").value),
    }),
  );
$("split").onclick = () =>
  run(() =>
    edit({ type: "splitClip", id: selection().id, atUs: preview.timeUs }),
  );
$("delete").onclick = () =>
  run(() => edit({ type: "deleteClip", id: selection().id }));
$("addAudioTrack").onclick = () =>
  run(() =>
    edit({
      type: "addTrack",
      track: {
        id: uid(),
        kind: "audio",
        zIndex: Math.max(0, ...history.project.tracks.map((t) => t.zIndex)) + 1,
        muted: false,
        clips: [],
      },
    }),
  );
$("undo").onclick = () => {
  preview.pause();
  history.undo();
  render();
};
$("redo").onclick = () => {
  preview.pause();
  history.redo();
  render();
};
$("titleForm").onsubmit = (e) => {
  e.preventDefault();
  run(() =>
    edit({
      type: "addTitle",
      title: {
        id: uid(),
        startUs: number("titleStart"),
        endUs: number("titleEnd"),
        text: $<HTMLTextAreaElement>("titleText").value,
        style: { fontSize: 64, color: "#ffffff" },
      },
    }),
  );
};
$("play").onclick = () =>
  run(async () => {
    if (preview.playing) preview.pause();
    else await preview.play();
    updateTime(preview.timeUs);
  });
$("rewind").onclick = () => preview.seek(0);
$<HTMLInputElement>("scrub").oninput = () =>
  preview.seek(Number($<HTMLInputElement>("scrub").value));
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$("save").onclick = () => {
  saved = JSON.stringify(history.project);
  download(
    new Blob([JSON.stringify(history.project, null, 2)], {
      type: "application/json",
    }),
    "projeto.maiareel.json",
  );
  render();
  status("Projeto salvo. Guarde também os arquivos de mídia originais.");
};
$("open").onclick = () => {
  if (
    JSON.stringify(history.project) !== saved &&
    !confirm(t("Abrir outro projeto e descartar alterações não salvas?"))
  )
    return;
  $("projectInput").click();
};
$<HTMLInputElement>("projectInput").onchange = () =>
  run(async () => {
    const input = $<HTMLInputElement>("projectInput");
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 2_000_000) throw Error("Projeto excede 2 MB.");
    const p = parseProject(await file.text());
    preview.reset();
    registry.clear();
    visuals.clear();
    history = new History(p);
    selected = "";
    saved = JSON.stringify(p);
    render();
    status(
      "Projeto aberto. Revincule as mídias originais para reproduzir e exportar.",
    );
  });
$("relink").onclick = () => {
  relinkTarget = "";
  $("relinkInput").click();
};
$<HTMLInputElement>("relinkInput").onchange = () =>
  run(async () => {
    const input = $<HTMLInputElement>("relinkInput");
    const files = [...(input.files ?? [])];
    input.value = "";
    preview.reset();
    let count = 0;
    const failures: string[] = [];
    for (const file of files) {
      const candidates = history.project.assets.filter(
        (a) =>
          !registry.entries.has(a.id) &&
          (!relinkTarget || a.id === relinkTarget) &&
          a.displayName === file.name &&
          a.sizeBytes === file.size &&
          a.lastModifiedMs === file.lastModified,
      );
      if (candidates.length !== 1) {
        failures.push(
          `${file.name}: identidade não corresponde ou é ambígua (nome, tamanho e modificação).`,
        );
        continue;
      }
      const a = candidates[0];
      const probed = await registry.probe(file);
      if (
        a.kind !== probed.kind ||
        Math.abs(a.durationUs - probed.durationUs) > 1000
      )
        throw Error(
          `${file.name}: duração ou tipo diferente da fonte original.`,
        );
      if (
        !confirm(
          t(
            `Revincular "${a.displayName}" ao arquivo selecionado? O fingerprint não é uma assinatura criptográfica.`,
          ),
        )
      )
        continue;
      registry.attach(a.id, file);
      count++;
    }
    render();
    status(
      `${count} mídia(s) revinculada(s).${failures.length ? "\n" + failures.join("\n") : ""}`,
    );
  });
async function probe() {
  status("Carregando motor local e verificando encoders…");
  await exporter.load();
  const select = $<HTMLSelectElement>("format");
  select.replaceChildren(
    ...exporter.formats.map(
      (f) =>
        new Option(
          f === "mp4" ? "MP4 · H.264 / AAC" : "WebM · VP8 / Vorbis",
          f,
        ),
    ),
  );
  select.disabled = false;
  $<HTMLButtonElement>("export").disabled = false;
  setText(
    $("engine"),
    `Encoders confirmados: ${exporter.formats.join(", ")}. FFmpeg WASM, execução em worker.`,
  );
  status("Motor pronto.");
}
$("probe").onclick = () => run(probe);
$("export").onclick = () =>
  run(async () => {
    preview.pause();
    const snapshot = structuredClone(history.project);
    if (importing || visualBusy)
      throw Error("Aguarde a importação/visualização terminar.");
    $("cancel").hidden = false;
    const controls = [
      ...document.querySelectorAll<
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
      >("button,input,select,textarea"),
    ].filter((el) => el.id !== "cancel" && el.id !== "language");
    const disabled = controls.map((el) => el.disabled);
    controls.forEach((el) => (el.disabled = true));
    try {
      const format = $<HTMLSelectElement>("format").value as Format;
      const blob = await exporter.render(snapshot, registry, format);
      download(blob, `maia-reel.${format}`);
      status(
        `Exportação concluída (${(blob.size / 1024 / 1024).toFixed(2)} MB). Reimporte o resultado para conferir.`,
      );
    } finally {
      controls.forEach((el, i) => (el.disabled = disabled[i]));
      $("cancel").hidden = true;
      $<HTMLButtonElement>("export").disabled = !exporter.formats.length;
      $<HTMLButtonElement>("probe").disabled = false;
    }
  });
$("cancel").onclick = () => {
  exporter.cancel();
  status("Exportação cancelada. Verifique o motor para tentar novamente.");
};
setText(
  $("capabilities"),
  `WebAssembly: ${typeof WebAssembly !== "undefined" ? "disponível" : "indisponível"} · Web Audio: ${typeof AudioContext !== "undefined" ? "disponível" : "indisponível"} · MP4 no navegador: ${document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') || "não confirmado"}. Cada arquivo é testado ao importar.`,
);
document.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).closest("input,textarea,select,button")) return;
  if (e.code === "Space") {
    e.preventDefault();
    $("play").click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $(e.shiftKey ? "redo" : "undo").click();
  }
});
window.addEventListener("beforeunload", (e) => {
  if (JSON.stringify(history.project) !== saved || exporter.busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) preview.pause();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    preview.pause();
    return;
  }
  preview.dispose();
  registry.clear();
  exporter.cancel();
});
render();
