/** One sampled frame; source bytes remain behind an object URL. */
export async function thumbnail(
  url: string,
  timeSeconds: number,
): Promise<string> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Miniatura: tempo limite.")),
        10000,
      );
      video.onerror = () => {
        clearTimeout(timer);
        reject(Error("Miniatura indisponível."));
      };
      video.onloadeddata = () => {
        video.currentTime = Math.min(timeSeconds, video.duration * 0.5);
      };
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 160, 90);
    const scale = Math.min(160 / video.videoWidth, 90 / video.videoHeight);
    ctx.drawImage(
      video,
      (160 - video.videoWidth * scale) / 2,
      (90 - video.videoHeight * scale) / 2,
      video.videoWidth * scale,
      video.videoHeight * scale,
    );
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
/** Explicit, bounded whole-file decoding, never part of the default import path. */
export async function waveform(
  file: File,
  durationUs: number,
): Promise<string> {
  if (file.size > 20 * 1024 * 1024 || durationUs > 120e6)
    throw Error(
      "Forma de onda: limite de 20 MB e 2 minutos para decodificação em memória.",
    );
  const audio = new AudioContext();
  try {
    const decoded = await audio.decodeAudioData(await file.arrayBuffer());
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 60;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#72c8bd";
    ctx.lineWidth = 1;
    const samples = decoded.getChannelData(0);
    const stride = Math.ceil(samples.length / 320);
    for (let x = 0; x < 320; x++) {
      let peak = 0;
      for (
        let i = x * stride;
        i < Math.min((x + 1) * stride, samples.length);
        i++
      )
        peak = Math.max(peak, Math.abs(samples[i]));
      ctx.beginPath();
      ctx.moveTo(x, 30 - peak * 29);
      ctx.lineTo(x, 30 + peak * 29);
      ctx.stroke();
    }
    return canvas.toDataURL();
  } finally {
    await audio.close();
  }
}
