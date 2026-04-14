# Solar Compass

A solar-azimuth reference card: shows a dial with the sun's current bearing from true north for Stockholm. Point the top of the phone along the arrow to the real sun, and you know where north is — no magnetometer needed.

Tauri 2 + SolidJS + TypeScript + Vite. Target: Android (aarch64). Linux desktop also buildable if webkit2gtk-4.1 is installed.

## Dev

```fish
pnpm tauri android dev
```

Phone must be USB-connected with USB debugging enabled, and on the same LAN as the computer.

## Release build + install

```fish
pnpm tauri android build --apk --target aarch64 && \
  adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Output APK is ~6 MB. Sun math runs locally with `suncalc`; GPS uses Android's location provider. Only the manual place-picker search talks to the network (Open-Meteo geocoding).

If signing keys ever change, Android refuses `-r`; uninstall first:

```fish
adb uninstall app.solarcompass
```

## Icon

Edit `app-icon.svg`, then:

```fish
rsvg-convert -w 1024 -h 1024 app-icon.svg -o app-icon.png && pnpm tauri icon app-icon.png
```

This regenerates all Android mipmap densities under `src-tauri/gen/android/app/src/main/res/`.

## Signing

- Keystore: `~/.android/solar-compass.jks` (PKCS12, alias `release`, password `tauri-personal`, 100y validity)
- Gradle wiring: `src-tauri/gen/android/key.properties` → read in `src-tauri/gen/android/app/build.gradle.kts`
- Personal-use only; never publish APKs signed with this key

## Where the code lives

- `src/App.tsx` — all the UI and sun-math logic
- `src/App.css` — all styling
- `index.html` — viewport meta (zoom disabled)
- `src-tauri/gen/android/app/src/main/AndroidManifest.xml` — portrait lock (`android:screenOrientation="portrait"`)
- `src-tauri/Cargo.toml` — release profile (`lto`, `codegen-units = 1`, `strip`)

Location: GPS is requested on first launch. If denied or unavailable and there's no cached fix, the picker auto-opens so you can search for a place (Open-Meteo) — no hardcoded fallback. Tap the pill in the top-right corner any time to switch location or re-trigger a GPS fix. The chosen location is cached in `localStorage` under `solar-compass:location`.

## Regenerating the Android project

If `src-tauri/gen/android/` ever needs rebuilding from scratch (e.g. after breaking changes to the manifest/gradle files):

```fish
rm -rf src-tauri/gen/android && pnpm tauri android init
```

Note: this wipes the manifest edits (portrait lock) and gradle signing config — re-apply them.

## Fish env (already set as universal vars)

```
JAVA_HOME        /usr/lib/jvm/java-17-openjdk
ANDROID_HOME     /opt/android-sdk
ANDROID_SDK_ROOT /opt/android-sdk
NDK_HOME         /opt/android-sdk/ndk/27.3.13750724
```

PATH additions: `$JAVA_HOME/bin`, `$ANDROID_HOME/cmdline-tools/latest/bin`, `$ANDROID_HOME/platform-tools`.
