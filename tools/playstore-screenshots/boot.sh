#!/bin/bash
# boot.sh
# Boots a tablet AVD, installs the alate APK, and leaves it running.
# You then walk through the app manually (it's an RN app with heavy
# first-render — auto-tap walkthroughs ANR on cold boot AVDs).
# Capture screens as you go via `./shoot.sh AVD_NAME label`.
#
# Usage:
#   ./boot.sh Alate_Tablet_7inch  /tmp/alate-apk/app-release.apk
#   ./boot.sh Alate_Tablet_10inch /tmp/alate-apk/app-release.apk
# (omit APK to skip install)

set -e

AVD="$1"
APK="$2"

if [ -z "$AVD" ]; then
  echo "Usage: $0 <AVD_NAME> [APK_PATH]"
  echo "Example: $0 Alate_Tablet_7inch /tmp/alate-apk/app-release.apk"
  exit 1
fi

SDK="C:/Users/mailt/AppData/Local/Android/Sdk"
EMULATOR="$SDK/emulator/emulator.exe"
ADB="$SDK/platform-tools/adb.exe"

OUT_DIR="$(dirname "$0")/output/$AVD"
mkdir -p "$OUT_DIR"

# Kill any previous emulator instance to keep adb device-id stable
"$ADB" -s emulator-5554 emu kill 2>/dev/null || true
sleep 2

echo "[boot] launching $AVD (cold boot ~30–90 s)"
"$EMULATOR" -avd "$AVD" -no-snapshot-save -no-boot-anim -no-audio > "$OUT_DIR/emulator.log" 2>&1 &
EMU_PID=$!
echo "[boot] EMU_PID=$EMU_PID"

echo "[wait] emulator → adb"
for i in {1..120}; do
  if "$ADB" devices | grep -q "emulator-5554.*device$"; then
    break
  fi
  sleep 1
done

echo "[wait] sys.boot_completed=1"
for i in {1..150}; do
  STATUS=$("$ADB" -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$STATUS" = "1" ]; then
    break
  fi
  sleep 1
done
sleep 5

if [ -n "$APK" ] && [ -f "$APK" ]; then
  echo "[install] $APK"
  "$ADB" -s emulator-5554 install -r "$APK"
  echo "[launch] com.tessellate.alate"
  "$ADB" -s emulator-5554 shell monkey -p com.tessellate.alate -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
fi

echo ""
echo "AVD is up. Walk through the app manually, then run:"
echo "  ./shoot.sh $AVD <label>"
echo "Examples:"
echo "  ./shoot.sh $AVD home"
echo "  ./shoot.sh $AVD history-deck"
echo "  ./shoot.sh $AVD fitresult"
echo "When done:"
echo "  \"$ADB\" -s emulator-5554 emu kill"
