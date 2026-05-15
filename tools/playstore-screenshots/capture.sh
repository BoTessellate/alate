#!/bin/bash
# capture.sh
# Boots a tablet AVD, installs the latest alate APK, walks through
# the major screens, and pulls screenshots into ./output/<avd>/
#
# Usage:
#   ./capture.sh Alate_Tablet_7inch  /tmp/alate-apk/app-release.apk
#   ./capture.sh Alate_Tablet_10inch /tmp/alate-apk/app-release.apk
#
# What it captures:
#   01-home.png      — Home / Check tab (initial state)
#   02-history-empty.png — empty History
#   03-history-deck.png  — History with seeded demo data (deck of cards)
#   04-fitresult.png — FitResult screen for one of the seeded cards
#   05-account.png   — Account / Profile tab
#   06-bodyprofile.png — BodyProfile (AvatarSetup) screen
#
# Tap coordinates are computed from the AVD's known WIDTH x HEIGHT.
# AVDs are portrait-only at 9:16 aspect (1080x1920 / 1440x2560), so
# the math scales linearly across them.

set -e

# Note on Git-Bash path conversion: MSYS rewrites bare `/sdcard/...`
# paths into Windows equivalents when handed to a Windows .exe like
# adb. We can't disable conversion globally because the APK path
# DOES need to be a Windows path for `adb install`. The fix below
# uses the `//sdcard/` double-slash escape inline on every adb-shell
# call that touches a posix path on the device.

AVD="$1"
APK="$2"

if [ -z "$AVD" ] || [ -z "$APK" ]; then
  echo "Usage: $0 <AVD_NAME> <APK_PATH>"
  echo "Example: $0 Alate_Tablet_7inch /tmp/alate-apk/app-release.apk"
  exit 1
fi

if [ ! -f "$APK" ]; then
  echo "ERROR: APK not found at $APK"
  exit 1
fi

SDK="C:/Users/mailt/AppData/Local/Android/Sdk"
EMULATOR="$SDK/emulator/emulator.exe"
ADB="$SDK/platform-tools/adb.exe"

OUT_DIR="$(dirname "$0")/output/$AVD"
mkdir -p "$OUT_DIR"

# --- Boot the AVD in the background ----------------------------------
echo "[boot] launching $AVD (this takes 30–90 s on cold boot)"
"$EMULATOR" -avd "$AVD" -no-snapshot-save -no-boot-anim -no-audio > "$OUT_DIR/emulator.log" 2>&1 &
EMU_PID=$!

cleanup() {
  echo "[cleanup] shutting down $AVD"
  "$ADB" -s emulator-5554 emu kill 2>/dev/null || true
  wait "$EMU_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for the emulator to register with adb
echo "[wait]  emulator → adb (up to 90 s)"
for i in {1..90}; do
  if "$ADB" devices | grep -q "emulator-5554.*device$"; then
    break
  fi
  sleep 1
done

# Wait for full boot
echo "[wait]  sys.boot_completed=1 (up to 120 s)"
for i in {1..120}; do
  STATUS=$("$ADB" -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$STATUS" = "1" ]; then
    break
  fi
  sleep 1
done

# Read the actual screen dimensions from the running AVD so taps scale
SIZE=$("$ADB" -s emulator-5554 shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1)
W=$(echo "$SIZE" | cut -dx -f1)
H=$(echo "$SIZE" | cut -dx -f2)
echo "[info]  screen $W x $H"

# Helpers ------------------------------------------------------------
tap_pct() {
  # tap at percentage-of-screen coords; usage: tap_pct 50 90 (center, 90% down)
  local PX=$1 PY=$2
  local X=$(( W * PX / 100 ))
  local Y=$(( H * PY / 100 ))
  "$ADB" -s emulator-5554 shell input tap $X $Y
}
shoot() {
  local NAME="$1"
  echo "[shot]  $NAME"
  MSYS_NO_PATHCONV=1 "$ADB" -s emulator-5554 shell screencap -p "/sdcard/$NAME"
  MSYS_NO_PATHCONV=1 "$ADB" -s emulator-5554 pull "/sdcard/$NAME" "$OUT_DIR/$NAME" > /dev/null
  MSYS_NO_PATHCONV=1 "$ADB" -s emulator-5554 shell rm "/sdcard/$NAME"
}
sleepy() { sleep "$1"; }

# Install -----------------------------------------------------------
echo "[install] APK"
"$ADB" -s emulator-5554 install -r "$APK" > "$OUT_DIR/install.log" 2>&1
sleepy 2

# Launch alate (give the JS bundle 15 s to compile + render —
# bumped from 6 because the cold-boot first run sometimes triggers
# "System UI isn't responding" if we tap too soon, which then
# steals every subsequent input event).
echo "[launch] com.tessellate.alate"
"$ADB" -s emulator-5554 shell monkey -p com.tessellate.alate -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleepy 15

# Dismiss any "System UI isn't responding" / "App isn't responding"
# dialog that might have piled up during the heavy first render.
# Two back-key presses is enough; if no dialog is present they're
# no-ops on a fresh foreground.
echo "[step]  dismiss any pending system dialogs"
"$ADB" -s emulator-5554 shell input keyevent KEYCODE_BACK
sleepy 1
"$ADB" -s emulator-5554 shell input keyevent KEYCODE_BACK
sleepy 2

# Re-launch in case the back keys took us out of the app.
"$ADB" -s emulator-5554 shell monkey -p com.tessellate.alate -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleepy 4

# Step 1: confirm age gate. uiautomator dump confirmed the
# "I'm 16 or older" button bounds are [438,1144][641,1183] on a
# 1080x1920 layout → center 50%, 60.6%. Earlier guesses (35%, 46%)
# landed in body text. Tap at 50%, 60% lands on the button.
echo "[step]  age-gate confirm"
tap_pct 50 60
sleepy 4

# Now we should see Home (Check tab) on first launch
shoot "01-home.png"

# Step 2: tap History tab. Bottom nav has 3 tabs. History is the
# middle one — ~50% across, ~95% down.
echo "[step]  → History"
tap_pct 50 95
sleepy 3
shoot "02-history-empty.png"

# Step 3: dev seed button on empty History — center horizontally,
# ~70% down (below the icon ring + title + subtitle).
echo "[step]  Load demo data"
tap_pct 50 70
sleepy 4
shoot "03-history-deck.png"

# Step 4: tap the centred deck card to open FitResult.
echo "[step]  → FitResult (tap centre card)"
tap_pct 50 50
sleepy 5
shoot "04-fitresult.png"

# Step 5: back to History via system back, then tap Profile tab (right).
echo "[step]  → Profile"
"$ADB" -s emulator-5554 shell input keyevent KEYCODE_BACK
sleepy 2
tap_pct 83 95  # rightmost tab
sleepy 3
shoot "05-account.png"

# Step 6: tap "Edit" pill on the Body Profile section header to enter
# AvatarSetup. The pill sits to the right of "BODY PROFILE" — roughly
# ~88% across, ~28% down. Coordinates may need adjustment if the
# GoogleSignInCard above shifts the pill's vertical position.
echo "[step]  → BodyProfile (Edit pill)"
tap_pct 88 28
sleepy 4
shoot "06-bodyprofile.png"

echo ""
echo "[done]  screenshots in $OUT_DIR"
ls -la "$OUT_DIR"
