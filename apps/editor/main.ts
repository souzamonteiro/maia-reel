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
  type Transition,
  type Track,
  type TitleAlign,
  type TitlePosition,
} from "../../packages/project";
import { History, snap, clipEnd, type Command } from "../../packages/timeline";
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
<aside class="inspector"><h2>Clipe selecionado</h2><div id="emptySelection" class="muted">Selecione um clipe na linha do tempo para editar.</div><form id="clipForm" hidden><p id="clipName"></p><details class="tool-group" open><summary>Corte e posição</summary><div class="tool-content"><label>Posição na timeline (s)<input id="start" type="number" min="0" step="0.001" required></label><div class="pair"><button type="button" id="moveHere">↤ Mover para aqui</button></div><label>Entrada na fonte (s)<input id="in" type="number" min="0" step="0.001" required></label><div class="pair"><button type="button" id="setIn">↤ Marcar entrada</button></div><label>Saída na fonte (s)<input id="out" type="number" min="0" step="0.001" required></label><div class="pair"><button type="button" id="setOut">↦ Marcar saída</button></div><div class="pair"><button class="primary" type="submit">Aplicar corte</button></div><div class="pair"><button type="button" id="move">Mover (posição acima)</button><button type="button" id="split">Dividir na posição</button></div></div></details>
<details class="tool-group" open><summary>Áudio</summary><div class="tool-content"><label>Ganho (0–2)<input id="gain" type="number" min="0" max="2" step="0.05" required></label><button type="button" id="setGain">Aplicar ganho</button></div></details>
<details class="tool-group" id="transitionGroup" open><summary>Transição de entrada</summary><div class="tool-content"><p class="muted" id="transitionHint"></p><fieldset id="transitionFields"><label id="transitionVideoLabel">Vídeo<select id="transitionVideo"><option value="none">Sem transição</option><option value="black">Passagem por preto</option><option value="white">Passagem por branco</option></select></label><label class="check"><input id="transitionAudio" type="checkbox"> Fade de áudio</label><label>Duração total (s)<input id="transitionDuration" type="number" min="0.002" max="10" step="0.001" value="1"></label><p class="hint">Metade da duração em cada clipe, sem alterar os cortes.</p><button type="button" id="applyTransition">Aplicar transição</button></fieldset><button type="button" id="removeTransition">Remover transição</button></div></details>
<details id="chromaFields" class="tool-group"><summary>Chroma key</summary><div class="tool-content"><label class="check"><input type="checkbox" id="chromaOn"> Ativar chroma key</label><div class="pair"><label>Cor de fundo<input id="chromaColor" type="color" value="#00ff00"></label></div><div class="pair"><button type="button" id="chromaDetect">Detectar cor</button><button type="button" id="chromaPick">Escolher na prévia</button></div><label>Similaridade<input id="chromaSimilarity" type="range" min="0.01" max="0.4" step="0.005" value="0.1"></label><label>Suavidade<input id="chromaBlend" type="range" min="0" max="0.3" step="0.005" value="0.05"></label><p class="hint">Coloque o clipe em uma faixa de vídeo acima do fundo.</p></div></details><button type="button" id="delete">Excluir clipe</button></form><details class="tool-group" id="titleGroup" open><summary>Título</summary><div class="tool-content"><form id="titleForm"><label>Texto<textarea id="titleText" maxlength="300" rows="2" required placeholder="Uma história para contar"></textarea></label><div class="pair"><label>Início (s)<input id="titleStart" type="number" value="0" min="0" step="0.1" required></label><label>Fim (s)<input id="titleEnd" type="number" value="5" min="0" step="0.1" required></label></div><div class="pair"><button type="button" id="titleUseTime">Usar posição do cursor</button><label class="inline"><input type="checkbox" id="titleAutoSync" checked> Sincronizar ao cursor</label></div><label>Fonte<select id="titleFont"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option><option value="Impact">Impact</option><option value="Verdana">Verdana</option><option value="Trebuchet MS">Trebuchet MS</option></select></label><label>Estilo de fonte<select id="titleStyle"><option value="">Normal</option><option value="bold">Negrito</option><option value="italic">Itálico</option><option value="bold italic">Negrito + Itálico</option></select></label><label>Posição do título<select id="titlePosition"><option value="bottom">Rodapé</option><option value="top">Topo</option><option value="center">Centro</option><option value="top-left">Topo esquerdo</option><option value="top-right">Topo direito</option><option value="bottom-left">Rodapé esquerdo</option><option value="bottom-right">Rodapé direito</option></select></label><label>Alinhamento<select id="titleAlign"><option value="center">Centro</option><option value="left">Esquerda</option><option value="right">Direita</option></select></label><button type="submit">＋ Adicionar título</button></form><div id="titles"></div></div></details></aside>
<section class="timeline"><div class="section-head"><h2>Linha do tempo</h2><div><button id="addVideoTrack">＋ Faixa de vídeo</button><button id="addAudioTrack">＋ Faixa de áudio</button><button id="undo">Desfazer</button><button id="redo">Refazer</button><label class="inline"><input id="snapping" type="checkbox" checked> Ajustar às bordas</label></div></div><div id="tracks"></div><p class="hint">Clique para selecionar · arraste para mover · Espaço reproduz · Ctrl/⌘ Z desfaz</p></section>
<section class="export-panel"><div><h2>Finalizar seu filme</h2><p class="muted">Processamento local em worker. Até 5 minutos e 256 MB de fontes por exportação.</p></div><button id="probe">Verificar motor</button><select id="format" aria-label="Formato de exportação" disabled></select><button id="export" class="primary" disabled>Exportar vídeo</button><button id="cancel" hidden>Cancelar</button></section>
<details class="capabilities"><summary>Compatibilidade e diagnóstico</summary><p id="capabilities"></p><p id="engine">Motor de exportação ainda não verificado. Nenhuma mídia é enviada.</p></details><div id="status" role="status" aria-live="polite">Importe arquivos para começar.</div></main><footer><a href="https://www.maiaplatform.org" target="_blank" rel="noopener noreferrer">MAIA PLATFORM</a> <span>Edição não destrutiva. Seus arquivos originais são preservados.</span></footer>`;
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
  // Same bottom-to-top order the preview and export use for compositing.
  const videoTracks = p.tracks
    .filter((t) => t.kind === "video")
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
  const audioTracks = p.tracks.filter((t) => t.kind === "audio");
  const trackLabel = (t: Track) =>
    t.kind === "video"
      ? `Vídeo ${videoTracks.indexOf(t) + 1}`
      : `Áudio ${audioTracks.indexOf(t) + 1}`;
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
    const compatible = a.kind === "audio" ? audioTracks : videoTracks;
    compatible.forEach((t) =>
      target.add(setText(new Option("", t.id), trackLabel(t))),
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
  // Upper rows are front layers, like common editors.
  for (const track of [...videoTracks].reverse().concat(audioTracks)) {
    const row = document.createElement("div");
    row.className = "track";
    const name = document.createElement("div");
    name.className = "track-name";
    name.append(
      setText(document.createElement("span"), trackLabel(track)),
      button(track.muted ? "Ativar som" : "Silenciar", () =>
        edit({ type: "mute", trackId: track.id, muted: !track.muted }),
      ),
    );
    const layer = videoTracks.indexOf(track);
    if (layer >= 0 && videoTracks.length > 1) {
      const layerButton = (
        text: string,
        label: string,
        raise?: Track,
        below?: Track,
      ) => {
        const b = button(text, () =>
          edit({ type: "raiseTrack", trackId: raise!.id, aboveId: below!.id }),
        );
        setAttribute(b, "aria-label", label);
        setAttribute(b, "title", label);
        b.disabled = !raise || !below;
        return b;
      };
      const controls = document.createElement("div");
      controls.className = "layer-buttons";
      controls.append(
        layerButton("↑", "Trazer para frente", track, videoTracks[layer + 1]),
        layerButton("↓", "Enviar para trás", videoTracks[layer - 1], track),
      );
      name.append(controls);
    }
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.track = track.id;
    const span = Math.max(end, 10e6);
    const playhead = document.createElement("div");
    playhead.className = "playhead";
    playhead.setAttribute("aria-hidden", "true");
    lane.append(playhead);
    const laneTimeUs = (e: MouseEvent) => {
      const rect = lane.getBoundingClientRect();
      return Math.max(
        0,
        Math.round(((e.clientX - rect.left) / rect.width) * span),
      );
    };
    lane.onclick = (e) => seekTo(laneTimeUs(e));
    for (const clip of track.clips) {
      const a = p.assets.find((a) => a.id === clip.assetId)!;
      const b = button(a.displayName, () => {}, false);
      b.onclick = (e) => {
        e.stopPropagation();
        const atUs = laneTimeUs(e);
        selected = clip.id;
        render();
        seekTo(atUs);
      };
      b.className = `clip ${track.kind} ${clip.id === selected ? "selected" : ""}`;
      b.style.left = `${(clip.startUs / span) * 100}%`;
      b.style.width = `${((clip.sourceOutUs - clip.sourceInUs) / span) * 100}%`;
      b.title = `${a.displayName}: ${(clip.startUs / 1e6).toFixed(3)} s`;
      if (clip.transition) {
        b.classList.add("has-transition");
        const marker = document.createElement("span");
        marker.className = "transition-marker";
        marker.textContent = " ◇";
        marker.setAttribute("aria-hidden", "true");
        b.prepend(marker);
      }
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
        let startUs = laneTimeUs(e);
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
    const track = p.tracks.find((t) => t.clips.includes(clip))!;
    $("chromaFields").hidden = track.kind !== "video";
    const previous = transitionPrevious(track, clip);
    const transition = clip.transition;
    $("transitionVideoLabel").hidden = track.kind !== "video";
    $<HTMLSelectElement>("transitionVideo").value = transition?.video ?? "none";
    $<HTMLInputElement>("transitionAudio").checked = transition?.audio ?? false;
    $<HTMLInputElement>("transitionDuration").value = String(
      (transition?.durationUs ??
        Math.min(
          1e6,
          2 *
            Math.min(
              clipEnd(clip) - clip.startUs,
              previous ? clipEnd(previous) - previous.startUs : 500000,
            ),
        )) / 1e6,
    );
    $<HTMLFieldSetElement>("transitionFields").disabled = !previous;
    $<HTMLButtonElement>("removeTransition").disabled = !transition;
    setText(
      $("transitionHint"),
      previous
        ? "Aplica entre o clipe anterior e o selecionado nesta faixa."
        : "Encoste este clipe no fim de outro clipe da mesma faixa para adicionar uma transição.",
    );
    const key = clip.chromaKey;
    $<HTMLInputElement>("chromaOn").checked = !!key;
    if (key) {
      $<HTMLInputElement>("chromaColor").value = key.color;
      $<HTMLInputElement>("chromaSimilarity").value = String(key.similarity);
      $<HTMLInputElement>("chromaBlend").value = String(key.blend);
    }
  }
  $("titles").replaceChildren();
  for (const t of p.titles) {
    // Build a metadata card for each title entry.
    const card = document.createElement("article");
    card.className = "title-card";
    const textEl = document.createElement("strong");
    textEl.textContent = t.text;
    const meta = document.createElement("small");
    const posLabel = t.style.position ?? "bottom";
    const alignLabel = t.style.align ?? "center";
    const fontLabel = t.style.fontFamily ?? "Arial";
    meta.textContent =
      `${(t.startUs / 1e6).toFixed(2)}s – ${(t.endUs / 1e6).toFixed(2)}s` +
      ` · ${posLabel} · ${alignLabel} · ${fontLabel}`;
    const del = button(`Excluir título: ${t.text}`, () =>
      edit({ type: "deleteTitle", id: t.id }),
    );
    card.append(textEl, meta, del);
    $("titles").append(card);
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
function seekTo(us: number) {
  preview.seek(us);
  if ($<HTMLInputElement>("titleAutoSync").checked) syncTitleTime();
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
function transitionPrevious(track: Track, clip: Clip) {
  if (clip.transition)
    return track.clips.find((c) => c.id === clip.transition!.previousId);
  const candidates = track.clips.filter(
    (c) => c.id !== clip.id && clipEnd(c) === clip.startUs,
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
$("applyTransition").onclick = () =>
  run(() => {
    const clip = selection();
    const track = history.project.tracks.find((t) => t.clips.includes(clip))!;
    const previous = transitionPrevious(track, clip);
    if (!previous)
      throw Error("Selecione dois clipes contíguos na mesma faixa.");
    const video =
      track.kind === "video"
        ? ($<HTMLSelectElement>("transitionVideo").value as Transition["video"])
        : "none";
    const audio = $<HTMLInputElement>("transitionAudio").checked;
    edit({
      type: "setTransition",
      id: clip.id,
      transition:
        video === "none" && !audio
          ? undefined
          : {
              previousId: previous.id,
              durationUs: number("transitionDuration"),
              video,
              audio,
            },
    });
  });
$("removeTransition").onclick = () =>
  run(() => edit({ type: "setTransition", id: selection().id }));
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

$("moveHere").onclick = () =>
  run(() =>
    edit({ type: "moveClip", id: selection().id, startUs: preview.timeUs }),
  );
// Trim at the playhead keeping the remaining footage at the same timeline position.
function markIn() {
  const clip = selection();
  const atUs = preview.timeUs;
  const sourceInUs = clip.sourceInUs + atUs - clip.startUs;
  if (sourceInUs < 0 || sourceInUs >= clip.sourceOutUs)
    throw Error(
      "Posicione o cursor antes do fim do clipe para marcar a entrada.",
    );
  edit({
    type: "trimClip",
    id: clip.id,
    sourceInUs,
    sourceOutUs: clip.sourceOutUs,
    startUs: atUs,
  });
  status("Entrada marcada na posição do cursor.");
}
function markOut() {
  const clip = selection();
  const asset = history.project.assets.find((a) => a.id === clip.assetId)!;
  const sourceOutUs = clip.sourceInUs + preview.timeUs - clip.startUs;
  if (sourceOutUs <= clip.sourceInUs || sourceOutUs > asset.durationUs)
    throw Error(
      "Posicione o cursor depois do início do clipe para marcar a saída.",
    );
  edit({
    type: "trimClip",
    id: clip.id,
    sourceInUs: clip.sourceInUs,
    sourceOutUs,
  });
  status("Saída marcada na posição do cursor.");
}
$("setIn").onclick = () => run(markIn);
$("setOut").onclick = () => run(markOut);
function applyChroma() {
  const clip = selection();
  const chromaKey = $<HTMLInputElement>("chromaOn").checked
    ? {
        color: $<HTMLInputElement>("chromaColor").value,
        similarity: Number($<HTMLInputElement>("chromaSimilarity").value),
        blend: Number($<HTMLInputElement>("chromaBlend").value),
      }
    : undefined;
  if (JSON.stringify(chromaKey) === JSON.stringify(clip.chromaKey)) return;
  edit({ type: "setChromaKey", id: clip.id, chromaKey });
}
for (const id of ["chromaColor", "chromaSimilarity", "chromaBlend"])
  $(id).onchange = () => run(applyChroma);
// Real green screens are rarely #00ff00, so guess the key from the clip itself.
async function detectChroma() {
  const clip = selection();
  const end = clip.startUs + clip.sourceOutUs - clip.sourceInUs;
  if (preview.timeUs < clip.startUs || preview.timeUs >= end)
    seekTo(
      clip.startUs + Math.min(500_000, Math.floor((end - clip.startUs) / 2)),
    );
  let color: string | undefined;
  for (let i = 0; i < 60 && !color; i++) {
    await new Promise((r) => setTimeout(r, 50));
    color = preview.detectKeyColor(clip.id);
  }
  if (!color)
    throw Error(
      "Não foi possível ler o quadro do clipe. Revincule a mídia ou escolha a cor na prévia.",
    );
  $<HTMLInputElement>("chromaColor").value = color;
  $<HTMLInputElement>("chromaOn").checked = true;
  applyChroma();
  status(`Cor do chroma key: ${color}`);
}
$("chromaOn").onchange = () =>
  run(() =>
    $<HTMLInputElement>("chromaOn").checked && !selection().chromaKey
      ? detectChroma()
      : applyChroma(),
  );
$("chromaDetect").onclick = () => run(detectChroma);
let picking = false;
$("chromaPick").onclick = () =>
  run(() => {
    selection();
    preview.pause();
    picking = true;
    $("preview").classList.add("picking");
    status("Clique na prévia sobre a cor de fundo.");
  });
$("preview").onclick = (e) => {
  if (!picking) return;
  picking = false;
  $("preview").classList.remove("picking");
  run(() => {
    const canvas = $<HTMLCanvasElement>("preview");
    const rect = canvas.getBoundingClientRect();
    // The canvas is letterboxed with object-fit: contain.
    const scale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height,
    );
    const cx =
      (e.clientX - rect.left - (rect.width - canvas.width * scale) / 2) / scale;
    const cy =
      (e.clientY - rect.top - (rect.height - canvas.height * scale) / 2) /
      scale;
    const color = preview.sampleColor(selection().id, cx, cy);
    if (!color)
      throw Error("Posicione o cursor sobre o clipe e clique na imagem dele.");
    $<HTMLInputElement>("chromaColor").value = color;
    $<HTMLInputElement>("chromaOn").checked = true;
    applyChroma();
    status(`Cor do chroma key: ${color}`);
  });
};
$("addVideoTrack").onclick = () =>
  run(() =>
    edit({
      type: "addTrack",
      track: {
        id: uid(),
        kind: "video",
        zIndex: Math.max(0, ...history.project.tracks.map((t) => t.zIndex)) + 1,
        muted: false,
        clips: [],
      },
    }),
  );
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
  run(() => {
    const styleVal = $<HTMLSelectElement>("titleStyle").value;
    edit({
      type: "addTitle",
      title: {
        id: uid(),
        startUs: number("titleStart"),
        endUs: number("titleEnd"),
        text: $<HTMLTextAreaElement>("titleText").value,
        style: {
          fontSize: 64,
          color: "#ffffff",
          fontFamily: $<HTMLSelectElement>("titleFont").value || "Arial",
          fontWeight: styleVal.includes("bold") ? "bold" : "normal",
          fontStyle: styleVal.includes("italic") ? "italic" : "normal",
          align: ($<HTMLSelectElement>("titleAlign").value ||
            "center") as TitleAlign,
          position: ($<HTMLSelectElement>("titlePosition").value ||
            "bottom") as TitlePosition,
        },
      },
    });
  });
};
$("play").onclick = () =>
  run(async () => {
    if (preview.playing) preview.pause();
    else await preview.play();
    updateTime(preview.timeUs);
  });
$("rewind").onclick = () => seekTo(0);
/** Sync the title start/end inputs to the current playhead position. */
function syncTitleTime() {
  const startInput = $<HTMLInputElement>("titleStart");
  const endInput = $<HTMLInputElement>("titleEnd");
  startInput.value = (preview.timeUs / 1e6).toFixed(3);
  endInput.value = ((preview.timeUs + 5e6) / 1e6).toFixed(3);
}
$("titleUseTime").onclick = () => syncTitleTime();
$<HTMLInputElement>("scrub").oninput = () =>
  seekTo(Number($<HTMLInputElement>("scrub").value));
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
  const target = e.target as HTMLElement;
  if (
    !target.closest("input,textarea,select") &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    selected
  ) {
    if (e.key.toLowerCase() === "i") run(markIn);
    if (e.key.toLowerCase() === "o") run(markOut);
  }
  if (target.closest("input,textarea,select,button")) return;
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
