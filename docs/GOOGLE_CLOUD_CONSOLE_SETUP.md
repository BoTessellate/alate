# Google Cloud Console — Sign-In Setup Walkthrough

The Account screen uses `expo-auth-session/providers/google`, which
needs three OAuth 2.0 client IDs registered in Google Cloud Console:

- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — Web client (used by Expo Auth proxy
  in dev and as the OAuth audience identifier in prod)
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` — Android client (matches the
  app's package + signing certificate)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — iOS client (matches the bundle
  identifier; only needed when iOS ships)

When all three env vars are missing the Account screen renders the
"Not configured" toast on tap. When any one is present the Google
sign-in flow attempts to run, so set them as a complete set or not at
all.

App identifiers (from `mobile/app.json`):
- Android package: `com.tessellate.alate`
- iOS bundle: `com.tessellate.alate`

---

## 1. Create or pick a Google Cloud project

1. Open https://console.cloud.google.com
2. Top bar → project picker → **NEW PROJECT** (or select the existing
   "Alate" project if it already exists).
3. Name it something obvious like `alate-prod`. No organisation
   required for a personal account.
4. Wait a minute for provisioning. The project picker will switch to
   the new project automatically.

You don't need to enable any specific API for OAuth — Sign-In works
out of the box. (You'd only enable APIs if you call e.g. People API,
Calendar API. We just call `userinfo/v2/me` which uses standard
OAuth scopes.)

---

## 2. Configure the OAuth consent screen

This is the screen Google shows to a user the first time they
authorise your app. It needs to exist before you can create OAuth
client IDs.

1. Left nav → **APIs & Services** → **OAuth consent screen**.
2. User Type: **External** (unless you have a Google Workspace —
   you don't need one). Click **CREATE**.
3. App information:
   - **App name**: `Alate`
   - **User support email**: your email (`ramsaptami@gmail.com`).
   - **App logo**: optional. Skip for now if you want — you can
     upload later.
4. App domain: leave blank for now. (When you ship publicly Google
   wants a privacy policy URL — you have one at
   `https://botessellate.github.io/app_privacy_policy/alate/privacy-policy.html`,
   put that in the Privacy Policy field when you publish.)
5. Authorised domains: leave blank.
6. Developer contact: same email as above.
7. **SAVE AND CONTINUE**.

8. **Scopes** step — click **ADD OR REMOVE SCOPES**, then tick:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`

   Click **UPDATE** then **SAVE AND CONTINUE**.

9. **Test users** step — while the consent screen is in "Testing"
   mode, only listed Google accounts can sign in. Add `ramsaptami@gmail.com`
   and any test devices' Google accounts. Click **SAVE AND CONTINUE**.

10. **Summary** → **BACK TO DASHBOARD**.

You can leave the publishing status as "Testing" for as long as you
want. When you submit to the Play Store and want non-test users to
sign in, click **PUBLISH APP** on the consent screen. That triggers
Google's verification flow only if you requested sensitive scopes —
the three above are basic and don't trigger review.

---

## 3. Get the Android signing certificate SHA-1

The Android OAuth client ID is bound to a specific package + SHA-1
fingerprint. You need the SHA-1 of whichever signing key the
device-installed APK was built with.

There are two cases:

### Debug builds (`expo run:android` / `eas build --profile development`)

Open a terminal:

```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

On Windows the keystore is at `%USERPROFILE%\.android\debug.keystore`.
Look for the line starting with `SHA1:` — copy that hex string.

### Release builds (Play Store)

If you let EAS / Google Play manage your signing key (the default for
new EAS projects), the SHA-1 lives in:

- **EAS**: `eas credentials --platform android` → select your project
  and profile → **Keystore: Manage everything needed to build your
  project** → it prints the keystore SHA-1.
- **Play Console**: https://play.google.com/console → your app →
  **Setup** → **App signing** → **App signing key certificate** →
  copy the SHA-1.

Both numbers should match if Play handles app signing.

Save both fingerprints — you'll add the debug SHA-1 to the OAuth
client now (so you can test from your device immediately) and the
release SHA-1 once you have a Play upload.

---

## 4. Create the Android OAuth client ID

1. Left nav → **APIs & Services** → **Credentials**.
2. **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. Application type: **Android**.
4. Name: `Alate Android` (anything memorable).
5. **Package name**: `com.tessellate.alate`.
6. **SHA-1 certificate fingerprint**: paste the debug SHA-1 from step 3.
7. **CREATE**.

Google now shows you the new client ID — copy it. It looks like
`123456789-abcdefg.apps.googleusercontent.com`.

This is the value of `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

When the release SHA-1 is available later, edit this same client and
add the second SHA-1 fingerprint underneath the debug one (Google
allows multiple per client).

---

## 5. Create the iOS OAuth client ID (only needed when shipping iOS)

1. **+ CREATE CREDENTIALS** → **OAuth client ID**.
2. Application type: **iOS**.
3. Name: `Alate iOS`.
4. **Bundle ID**: `com.tessellate.alate`.
5. **CREATE**.

Copy the client ID — this is `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

You can skip this step entirely if you're Android-only for now. The
mobile code already handles a missing iOS ID — `Google.useAuthRequest`
treats undefined platform IDs as "not configured for that platform"
and falls back to the web client.

---

## 6. Create the Web OAuth client ID

The web client is what `expo-auth-session` uses as the audience
identifier on every platform; it also handles the dev-time browser
redirect path.

1. **+ CREATE CREDENTIALS** → **OAuth client ID**.
2. Application type: **Web application**.
3. Name: `Alate Web`.
4. **Authorised JavaScript origins**: leave empty.
5. **Authorised redirect URIs** — add these:
   - `https://auth.expo.io/@ramsaptami/alate`
     (matches `expo` username + slug; replace `@ramsaptami` with your
     own Expo username if different. Find it via `eas whoami`.)
   - `com.tessellate.alate:/oauthredirect` (for native deep-link).
6. **CREATE**.

Copy the client ID — this is `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

You don't need the client secret for public mobile apps — it's not
used by the Expo flow. Don't paste it into the repo.

---

## 7. Wire the env vars into the app

Local dev (`expo start`):

```bash
# mobile/.env.local
EXPO_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
```

Make sure `mobile/.env.local` is gitignored (it should be by default
for any `.env*` file).

EAS builds (`eas build`):

```bash
cd mobile
eas env:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value '...' --environment production
eas env:create --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value '...' --environment production
eas env:create --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value '...' --environment production
```

(Repeat for `--environment preview` if you build preview channels.)

---

## 8. Verify

1. Reload the app (`r` in Metro, or rebuild).
2. Open Account → **Continue with Google**.
3. The Google account picker should appear. Pick the test user
   account you added in step 2 (consent screen).
4. After approval the Account screen should show your name + email +
   profile picture. The signed-in row replaces the "Continue with
   Google" button.

If you see the **"Not configured" toast**, the env vars aren't being
read. Check:
- `.env.local` lives in `mobile/` (not the repo root).
- You restarted Metro after creating it (Expo only re-reads `EXPO_PUBLIC_*`
  vars on cold start).
- The variable names match exactly — typos are silent.

If you see the **"Sign-in error" toast** ("Could not fetch your Google
profile"), the OAuth flow succeeded but the userinfo call failed.
Most common cause: the consent screen scopes don't include
`userinfo.profile`. Re-check step 2 (#8).

If you get an `Error 400: redirect_uri_mismatch`, the redirect URI in
the web client (step 6 #5) doesn't match what Expo passed. Run
`eas whoami` to confirm your username and update the URI to
`https://auth.expo.io/@<username>/alate`.

---

## Common gotchas

- **SHA-1 mismatch on release builds**: when Play handles app
  signing, the SHA-1 of your *upload* keystore is different from the
  *signing* key Play uses. Always read the SHA-1 from the Play
  Console (App signing key certificate), not your local upload
  keystore. Add both.
- **Test user list**: while the consent screen is in "Testing", any
  Google account NOT on the test list will see "Access blocked". Add
  every test device's account.
- **One client per environment isn't required**: you can use the same
  Android / Web client IDs across dev + prod. The Android client is
  scoped by SHA-1, so as long as both your debug and release SHA-1s
  are listed, everything works.
- **Don't store the client secret in the repo or env**: public mobile
  apps don't use it. If you accidentally committed it, rotate it from
  the Credentials page and remove the env var.

---

## After publishing the consent screen

When you're ready for non-test users (Play Store launch):

1. **OAuth consent screen** → **PUBLISH APP**.
2. If asked, supply:
   - Privacy policy: `https://botessellate.github.io/app_privacy_policy/alate/privacy-policy.html`
   - Terms of service: optional.
   - App home page: optional (your marketing site if you have one).
3. With basic scopes (email/profile/openid) you skip Google's
   verification review and the app goes live immediately.
