#!/bin/bash
# Screenshot a bench viewer URL to a PNG with the local Chrome.
#   scripts/rsi/shot.sh "<query>" out.png [width] [height] [scale]
set -euo pipefail
PORT="${RSI_PORT:-3000}"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor="${5:-1}" --window-size="${3:-1340},${4:-1400}" --virtual-time-budget=8000 \
  --screenshot="$2" "http://localhost:${PORT}/dev/rsi?$1" >/dev/null 2>&1
echo "$2"
