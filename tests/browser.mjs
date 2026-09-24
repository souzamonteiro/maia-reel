import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const externalRequests = [];
const editorUrl = process.env.EDITOR_URL || "http://127.0.0.1:5173";
page.on("request", (r) => {
  if (
    /^https?:/.test(r.url()) &&
    new URL(r.url()).origin !== new URL(editorUrl).origin
  )
    externalRequests.push(r.url());
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const reporter = setInterval(async () => {
  try {
    console.log(
      "Browser:",
      await page.locator("#status").textContent({ timeout: 1000 }),
    );
  } catch {}
}, 15000);
try {
  await page.goto(editorUrl);
  await page.locator("#mediaInput").setInputFiles({
    name: "fake.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not a media file"),
  });
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("assinatura"),
  );
  assert.equal(await page.locator(".asset").count(), 0);
  await page
    .locator("#mediaInput")
    .setInputFiles([
      "examples/generated/first.mp4",
      "examples/generated/second.mp4",
      "examples/generated/music.wav",
    ]);
  await page.waitForFunction(
    () => document.querySelectorAll(".asset").length === 3,
  );
  for (let i = 0; i < 3; i++)
    await page
      .locator(".asset")
      .nth(i)
      .getByRole("button", { name: "＋ Adicionar" })
      .click();
  await page
    .locator(".asset")
    .first()
    .getByRole("button", { name: "Gerar miniatura" })
    .click();
  await page.locator(".asset-visual").first().waitFor();
  await page
    .locator(".asset")
    .nth(2)
    .getByRole("button", { name: "Gerar forma de onda" })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".asset-visual").length === 2,
  );
  await page.locator("#addAudioTrack").click();
  assert.equal(await page.locator(".track").count(), 3);
  await page.locator("#undo").click();
  assert.equal(await page.locator(".track").count(), 2);
  await page.locator(".clip.video").first().click();
  await page.locator("#in").fill("0.5");
  await page.locator("#out").fill("2.5");
  await page.getByRole("button", { name: "Aplicar corte" }).click();
  await page.locator("#scrub").evaluate((el) => {
    el.value = "1000000";
    el.dispatchEvent(new Event("input"));
  });
  await page.locator("#split").click();
  assert.equal(await page.locator(".clip.video").count(), 3);
  await page.locator("#undo").click();
  assert.equal(await page.locator(".clip.video").count(), 2);
  await page.locator("#redo").click();
  assert.equal(await page.locator(".clip.video").count(), 3);
  await page.locator(".clip.video").nth(1).click();
  await page.locator("#start").fill("2");
  await page.locator("#move").click();
  await page.locator(".clip.audio").click();
  await page.locator("#gain").fill("0.25");
  await page.locator("#setGain").click();
  await page.locator("#out").fill("4");
  await page.getByRole("button", { name: "Aplicar corte" }).click();
  await page.locator("#titleText").fill("Olá Maia");
  await page.locator("#titleStart").fill("0");
  await page.locator("#titleEnd").fill("1.5");
  await page.locator("#titleForm button").click();
  await page.locator("#rewind").click();
  await page.locator("#play").click();
  await page.waitForFunction(
    () => Number(document.querySelector("#scrub").value) > 300000,
  );
  await page.locator("#play").click();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });
  const savedPromise = page.waitForEvent("download");
  await page.locator("#save").click();
  await (await savedPromise).saveAs("test-results/project.maiareel.json");
  const saved = JSON.parse(
    await readFile("test-results/project.maiareel.json", "utf8"),
  );
  assert.equal(saved.tracks[0].clips.length, 3);
  await page.reload();
  await page
    .locator("#projectInput")
    .setInputFiles("test-results/project.maiareel.json");
  await page.waitForFunction(
    () => document.querySelectorAll(".asset").length === 3,
  );
  assert.match(await page.locator("#assets").textContent(), /OFFLINE/);
  await page
    .locator("#relinkInput")
    .setInputFiles([
      "examples/generated/first.mp4",
      "examples/generated/second.mp4",
      "examples/generated/music.wav",
    ]);
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("3 mídia(s)"),
  );
  await page.locator("#probe").click();
  await page.waitForFunction(
    () => !document.querySelector("#export").disabled,
    {},
    { timeout: 120000 },
  );
  assert.match(await page.locator("#engine").textContent(), /mp4/);
  const start = Date.now();
  const outputPromise = page.waitForEvent("download", { timeout: 180000 });
  await page.locator("#export").click();
  const output = await outputPromise;
  await output.saveAs("test-results/output.mp4");
  const mp4ExportMs = Date.now() - start;
  const metadata = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        "test-results/output.mp4",
      ],
      { encoding: "utf8" },
    ),
  );
  assert.ok(Math.abs(Number(metadata.format.duration) - 4) < 1 / 30);
  assert.ok(metadata.streams.some((s) => s.codec_name === "h264"));
  assert.ok(metadata.streams.some((s) => s.codec_name === "aac"));
  const volume = spawnSync(
    "ffmpeg",
    ["-i", "test-results/output.mp4", "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  ).stderr;
  assert.ok(
    Number(volume.match(/mean_volume: ([-.0-9]+)/)[1]) > -45,
    "Export must contain audible signal",
  );
  const raw = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      "test-results/output.mp4",
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-",
    ],
    { maxBuffer: 10_000_000 },
  );
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const magnitude = (frequency, start) => {
    let re = 0,
      im = 0;
    for (let i = 0; i < 4800; i++) {
      const a = (2 * Math.PI * frequency * i) / 48000;
      re += samples[Math.round(start * 48000) + i] * Math.cos(a);
      im += samples[Math.round(start * 48000) + i] * Math.sin(a);
    }
    return Math.hypot(re, im) / 4800;
  };
  assert.ok(
    magnitude(440, 0.5) > magnitude(880, 0.5) * 8,
    "First source sound",
  );
  assert.ok(
    magnitude(880, 2.5) > magnitude(440, 2.5) * 8,
    "Second source sound follows picture cut",
  );
  assert.ok(magnitude(220, 0.5) > 0.003, "Music is mixed");
  const frame = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-ss",
    "2.5",
    "-i",
    "test-results/output.mp4",
    "-frames:v",
    "1",
    "-vf",
    "scale=1:1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  assert.ok(frame[2] > frame[0] + 100, "Second clip picture is blue");
  await page.locator("#scrub").evaluate((el) => {
    el.value = "500000";
    el.dispatchEvent(new Event("input"));
  });
  await page.waitForTimeout(500);
  const previewPixels = await page
    .locator("#preview")
    .evaluate((c) =>
      Array.from(c.getContext("2d").getImageData(480, 520, 320, 110).data),
    );
  const exportedPixels = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-ss",
    "0.5",
    "-i",
    "test-results/output.mp4",
    "-frames:v",
    "1",
    "-vf",
    "crop=320:110:480:520",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-",
  ]);
  let difference = 0;
  for (let i = 0; i < previewPixels.length; i++)
    difference += Math.abs(previewPixels[i] - exportedPixels[i]);
  assert.ok(
    difference / previewPixels.length < 12,
    "Preview/export title and picture parity",
  );
  await page.locator("#mediaInput").setInputFiles("test-results/output.mp4");
  await page.waitForFunction(
    () => document.querySelectorAll(".asset").length === 4,
  );
  await page.locator("#format").selectOption("webm");
  const webmStart = Date.now();
  const webmPromise = Promise.race([
    page.waitForEvent("download", { timeout: 180000 }),
    page
      .waitForFunction(
        () => document.querySelector("#status").dataset.error === "true",
        {},
        { timeout: 180000 },
      )
      .then(async () => {
        throw Error(await page.locator("#status").textContent());
      }),
  ]);
  await page.locator("#export").click();
  await (await webmPromise).saveAs("test-results/output.webm");
  const webmExportMs = Date.now() - webmStart;
  const webm = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "quiet",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        "test-results/output.webm",
      ],
      { encoding: "utf8" },
    ),
  );
  assert.ok(webm.streams.some((s) => s.codec_name === "vp8"));
  assert.ok(webm.streams.some((s) => s.codec_name === "vorbis"));
  assert.ok(Math.abs(Number(webm.format.duration) - 4) < 1 / 30);
  await page.locator("#export").click();
  await page.locator("#cancel").click();
  await page.waitForFunction(() => !document.querySelector("#probe").disabled);
  await page.locator("#probe").click();
  await page.waitForFunction(
    () => !document.querySelector("#export").disabled,
    {},
    { timeout: 120000 },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  await writeFile(
    "test-results/verification.json",
    JSON.stringify(
      {
        mp4ExportMs,
        webmExportMs,
        audioMeanDb: Number(volume.match(/mean_volume: ([-.0-9]+)/)[1]),
        titleCropMeanPixelError: difference / previewPixels.length,
        webm,
        externalRequests,
        metadata,
        browser: browser.version(),
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: import, trim, split, move, undo/redo, gain, title, playback, save/reload/relink, encoder probe, MP4/WebM export, picture/audio/title parity, reimport, cancellation/recovery and no external requests.",
  );
} catch (e) {
  console.error("UI status:", await page.locator("#status").textContent());
  console.error(errors);
  await page.screenshot({ path: "test-results/failure.png", fullPage: true });
  throw e;
} finally {
  clearInterval(reporter);
  await browser.close();
}
