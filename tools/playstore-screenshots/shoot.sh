#!/bin/bash
# shoot.sh
# Captures the current screen of the running tablet AVD into
# output/<AVD_NAME>/<LABEL>.png. Numbers the file with a sequence
# prefix so the screenshots sort in capture order.
#
# Usage:
#   ./shoot.sh Alate_Tablet_7inch home
#   ./shoot.sh Alate_Tablet_7inch history-deck
#   ./shoot.sh Alate_Tablet_7inch fitresult

set -e

AVD="$1"
LABEL="$2"

if [ -z "$AVD" ] || [ -z "$LABEL" ]; then
  echo "Usage: $0 <AVD_NAME> <LABEL>"
  exit 1
fi

ADB="C:/Users/mailt/AppData/Local/Android/Sdk/platform-tools/adb.exe"
OUT_DIR="$(dirname "$0")/output/$AVD"
mkdir -p "$OUT_DIR"

# Sequence prefix — count existing PNGs to keep capture order
SEQ=$(printf "%02d" $(($(ls "$OUT_DIR"/*.png 2>/dev/null | wc -l) + 1)))
NAME="${SEQ}-${LABEL}.png"

MSYS_NO_PATHCONV=1 "$ADB" -s emulator-5554 shell screencap -p "/sdcard/$NAME"
MSYS_NO_PATHCONV=1 "$ADB" -s emulator-5554 pull "/sdcard/$NAME" "$OUT_DIR/$NAME" > /dev/null
MSYS_NO_PATHCONV=1 "$ADB" -s emulator-5554 shell rm "/sdcard/$NAME"

echo "[saved] $OUT_DIR/$NAME ($(stat -c%s "$OUT_DIR/$NAME") bytes)"
