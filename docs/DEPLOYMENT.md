# Run and deploy

Node 22.14+ and npm are sufficient for the app. Native FFmpeg and Chrome are only required for the acceptance tests.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The install hook copies the pinned single-thread FFmpeg core into `public/ffmpeg`; Vite copies it into `dist`. No CDN, external fonts, analytics, upload API or runtime account is involved. Installation uses the npm registry. The core is a separate ~32 MB download when the user checks the export engine; production should serve it with compression/caching as appropriate.

```sh
npm run lint
npm test
npm run fixtures
npm run build
# Keep a dev server running in another terminal:
npm run test:browser
```

Set `CHROME_PATH` if Chrome is not at `/opt/google/chrome/chrome`. `EDITOR_URL` can target a production build served with a static server. The fixture generator requires native ffmpeg with libx264 and AAC. Generated test media and screenshots are ignored by Git.

## Nginx / Maia Edge

Copy the contents of `dist/` to the document root after `npm ci && npm run build`. Serve at the origin root; subdirectory hosting is not configured. Example server configuration:

```nginx
server {
    listen 80;
    server_name reel.example.org;
    root /srv/maia-reel;
    include /etc/nginx/mime.types;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /ffmpeg/ {
        try_files $uri =404;
        types { application/javascript js; application/wasm wasm; }
    }
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
}
```

Configure TLS at the hosting edge. The selected core is single-threaded and does not require SharedArrayBuffer, COOP or COEP. No isolation headers are added by the development server. Use the same-origin worker and core paths; do not replace them with a CDN without revalidating worker and CORS behavior. Never cache `/ffmpeg/` indefinitely under unversioned filenames.

## Resource limits and recovery

Export copies only referenced inputs into worker memory, after checking the total is at most 256 MiB and timeline at most five minutes. Decoded frames, filter graphs and output need additional memory, so these are safeguards rather than a guarantee against out-of-memory failures. Cancel terminates the worker; checking the engine again creates a clean worker. All virtual files are removed in `finally` and the worker is released after each export. Each new export creates a fresh worker. The main UI remains responsive while FFmpeg runs.

Preview caps simultaneously active audio/video clips at eight. Thumbnail generation processes one video at a time. Waveforms are explicitly requested, decode only files up to 20 MiB / two minutes, and close their AudioContext. Import reads only the signature and browser metadata/first decoded frame via object URLs. Browser decoder buffering is controlled by the browser, not a promise of zero buffering.

## Release boundaries

Chrome on Linux is the automated acceptance target. Safari, Firefox, mobile, HDR, arbitrary rotation metadata and VFR synchronization have not passed an acceptance matrix. Preview uses an audio clock when available and corrects element drift beyond 120 ms; this is a correction policy, not a measured guarantee. Export normalizes video to project frame rate. Performance and peak WASM memory for representative 1080p production footage still need a release benchmark.
