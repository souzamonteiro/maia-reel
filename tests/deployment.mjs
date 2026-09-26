import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, symlink, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
const temp = await mkdtemp(path.join(tmpdir(), "reel-nginx-"));
let nginx, browser;
try {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  await symlink(path.resolve("dist"), path.join(temp, "maia-reel"));
  const config = path.join(temp, "nginx.conf");
  await writeFile(
    config,
    `pid ${temp}/nginx.pid; error_log ${temp}/error.log; events {} http {
    include /etc/nginx/mime.types; access_log off;
    client_body_temp_path ${temp}/body; proxy_temp_path ${temp}/proxy;
    server { listen 127.0.0.1:${port}; root ${temp}; index index.html;
      add_header Cross-Origin-Opener-Policy same-origin always;
      add_header Cross-Origin-Embedder-Policy require-corp always;
      add_header Cross-Origin-Resource-Policy same-origin always;
      location / { try_files $uri $uri/ $uri/index.html =404; }
    }
  }`,
  );
  execFileSync("nginx", ["-t", "-p", temp, "-c", config]);
  nginx = spawn("nginx", ["-p", temp, "-c", config, "-g", "daemon off;"], {
    stdio: "ignore",
  });
  const base = `http://127.0.0.1:${port}/maia-reel/`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const wasm = await fetch(base + "ffmpeg/ffmpeg-core.wasm");
  assert.equal(wasm.status, 200);
  assert.match(wasm.headers.get("content-type"), /application\/wasm/);
  await wasm.body.cancel();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ locale: "pt-BR" });
  const errors = [];
  const badRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(base))
      badRequests.push(r.url());
  });
  await page.goto(base);
  assert.equal(await page.locator("html").getAttribute("lang"), "pt");
  await page.locator("#language").selectOption("en");
  assert.equal(await page.locator("#play").innerText(), "Play");
  await page.reload();
  assert.equal(await page.locator("#language").inputValue(), "en");
  await page.locator("#language").selectOption("pt");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 320, 180);
    return c.toDataURL().split(",")[1];
  });
  await page.locator("#mediaInput").setInputFiles({
    name: "red.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page
    .locator(".asset")
    .first()
    .getByRole("button", { name: "＋ Adicionar" })
    .click();
  await page.locator("#titleText").fill("Reproduzir — texto original");
  await page.locator("#out").fill("1");
  const clip = await page.locator(".clip").innerText();
  await page.locator("#language").selectOption("es");
  assert.equal(await page.locator("#play").innerText(), "Reproducir");
  assert.equal(await page.locator("#out").inputValue(), "1");
  assert.equal(
    await page.locator("#titleText").inputValue(),
    "Reproduzir — texto original",
  );
  assert.equal(await page.locator(".clip").innerText(), clip);
  await page.locator("#language").selectOption("pt");
  await page.getByRole("button", { name: "Aplicar corte" }).click();
  await page.locator("#probe").click();
  await page.waitForFunction(
    () => !document.querySelector("#export").disabled,
    { timeout: 60000 },
  );
  await page.locator("#format").selectOption("mp4");
  const downloaded = page.waitForEvent("download", { timeout: 120000 });
  await page.locator("#export").click();
  const download = await downloaded;
  await mkdir("test-results", { recursive: true });
  const output = path.resolve("test-results/nginx-export.mp4");
  await download.saveAs(output);
  await page.evaluate(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.id = "verify-video";
    document.body.append(input);
  });
  await page.locator("#verify-video").setInputFiles(output);
  const result = await page.evaluate(async () => {
    const file = document.querySelector("#verify-video").files[0];
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.src = url;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = reject;
    });
    video.currentTime = 0.5;
    await new Promise((resolve) => {
      video.onseeked = resolve;
    });
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    ctx.drawImage(
      video,
      video.videoWidth / 2,
      video.videoHeight / 2,
      1,
      1,
      0,
      0,
      1,
      1,
    );
    const pixel = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    const value = {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      pixel,
    };
    URL.revokeObjectURL(url);
    return value;
  });
  console.log("Decoded output", result);
  assert.ok(Math.abs(result.duration - 1) < 0.04);
  assert.ok(
    result.pixel[0] > 150 && result.pixel[1] < 80 && result.pixel[2] < 80,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(badRequests, []);
  console.log("Nginx subpath import/export/redecode passed", result);
} finally {
  if (browser) await browser.close();
  if (nginx) {
    nginx.kill("SIGTERM");
    await new Promise((r) => nginx.once("exit", r));
  }
  await rm(temp, { recursive: true, force: true });
}
