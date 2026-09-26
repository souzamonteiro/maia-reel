import { chromium } from "@playwright/test";
import { createServer } from "vite";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    locale: "pt-BR",
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.testGains = [];
    const original = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = original.call(this);
      window.testGains.push(gain);
      return gain;
    };
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator("#language").selectOption("pt");
  for (const color of ["red", "blue"]) {
    const png = await page.evaluate((color) => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 180;
      const ctx = c.getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 320, 180);
      return c.toDataURL().split(",")[1];
    }, color);
    await page.locator("#mediaInput").setInputFiles({
      name: color + ".png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll(".asset strong")].some(
          (el) => el.textContent === name,
        ),
      color + ".png",
    );
    await page
      .locator(".asset")
      .last()
      .getByRole("button", { name: "＋ Adicionar", exact: true })
      .click();
    await page.locator("#out").fill("2");
    await page
      .getByRole("button", { name: "Aplicar corte", exact: true })
      .click();
  }
  const wav = Buffer.alloc(44 + 96000 * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 96000; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 440) / 48000) * 8000),
      44 + i * 2,
    );
  await page
    .locator("#mediaInput")
    .setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: wav });
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".asset strong")].some(
      (el) => el.textContent === "tone.wav",
    ),
  );
  for (let i = 0; i < 2; i++)
    await page
      .locator(".asset")
      .last()
      .getByRole("button", { name: "＋ Adicionar", exact: true })
      .click();
  await page.locator("#transitionAudio").check();
  await page.locator("#transitionDuration").fill("1");
  await page.locator("#applyTransition").click();
  assert.equal(await page.locator(".clip.audio.has-transition").count(), 1);
  await page.locator(".clip.video").nth(1).click();
  await page.locator("#transitionVideo").selectOption("black");
  await page.locator("#transitionDuration").fill("1");
  await page.locator("#applyTransition").click();
  assert.equal(await page.locator(".clip.video.has-transition").count(), 1);
  await page.locator("#undo").click();
  assert.equal(await page.locator(".clip.video.has-transition").count(), 0);
  await page.locator("#redo").click();
  assert.equal(await page.locator(".clip.video.has-transition").count(), 1);
  await page.locator("#language").selectOption("en");
  assert.equal(
    await page.locator("#applyTransition").innerText(),
    "Apply transition",
  );
  await page.locator("#language").selectOption("pt");
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [800, 800],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    const bounds = await page.evaluate(() => {
      const rect = (s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      };
      return {
        viewer: rect(".viewer"),
        inspector: rect(".inspector"),
        timeline: rect(".timeline"),
        scroll: document.querySelector(".inspector").scrollHeight,
        client: document.querySelector(".inspector").clientHeight,
      };
    });
    assert.ok(
      bounds.timeline.top < height,
      JSON.stringify({ width, height, bounds }),
    );
    if (width > 700)
      assert.ok(Math.abs(bounds.inspector.bottom - bounds.viewer.bottom) < 2);
    assert.ok(bounds.scroll > bounds.client);
    const before = bounds.timeline.top;
    await page.locator("#titleGroup > summary").click();
    const after = await page
      .locator(".timeline")
      .evaluate((el) => el.getBoundingClientRect().top + scrollY);
    assert.ok(Math.abs(before - after) < 2);
    await page.locator("#titleGroup > summary").click();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const seek = async (time) => {
    await page.locator("#scrub").evaluate((el, time) => {
      el.value = String(time * 1e6);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, time);
    await page.waitForTimeout(200);
    return page
      .locator("#preview")
      .evaluate((c) =>
        Array.from(
          c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data,
        ),
      );
  };
  const red = await seek(1);
  assert.ok(red[0] > 245 && red[2] < 10);
  const half = await seek(1.75);
  assert.ok(half[0] > 110 && half[0] < 145);
  const black = await seek(2);
  assert.ok(black.slice(0, 3).every((v) => v < 5));
  const gain = await page.evaluate(() => window.testGains.at(-1).gain.value);
  assert.equal(gain, 0);
  const blue = await seek(2.25);
  assert.ok(blue[2] > 110 && blue[2] < 145);
  assert.ok(
    Math.abs(
      (await page.evaluate(() => window.testGains.at(-1).gain.value)) - 0.5,
    ) < 0.01,
  );
  await page.locator("#transitionVideo").selectOption("white");
  await page.locator("#applyTransition").click();
  const white = await seek(2);
  assert.ok(white.slice(0, 3).every((v) => v > 250));
  await mkdir("test-results", { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector(".inspector").scrollTop = 0;
  });
  await page.screenshot({
    path: "test-results/transitions-layout.png",
    fullPage: true,
  });
  const saved = page.waitForEvent("download");
  await page.locator("#save").click();
  const json = await saved;
  await json.saveAs("test-results/transitions.maiareel.json");
  await page.locator("#probe").click();
  await page.waitForFunction(
    () => !document.querySelector("#export").disabled,
    null,
    { timeout: 60000 },
  );
  for (const color of ["white", "black"]) {
    await page.locator("#transitionVideo").selectOption(color);
    await page.locator("#applyTransition").click();
    await page.locator("#format").selectOption("mp4");
    const downloaded = page.waitForEvent("download", { timeout: 120000 });
    await page.locator("#export").click();
    const result = await downloaded;
    const output = `test-results/transition-${color}.mp4`;
    await result.saveAs(output);
    await page.evaluate(() => {
      document.querySelector("#verify-output")?.remove();
      const input = document.createElement("input");
      input.type = "file";
      input.id = "verify-output";
      document.body.append(input);
    });
    await page.locator("#verify-output").setInputFiles(output);
    const decoded = await page.evaluate(async () => {
      const file = document.querySelector("#verify-output").files[0];
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.muted = true;
      v.src = url;
      await new Promise((resolve, reject) => {
        v.onloadeddata = resolve;
        v.onerror = reject;
      });
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d");
      const pixels = [];
      for (const time of [1, 1.75, 2, 2.25, 3]) {
        await new Promise((resolve) => {
          v.onseeked = resolve;
          v.currentTime = time;
        });
        ctx.drawImage(v, 0, 0, 1, 1);
        pixels.push(Array.from(ctx.getImageData(0, 0, 1, 1).data));
      }
      const audio = new AudioContext();
      const buffer = await audio.decodeAudioData(await file.arrayBuffer());
      const samples = buffer.getChannelData(0);
      const rms = (start, end) => {
        let sum = 0;
        let n = 0;
        for (
          let i = Math.floor(start * buffer.sampleRate);
          i < Math.floor(end * buffer.sampleRate);
          i++
        ) {
          sum += samples[i] ** 2;
          n++;
        }
        return Math.sqrt(sum / n);
      };
      const levels = [
        rms(1, 1.1),
        rms(1.74, 1.76),
        rms(1.99, 2.01),
        rms(2.24, 2.26),
        rms(3, 3.1),
      ];
      const duration = v.duration;
      URL.revokeObjectURL(url);
      await audio.close();
      return { duration, pixels, levels };
    });
    assert.ok(Math.abs(decoded.duration - 4) < 0.04);
    assert.ok(decoded.pixels[0][0] > 240 && decoded.pixels[4][2] > 240);
    assert.ok(
      decoded.pixels[2]
        .slice(0, 3)
        .every((v) => (color === "white" ? v > 240 : v < 15)),
      JSON.stringify(decoded),
    );
    assert.ok(
      decoded.levels[2] < decoded.levels[0] * 0.08,
      JSON.stringify(decoded.levels),
    );
    for (const i of [1, 3])
      assert.ok(
        decoded.levels[i] / decoded.levels[0] > 0.4 &&
          decoded.levels[i] / decoded.levels[0] < 0.6,
        JSON.stringify(decoded.levels),
      );
    console.log(color, decoded);
  }
  await page.locator("#removeTransition").click();
  assert.equal(await page.locator(".clip.video.has-transition").count(), 0);
  const noEffect = await seek(2);
  assert.ok(noEffect[2] > 245 && noEffect[0] < 10);
  // A fade must preserve transparent PNG pixels and chroma-key holes.
  const alphaCases = await page.evaluate(async () => {
    const { Preview } = await import("/packages/preview/index.ts");
    const { Exporter } = await import("/packages/export/index.ts");
    const { MediaRegistry } = await import("/packages/media/index.ts");
    const { newProject } = await import("/packages/project/index.ts");
    const results = [];
    for (const keyed of [false, true]) {
      const registry = new MediaRegistry();
      const p = newProject();
      p.canvas.width = 320;
      p.canvas.height = 180;
      for (const [id, color] of [
        ["bg", "blue"],
        ["fg", keyed ? "#00ff00" : null],
      ]) {
        const c = document.createElement("canvas");
        c.width = 320;
        c.height = 180;
        const ctx = c.getContext("2d");
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 320, 180);
        }
        if (id === "fg") {
          ctx.fillStyle = "red";
          ctx.fillRect(100, 50, 120, 80);
        }
        const blob = await new Promise((resolve) => c.toBlob(resolve));
        const file = new File([blob], id + ".png", { type: "image/png" });
        registry.attach(id, file);
        p.assets.push({
          id,
          kind: "image",
          displayName: file.name,
          sizeBytes: file.size,
          lastModifiedMs: file.lastModified,
          durationUs: 2e6,
        });
      }
      const clip = {
        id: "background",
        assetId: "bg",
        startUs: 0,
        sourceInUs: 0,
        sourceOutUs: 2e6,
        gain: 1,
      };
      p.tracks[0].clips.push(clip);
      const foreground = {
        ...clip,
        id: "first",
        assetId: "fg",
        sourceOutUs: 1e6,
      };
      if (keyed)
        foreground.chromaKey = { color: "#00ff00", similarity: 0.1, blend: 0 };
      p.tracks.push({
        id: "v2",
        kind: "video",
        zIndex: 2,
        muted: false,
        clips: [
          foreground,
          {
            ...foreground,
            id: "second",
            startUs: 1e6,
            transition: {
              previousId: "first",
              durationUs: 1e6,
              video: "white",
              audio: false,
            },
          },
        ],
      });
      const canvas = document.createElement("canvas");
      const preview = new Preview(canvas, () => p, registry);
      preview.seek(1e6);
      await new Promise((resolve) => setTimeout(resolve, 250));
      const sample = (ctx, x, y) =>
        Array.from(ctx.getImageData(x, y, 1, 1).data);
      const previewPixels = [
        sample(canvas.getContext("2d"), 10, 10),
        sample(canvas.getContext("2d"), 160, 90),
      ];
      preview.dispose();
      const exporter = new Exporter();
      const output = await exporter.render(p, registry, "mp4");
      const video = document.createElement("video");
      video.muted = true;
      const url = URL.createObjectURL(output);
      video.src = url;
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
      });
      await new Promise((resolve) => {
        video.onseeked = resolve;
        video.currentTime = 1;
      });
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      const exportedPixels = [sample(ctx, 10, 10), sample(ctx, 160, 90)];
      URL.revokeObjectURL(url);
      registry.clear();
      results.push({ keyed, previewPixels, exportedPixels });
    }
    return results;
  });
  for (const result of alphaCases) {
    for (const [background, foreground] of [
      result.previewPixels,
      result.exportedPixels,
    ]) {
      assert.ok(
        background[2] > 230 && background[0] < 30,
        JSON.stringify(result),
      );
      assert.ok(
        foreground.slice(0, 3).every((v) => v > 240),
        JSON.stringify(result),
      );
    }
  }
  console.log(
    "Transparent PNG and chroma alpha preserved in preview and export",
    alphaCases,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Responsive layout, accordion, transitions, preview, audio and MP4 export passed",
  );
} finally {
  await browser?.close();
  await server.close();
}
