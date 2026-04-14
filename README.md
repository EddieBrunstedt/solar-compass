# Solar Compass

A pocket reference for finding true north without a magnetometer — or a GPS, or a network. Pick a technique that fits your conditions: during the day, line up with the sun's current azimuth; at night, find Polaris via the Big Dipper. More methods are planned (moon, Southern Cross, bright-star azimuths) so the app stays useful under whatever sky you've got.

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

Output APK is ~6 MB. Math runs locally (`suncalc` for sun, hand-rolled geometry for Polaris). GPS uses Android's location provider. Only the manual place-picker search talks to the network (Open-Meteo geocoding).

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

- `src/App.tsx` — thin router: owns shared state (location, time, viewport), renders the current method, hosts both pickers
- `src/types.ts` — `Location`, `MethodCtx`, `Dep`, `MethodDescriptor`
- `src/methods/` — one file per bearing technique; see below
- `src/App.css` — global styles + picker + per-method styles
- `index.html` — viewport meta (zoom disabled)
- `src-tauri/gen/android/app/src/main/AndroidManifest.xml` — portrait lock (`android:screenOrientation="portrait"`)
- `src-tauri/Cargo.toml` — release profile (`lto`, `codegen-units = 1`, `strip`)

### Adding a method

Each method is a single self-contained file that default-exports a `MethodDescriptor`. To add one:

1. Create `src/methods/<your-method>.tsx`. Default-export an object with `satisfies MethodDescriptor` (preserves the literal `id` for the derived `MethodId` union). Fields: `id`, `name`, `tagline`, `when`, `icon`, `computeDeps`, `render`.
2. Use the `dep.met / dep.unmet / dep.unknown` helpers from `./deps` to build the dependency list — don't write dep object literals.
3. Import and append it in `src/methods/index.tsx`'s `METHODS` array. That's the only touch outside your new file.

The picker, storage key, and type union all flow from `METHODS` automatically.

### Location

GPS is requested on first launch. If denied or unavailable and there's no cached fix, the location picker auto-opens so you can search for a place (Open-Meteo) — no hardcoded fallback. Tap the pill in the top-right any time to switch location or re-trigger a GPS fix. The chosen location is cached in `localStorage` under `solar-compass:location`.

### Method selection

Tap the pill in the top-left to change method. The last selection is persisted under `solar-compass:method` and is the landing screen on subsequent launches. First-ever launch opens the method picker non-dismissable.

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
