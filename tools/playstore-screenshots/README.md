# Play Store tablet screenshots

Spin up tablet AVDs (7" + 10"), install the alate APK, capture
screenshots at Play Store-compliant dimensions (9:16 portrait at
1080×1920 / 1440×2560).

## What this is / isn't

**Is:** an AVD scaffolder + a single-screen capture utility you
drive while you walk the app manually.

**Isn't:** a fully unattended auto-walkthrough. We tried that and
the heavy first render of alate (BlurView + reanimated v4 +
react-native-image-colors native bridges) ANR'd on cold-boot AVDs.
A real device does this in 2 s; AVD GPU emulation can take 20+ s
and Android's "Application Not Responding" watchdog fires before
then. Manual walkthrough sidesteps that — boot once, let the app
settle, then operate.

## Prereqs

- Android SDK at `~/AppData/Local/Android/Sdk` (you have).
- System image `system-images/android-36/google_apis_playstore/x86_64`
  (you have).
- An APK to screenshot. Default is `/tmp/alate-apk/app-release.apk`.

## Workflow

### Step 1 — create the tablet AVDs (one-time, idempotent)

```bash
cd tools/playstore-screenshots
chmod +x *.sh
./create-tablet-avds.sh
```

Writes `~/.android/avd/Alate_Tablet_{7,10}inch.avd/config.ini` with
9:16 portrait dimensions + 6 GB RAM.

### Step 2 — boot one AVD + install APK

```bash
./boot.sh Alate_Tablet_7inch /tmp/alate-apk/app-release.apk
```

Boots in the foreground (you'll see the AVD window pop), waits for
boot completion, installs the APK, launches the app, then prints
"AVD is up. Walk through the app manually...". Leaves the AVD
running so you can interact with it via the AVD window.

### Step 3 — walk the app + capture each screen

In the AVD window, navigate to a screen you want. Then in the
terminal:

```bash
./shoot.sh Alate_Tablet_7inch home
./shoot.sh Alate_Tablet_7inch history-empty
./shoot.sh Alate_Tablet_7inch history-deck
./shoot.sh Alate_Tablet_7inch fitresult-expanded
./shoot.sh Alate_Tablet_7inch fitresult-docked
./shoot.sh Alate_Tablet_7inch profile
./shoot.sh Alate_Tablet_7inch body-profile
```

Files land at `output/Alate_Tablet_7inch/01-home.png`,
`02-history-empty.png`, etc. The sequence prefix auto-increments.

### Step 4 — kill the AVD

```bash
"C:/Users/mailt/AppData/Local/Android/Sdk/platform-tools/adb.exe" -s emulator-5554 emu kill
```

### Step 5 — repeat for the 10" AVD

```bash
./boot.sh Alate_Tablet_10inch /tmp/alate-apk/app-release.apk
# walk + ./shoot.sh ... + adb emu kill
```

## Aspect-ratio compliance

- 7" AVD: 1080×1920 → 9:16 exact ✓
- 10" AVD: 1440×2560 → 9:16 exact ✓
- Sides within Play Store's 320–3840 px range ✓
- PNG output via `screencap -p` is well under 8 MB ✓

## Files

- `create-tablet-avds.sh` — writes AVD config files. Idempotent.
- `boot.sh` — boots an AVD + installs APK + leaves it running.
- `shoot.sh` — captures the current screen, auto-numbered.
- `output/` — generated screenshots, gitignored.
- `capture.sh` — DEPRECATED. Tried to auto-walk the app via taps;
  ANR-prone on cold-boot AVDs. Kept on disk but `boot.sh` + `shoot.sh`
  is the working path.

## Tips

- **First boot is slow** (60–120 s). Subsequent boots from the
  saved snapshot are ~15 s.
- **First launch of alate is heavy** (~10–20 s before the age gate
  paints). Don't tap until the age gate is fully visible — tapping
  earlier triggers ANR.
- **If the app ANRs anyway**: tap "Wait" in the dialog, give it 30
  more seconds, it usually recovers. If not, kill the emulator and
  cold-boot again.
- **Screenshots are scaled to AVD native resolution** — no post-
  processing needed.
