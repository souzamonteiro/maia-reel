# Synthetic fixtures

Run `npm run fixtures` with native FFmpeg installed. The generator creates test patterns, solid colors and sine tones from mathematical sources; no third-party footage, fonts, music or models are used. The generator is Apache-2.0 with this repository; generated media may be used freely for testing. Nothing generated is committed.

- `first.mp4`: 3 seconds, 320×180, 30 fps, H.264/AAC, 440 Hz.
- `second.mp4`: 2 seconds, 320×180, 24 fps, H.264/AAC, 880 Hz.
- `music.wav`: 6 seconds, mono 48 kHz PCM, 220 Hz.
- `still.png`: solid red 320×180 image.
- `silent.mp4`: one-second solid green H.264 video without an audio stream.

Browser tests assemble these sources, trim and split, move the second clip, mix music at 0.25 gain and rasterize a title with the same canvas routine as the preview. Results stay in `test-results/`.
