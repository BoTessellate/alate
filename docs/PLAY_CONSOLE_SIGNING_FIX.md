# Play Console signing fix — upload key reset

**Created:** 2026-05-16
**Why:** A `.aab` upload to closed testing was rejected — *"signed with the
wrong key."* Play Console expects upload key SHA-1
`7C:66:FD:B6:C5:F9:2E:3D:03:C7:95:AE:93:5A:D5:04:C9:3A:84:61`, but that
keystore is an old EAS keystore that EAS regenerated away — it's
unrecoverable. The fix is a **one-time** Play Console upload key reset
onto a fresh keystore. After it clears, every future update is normal.

This doc is **your** checklist. Steps marked 🟢 are done (automated).
Steps marked 🔴 are yours to do.

---

## Status snapshot

| | Item | State |
|---|---|---|
| 🟢 | Fresh upload keystore generated (`67:6B:08:…:93:FE`) | done |
| 🟢 | CI secrets updated (`ANDROID_KEYSTORE`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`) | done |
| 🟢 | Certificate for Google exported (`upload_certificate.pem`) | done |
| 🟢 | Google SSO CRLF bug fixed (`sanitizeClientId`, PR #117) | done |
| 🔴 | **Step 1** — submit the cert for upload key reset | YOU |
| 🔴 | **Step 2** — distribute the stopgap APK to testers | YOU |
| 🔴 | **Step 3** — register SHA-1s in Google Cloud Console | YOU |
| 🔴 | **Step 4** — confirm closed-testing tester list | YOU |
| 🔴 | **Step 5** — after reset clears: rebuild + upload `.aab` | YOU + Claude |

---

## Reference — files & values

| Thing | Value / path |
|---|---|
| Certificate to give Google | `C:\Users\mailt\Documents\alate-keystore\upload_certificate.pem` |
| New upload keystore (BACK THIS UP) | `C:\Users\mailt\Documents\alate-keystore\alate-upload.keystore` |
| Keystore password | `C:\Users\mailt\Documents\alate-keystore\keystore-password.txt` — **move into your password manager, then delete this file** |
| New upload key SHA-1 | `67:6B:08:6B:53:6D:5B:04:33:71:E8:87:D0:70:07:E8:F0:41:93:FE` |
| Stopgap APK for testers | `C:\Users\mailt\Documents\alate-tester-apk\alate-1.0.0-test.apk` |
| Package name | `com.tessellate.alate` |

---

## Step 1 — 🔴 Request the upload key reset

1. Open **Play Console** → select the **alate** app.
2. Left nav: **Test and release → App integrity** (older UI: **Setup → App
   signing**).
3. Find the **App signing** card → **Upload key certificate** section.
4. Click **Request upload key reset** (or the **⋯** / "Request a key
   change" link).
5. Reason: choose **"I lost my upload key"** / *"I no longer have access
   to my upload key."*
6. Upload the certificate:
   `C:\Users\mailt\Documents\alate-keystore\upload_certificate.pem`
7. Submit.

**Timeline:** Google processes it — often hours, up to ~48 h worst case.
You'll get an email when it's done. Nothing else can be done to speed it.

> If Play Console shows no self-service reset option, use the **Help →
> Contact support** flow in Play Console and ask to reset the upload key,
> attaching the same `.pem`. Same outcome, just routed through support.

---

## Step 2 — 🔴 Give testers the stopgap APK (do this now, don't wait)

The closed-testing track is blocked until Step 1 clears. To get testers
moving immediately, send them the APK to sideload directly:

1. File: `C:\Users\mailt\Documents\alate-tester-apk\alate-1.0.0-test.apk`
2. Send it to testers (Drive link, WhatsApp, email — any channel).
3. Tester instructions:
   - Open the file on the phone.
   - Allow **"Install unknown apps"** for the app they opened it with
     (Files / Chrome / WhatsApp).
   - Install. Done.

This APK has the Google SSO CRLF fix and all current changes. It is the
same code that will go to the Play closed-testing track.

**Note:** when testers later move to the Play closed-testing build, they
must **uninstall** this sideloaded APK first (signature differs — Play
re-signs with Google's app-signing key). One-time, per tester.

---

## Step 3 — 🔴 Register SSO signing fingerprints (Google Cloud Console)

So Google Sign-In works on every install variant. Open **Google Cloud
Console → APIs & Services → Credentials → the Android OAuth client**
(`alate for android`, ID ends `-od0lkccf0vbd429lcc992hh8g1lmbf8n`).

Add these SHA-1 fingerprints (the field accepts multiple):

| Fingerprint | Source | Covers |
|---|---|---|
| `67:6B:08:6B:53:6D:5B:04:33:71:E8:87:D0:70:07:E8:F0:41:93:FE` | new upload key (this doc) | sideloaded CI APKs |
| *App signing key SHA-1* | Play Console → App integrity → App signing → **"App signing key certificate"** | Play-Store-delivered installs |

Copy the **App signing key** SHA-1 straight off that Play Console page.
Save in Cloud Console — propagates in minutes.

> This is belt-and-suspenders. The CRLF fix already repairs the observed
> 401. Whether the browser-based sign-in flow strictly enforces SHA-1 is
> unconfirmed — registering both costs 10 minutes and removes all doubt.

---

## Step 4 — 🔴 Confirm the closed-testing tester list

Play Console → **Test and release → Testing → Closed testing → your
track → Testers**. Add testers by email list or Google Group. Needs to
exist before Step 5's build goes live to anyone.

> **Production gate (later, not now):** if your Play developer account is
> post-Nov-2023, promoting to *production* requires 12+ testers running
> closed testing for 14 continuous days. It does NOT block closed testing
> — that starts immediately — but plan the calendar for the production
> push.

---

## Step 5 — 🔴 After the reset email arrives: rebuild + upload

1. Tell Claude (or trigger it yourself): **"reset cleared, rebuild"** →
   GitHub Actions → run the **Build Android APK** workflow on `master`.
   It produces a fresh `.aab` signed with the new upload key.
2. Download the `alate-release.aab` artifact from the workflow run.
3. Play Console → **Closed testing → Create new release → Upload** the
   `.aab`. It will be accepted now (key matches).
4. Roll out the release. Testers on the track get it; they uninstall the
   sideloaded stopgap APK and install from Play.

Done. Closed testing is live.

---

## After all this — future updates are NORMAL

CI build → download `.aab` → upload to Play Console → roll out. ~20 min,
no signing drama, no resets, no gymnastics. The upload key reset is a
**one-time** event — it does not recur.

---

## Don't-lose-this

- **Back up `alate-upload.keystore` + its password** to a password
  manager / secure storage. It's also stored in the GitHub
  `ANDROID_KEYSTORE` secret as a backup. Losing it means another reset
  (recoverable, but annoying — it is only the *upload* key; Google holds
  the real app-signing key, so the app itself is never at risk).
- **Never commit** the keystore or password to git. They live outside the
  repo at `C:\Users\mailt\Documents\alate-keystore\` on purpose.
