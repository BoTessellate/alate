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
| 🟢 | `.aab` built + signed with the new key (CI run 25961723942) | done |
| 🟢 | Google SSO CRLF bug fixed (`sanitizeClientId`, PR #117) | done |
| 🔴 | **Step 1** — submit the cert for upload key reset | YOU |
| 🔴 | **Step 2** — register SHA-1s in Google Cloud Console | YOU |
| 🔴 | **Step 3** — confirm closed-testing tester list | YOU |
| 🔴 | **Step 4** — after reset clears: upload the `.aab` to closed testing | YOU |

**No rebuild needed** — the `.aab` from CI run 25961723942 is already
signed with the new upload key. Once the reset clears, that exact file
uploads straight to closed testing.

---

## Reference — files & values

| Thing | Value / path |
|---|---|
| Certificate to give Google | `C:\Users\mailt\Documents\alate-keystore\upload_certificate.pem` |
| New upload keystore (BACK THIS UP) | `C:\Users\mailt\Documents\alate-keystore\alate-upload.keystore` |
| Keystore password | `C:\Users\mailt\Documents\alate-keystore\keystore-password.txt` — **move into your password manager, then delete this file** |
| New upload key SHA-1 | `67:6B:08:6B:53:6D:5B:04:33:71:E8:87:D0:70:07:E8:F0:41:93:FE` |
| `.aab` to upload to closed testing | `C:\Users\mailt\Documents\alate-release\app-release.aab` |
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

## Step 2 — 🔴 Register SSO signing fingerprints (Google Cloud Console)

So Google Sign-In works on every install variant. Open **Google Cloud
Console → APIs & Services → Credentials → the Android OAuth client**
(`alate for android`, ID ends `-od0lkccf0vbd429lcc992hh8g1lmbf8n`).

Add these SHA-1 fingerprints (the field accepts multiple):

| Fingerprint | Source | Covers |
|---|---|---|
| `67:6B:08:6B:53:6D:5B:04:33:71:E8:87:D0:70:07:E8:F0:41:93:FE` | new upload key (this doc) | sideloaded CI APKs |
| *App signing key SHA-1* | Play Console → App integrity → App signing → **"App signing key certificate"** | Play-Store-delivered installs |

Copy the **App signing key** SHA-1 straight off that Play Console page.
Save in Cloud Console — propagates in minutes. Can be done any time, in
parallel with Step 1.

> This is belt-and-suspenders. The CRLF fix already repairs the observed
> 401. Whether the browser-based sign-in flow strictly enforces SHA-1 is
> unconfirmed — registering both costs 10 minutes and removes all doubt.

---

## Step 3 — 🔴 Confirm the closed-testing tester list

Play Console → **Test and release → Testing → Closed testing → your
track → Testers**. Add testers by email list or Google Group. Needs to
exist before the Step 4 release can reach anyone. Can be done any time,
in parallel with Step 1.

> **Production gate (later, not now):** if your Play developer account is
> post-Nov-2023, promoting to *production* requires 12+ testers running
> closed testing for 14 continuous days. It does NOT block closed testing
> — that starts immediately — but plan the calendar for the production
> push.

---

## Step 4 — 🔴 After the reset email arrives: upload the `.aab`

1. Play Console → **Test and release → Testing → Closed testing → your
   track → Create new release**.
2. **Upload** the `.aab`: `C:\Users\mailt\Documents\alate-release\app-release.aab`
   — it is already signed with the new upload key, so it is accepted now
   that the reset has cleared.
3. Fill in release notes, **Save**, **Review release**, **Roll out**.
4. Closed testing is live. Testers on the track get the build from Play.

> Only rebuild if code changes after this point. The current `.aab`
> already carries the Google SSO CRLF fix + all current changes.

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
