#!/bin/bash
# create-tablet-avds.sh
# Creates two tablet AVDs for Play Store screenshots:
#   - Alate_Tablet_7inch  : 1080x1920 @ 320 dpi (9:16, ~7" diagonal class)
#   - Alate_Tablet_10inch : 1440x2560 @ 320 dpi (9:16, ~10" diagonal class)
#
# Both satisfy the Play Store tablet screenshot spec:
#   PNG/JPEG, sides 320–3840 px, 16:9 or 9:16 aspect.
#
# Idempotent: skips AVDs that already exist.

set -e

AVD_DIR="$HOME/.android/avd"
SDK="C:/Users/mailt/AppData/Local/Android/Sdk"
SYSIMAGE_DIR="system-images\\android-36\\google_apis_playstore\\x86_64\\"

mkdir -p "$AVD_DIR"

create_avd() {
  local NAME="$1"
  local DISPLAY="$2"
  local WIDTH="$3"
  local HEIGHT="$4"
  local DENSITY="$5"

  local AVD_PATH="$AVD_DIR/$NAME.avd"

  if [ -d "$AVD_PATH" ]; then
    echo "[skip] $NAME — already exists at $AVD_PATH"
    return 0
  fi

  echo "[create] $NAME ($WIDTH x $HEIGHT @ $DENSITY dpi)"
  mkdir -p "$AVD_PATH/data"

  # Outer .ini — points the emulator at the AVD directory
  cat > "$AVD_DIR/$NAME.ini" <<EOF
avd.ini.encoding=UTF-8
path=C:\\Users\\mailt\\.android\\avd\\$NAME.avd
path.rel=avd\\$NAME.avd
target=android-36
EOF

  # Inner config.ini — full hardware spec, modelled on the user's
  # existing Medium_Phone with display + display-name overrides.
  cat > "$AVD_PATH/config.ini" <<EOF
AvdId=$NAME
PlayStore.enabled=true
abi.type=x86_64
avd.ini.displayname=$DISPLAY
avd.ini.encoding=UTF-8
disk.dataPartition.size=6G
fastboot.chosenSnapshotFile=
fastboot.forceChosenSnapshotBoot=no
fastboot.forceColdBoot=no
fastboot.forceFastBoot=yes
hw.accelerometer=yes
hw.arc=false
hw.audioInput=yes
hw.battery=yes
hw.camera.back=virtualscene
hw.camera.front=emulated
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.dPad=no
hw.device.manufacturer=Generic
hw.device.name=tablet_$WIDTH
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
hw.gyroscope=yes
hw.initialOrientation=portrait
hw.keyboard=yes
hw.lcd.density=$DENSITY
hw.lcd.height=$HEIGHT
hw.lcd.width=$WIDTH
hw.mainKeys=no
hw.ramSize=6144
hw.sdCard=yes
hw.sensors.light=yes
hw.sensors.magnetic_field=yes
hw.sensors.orientation=yes
hw.sensors.pressure=yes
hw.sensors.proximity=yes
hw.trackBall=no
image.sysdir.1=$SYSIMAGE_DIR
runtime.network.latency=none
runtime.network.speed=full
sdcard.size=512M
showDeviceFrame=no
skin.dynamic=yes
tag.display=Google Play
tag.displaynames=Google Play
tag.id=google_apis_playstore
tag.ids=google_apis_playstore
target=android-36
vm.heapSize=512
EOF

  echo "[done]  $NAME — $AVD_DIR/$NAME.ini + $AVD_PATH/config.ini"
}

create_avd "Alate_Tablet_7inch"  "Alate Tablet 7-inch"  1080 1920 320
create_avd "Alate_Tablet_10inch" "Alate Tablet 10-inch" 1440 2560 320

echo ""
echo "AVDs ready. To launch:"
echo "  \"$SDK/emulator/emulator.exe\" -avd Alate_Tablet_7inch &"
echo "  \"$SDK/emulator/emulator.exe\" -avd Alate_Tablet_10inch &"
echo ""
echo "To list:"
echo "  \"$SDK/emulator/emulator.exe\" -list-avds"
