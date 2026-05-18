# Getting alate onto Play Console — closed testing

**For:** you (the steps only you can do) · **Updated:** 2026-05-16

---

## What this is — in plain words

Your `.aab` upload was rejected. The real reason: **the app listing in
Play Console was created under an old name — `com.tessellate.fitcheck`.**
The project was later renamed to "alate", and the app's permanent ID is
now `com.tessellate.alate`. Play Console **never lets you change an app's
package name** — it's the permanent identity of the listing.

So the `fitcheck` listing is a dead end. It can never accept the alate
app. **The fix is to create a fresh Play Console app** under the correct
name. This doc walks you through it.

Good news: a brand-new app listing makes three problems disappear at once
— no version-code clash, no package mismatch, and **no upload-key reset
or waiting period** (the "upload again from 18 May" lock was on the old
`fitcheck` listing only; a new app's first upload just works).

---

## What you need to do

### Step 1 — Create the new app

1. Go to **[Play Console](https://play.google.com/console)** → **All apps**
   → **Create app**.
2. App name: **Alate**
3. Default language, app/game: **App**, free/paid: as you want.
4. Accept the declarations → **Create app**.

> The package name `com.tessellate.alate` is not typed here — it gets
> locked in automatically from the first `.aab` you upload (Step 3).

### Step 2 — Complete the "App content" checklist

A new app must clear the **Dashboard → "Set up your app"** tasks before
any release (even a test one) can go out: privacy policy, ads, content
rating, target audience, data safety, etc.

- **Privacy policy URL:** `https://botessellate.github.io/app_privacy_policy/alate/privacy-policy.html`
- **Data safety** — this is the long, fiddly one. Every answer for
  alate is spelled out in **[Appendix A](#appendix-a--data-safety-form-answers)** below.
- The store-listing copy (description, etc.) is in
  [`mobile/store-listing.md`](../mobile/store-listing.md).
- Tablet screenshots are in `tools/playstore-screenshots/output/`.

### Step 3 — Upload the build to a closed-testing release

1. Play Console → **Test and release → Testing → Closed testing →
   Create track** (or use the default "Closed testing" track).
2. **Create new release.**
3. **Upload** this file:
   `C:\Users\mailt\Documents\alate-release\app-release.aab`
4. This is the first upload, so Play Console will offer **Play App
   Signing** — accept it (default). Your uploaded bundle's key
   (`67:6B:08:…:93:FE`) becomes the **upload key**; Google generates and
   holds the **app signing key**.
5. Add release notes → **Save** → **Review release** → **Start rollout to
   Closed testing**.

### Step 4 — Add testers

Closed testing → your track → **Testers** tab → add an email list or a
Google Group. Share the opt-in link with them.

---

## How to verify it worked

- Step 1: the new app shows in **All apps** with the name **Alate**.
- Step 3: the upload is accepted with **no red errors** — no
  package-name error, no version-code error, no signing error. The
  release shows package `com.tessellate.alate`, version `1.0.0 (1)`.
- Step 4: the closed-testing opt-in link loads, and a tester (or you, on
  a test account) can install alate from the Play Store via that link.

---

## Notes & follow-ups

- **The old `fitcheck` listing** — leave it or delete it, doesn't matter.
  It's not connected to anything we're doing. Don't upload to it again.
- **The upload key reset / PEM you submitted earlier** — that was on the
  `fitcheck` listing and no longer matters. The new app starts clean.
- **Google Sign-In** — the in-app 401 is already fixed in code (the build
  carries the fix). If sign-in still fails *after* installing from the
  closed-testing track, the follow-up is to register the new app's **app
  signing key SHA-1** (Play Console → App integrity → App signing) on the
  Android OAuth client in Google Cloud Console. Don't do this pre-emptively
  — only if sign-in actually fails.
- **Future version updates** — each new build must use a higher
  `versionCode` than the last. It's set in `mobile/app.json`
  (`expo.android.versionCode`); bump it before each release build.

---

## Back up the signing keystore — don't skip this

The build is signed with a keystore at
`C:\Users\mailt\Documents\alate-keystore\alate-upload.keystore` (password
in `keystore-password.txt` beside it). Upload **both** to a private
Google Drive folder so a disk failure can't lose them. It's also in the
GitHub `ANDROID_KEYSTORE` secret as a backup. Losing it is recoverable
(another upload key reset) but annoying — back it up once, done.

---

## Appendix A — Data Safety form answers

Play Console → **App content → Data safety**. It has five sub-steps:
Overview → Data collection and security → Data types → Data usage and
handling → Preview. Here is exactly what to select for alate, and why.

### Sub-step "Data collection and security"

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — every network call uses HTTPS/TLS |
| Do you provide a way for users to request that their data is deleted? | **Yes** — then a URL field appears |
| Delete account URL | `https://botessellate.github.io/app_privacy_policy/alate/delete-account.html` |
| "My app does not allow users to create an account" | **Leave UNCHECKED** — Google sign-in creates an account |

### Sub-step "Data types" — tick ONLY these

| Data type (Google's category) | Why alate collects it |
|---|---|
| Personal info → **Name** | From optional Google sign-in |
| Personal info → **Email address** | From optional Google sign-in; also the optional brand-request "notify me" email |
| App info and performance → **Crash logs** | Sentry + Firebase Crashlytics |
| App info and performance → **Diagnostics** | Sentry / Crashlytics — device model, OS version, session id |
| **Device or other IDs** | The random per-install UUID, sent for rate-limiting |

### Do NOT tick these — and why

| Not declared | Reason |
|---|---|
| Health and fitness / body measurements | Your body profile is sent to **our own** backend only **transiently** to compute a fit check — used in memory, never stored, never logged. Google's rules allow data that is **processed ephemerally** to be left undeclared. (See the double-check note below.) |
| Pasted product URLs | Same — scraped in real time and discarded, never stored against your identity. Ephemeral. |
| Fit history, in-app activity | Stored **only on the device** — never sent off it, so not "collected". |
| Location, financial info, messages, photos, contacts, calendar | alate does not touch any of these. |

### Sub-step "Data usage and handling" — for each of the 5 declared types

- **Collected:** Yes
- **Shared:** **No.** Every off-device recipient (Vercel, Supabase, Sentry, Crashlytics) is a *service provider* processing on our behalf — Google counts that as "collected", not "shared". No user data is handed to a separate company as "sharing".
- **Processed ephemerally:** No — these five are retained (crash logs ~90 days; account data while signed in).
- **Required or optional:**
  - Name, Email → **Optional** (sign-in is optional)
  - Crash logs, Diagnostics, Device IDs → **Required**
- **Purpose** (tick per type):
  - Name, Email → *Account management*, *App functionality*
  - Crash logs, Diagnostics → *App functionality*, *Analytics*
  - Device or other IDs → *Fraud prevention, security, and compliance*

### One answer to double-check before you submit

**Body measurements.** They're sent to our backend for the fit calc but
only in memory, never stored — which is why the guide above says don't
declare them (Google's "ephemeral processing" exemption). This is the
one borderline call. Before submitting, open **Play Console Help →
"Provide information for Google Play's Data safety section"** and
confirm the *ephemeral processing* definition still says such data need
not be declared. If Google's wording has changed, declare body
measurements under **Personal info → Other info** — *Collected: Yes,
Processed ephemerally: Yes, Required, purpose: App functionality*.
Either way the privacy policy (v3.2) already describes this flow
accurately, so the policy and the form stay consistent.

### How to verify this section is done

All Data safety sub-steps show a green tick on the App content
dashboard. The **Preview** sub-step shows: data collected = Name, Email,
Crash logs, Diagnostics, Device IDs; data shared = none; encrypted in
transit = yes; deletion method = yes.
