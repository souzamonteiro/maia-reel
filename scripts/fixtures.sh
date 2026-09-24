#!/usr/bin/env bash
set -eu
mkdir -p examples/generated
ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'testsrc2=size=320x180:rate=30:duration=3' -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=3' -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest examples/generated/first.mp4
ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'color=c=blue:size=320x180:rate=24:duration=2' -f lavfi -i 'sine=frequency=880:sample_rate=48000:duration=2' -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest examples/generated/second.mp4
ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'sine=frequency=220:sample_rate=48000:duration=6' examples/generated/music.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'color=c=red:size=320x180' -frames:v 1 -update 1 examples/generated/still.png
ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'color=c=green:size=320x180:rate=30:duration=1' -c:v libx264 -pix_fmt yuv420p examples/generated/silent.mp4
