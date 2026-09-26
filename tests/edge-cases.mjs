import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/opt/google/chrome/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ locale: "pt-BR" });
page.on("dialog", (d) => d.accept());
try {
  await page.goto(process.env.EDITOR_URL || "http://127.0.0.1:5173");
  await page
    .locator("#mediaInput")
    .setInputFiles([
      "examples/generated/still.png",
      "examples/generated/silent.mp4",
    ]);
  await page.waitForFunction(
    () => document.querySelectorAll(".asset").length === 2,
  );
  await page
    .locator(".asset")
    .first()
    .getByRole("button", { name: "＋ Adicionar" })
    .click();
  await page.locator("#out").fill("1");
  await page.getByRole("button", { name: "Aplicar corte" }).click();
  await page.locator("#start").fill("0.5");
  await page.locator("#move").click();
  await page
    .locator(".asset")
    .nth(1)
    .getByRole("button", { name: "＋ Adicionar" })
    .click();
  const save = page.waitForEvent("download");
  await page.locator("#save").click();
  await (await save).saveAs("test-results/edge.maiareel.json");
  await page.reload();
  await page
    .locator("#projectInput")
    .setInputFiles("test-results/edge.maiareel.json");
  await page.waitForFunction(
    () => document.querySelectorAll(".asset").length === 2,
  );
  await page.locator("#probe").click();
  await page.waitForFunction(
    () => !document.querySelector("#export").disabled,
    {},
    { timeout: 120000 },
  );
  await page.locator("#export").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Revincule"),
  );
  await page
    .locator("#relinkInput")
    .setInputFiles([
      "examples/generated/still.png",
      "examples/generated/silent.mp4",
    ]);
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("2 mídia(s)"),
  );
  const result = Promise.race([
    page.waitForEvent("download", { timeout: 120000 }),
    page
      .waitForFunction(
        () => document.querySelector("#status").dataset.error === "true",
        {},
        { timeout: 120000 },
      )
      .then(async () => {
        throw Error(await page.locator("#status").textContent());
      }),
  ]);
  await page.locator("#export").click();
  await (await result).saveAs("test-results/edge.mp4");
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "quiet", "-show_format", "-of", "json", "test-results/edge.mp4"],
      { encoding: "utf8" },
    ),
  );
  assert.ok(Math.abs(Number(probe.format.duration) - 2.5) < 1 / 30);
  function pixel(t) {
    return execFileSync("ffmpeg", [
      "-v",
      "error",
      "-ss",
      String(t),
      "-i",
      "test-results/edge.mp4",
      "-frames:v",
      "1",
      "-vf",
      "scale=1:1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "-",
    ]);
  }
  assert.ok(Math.max(...pixel(0.25)) < 5, "Gap is black");
  const red = pixel(0.75);
  assert.ok(red[0] > 200 && red[1] < 10, "Still image is red");
  const green = pixel(2);
  assert.ok(green[1] > 100 && green[0] < 10, "Silent video is green");
  const raw = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    "test-results/edge.mp4",
    "-f",
    "f32le",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-",
  ]);
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  assert.ok(
    samples.every((v) => Math.abs(v) < 0.00001),
    "No invented audio",
  );
  console.log(
    "PASS: still image, silent video, timeline gap, offline export blocking, relink and silent audio output.",
  );
} catch (e) {
  console.error(await page.locator("#status").textContent());
  throw e;
} finally {
  await browser.close();
}
