#!/usr/bin/env bash
# Concatenate rendered shots (in filename order) into one episode with ffmpeg.
# Usage: bash scripts/stitch.sh output/episode-01 output/episode-01.mp4
set -euo pipefail
IN_DIR="${1:?shot folder}"; OUT="${2:?output file}"
LIST="$(mktemp)"
for f in "$IN_DIR"/*.mp4; do echo "file '$(realpath "$f")'" >> "$LIST"; done
ffmpeg -y -f concat -safe 0 -i "$LIST" -c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 192k "$OUT"
rm -f "$LIST"
echo "Wrote $OUT"
