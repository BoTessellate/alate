# Release Status

Both apps are built and ready. The remaining tasks are manual steps needed before Play Store submission.

---

## Release Status Table

| Item | Alate (Fit Check) | Casa (Tenancy) |
|------|:---:|:---:|
| **App name** | Alate | Casa |
| **Package ID** | `com.alate.checkfit` | `com.casa.propertymanagement` |
| **Framework** | Expo / React Native 0.81 | Bare React Native 0.73 |
| **Privacy policy written** | Done | Done |
| **Store listing text** | Done | Done |
| **Data safety audit** | Done | N/A (create one) |
| **App icon** | Exists (needs branded) | Done (all mipmap densities) |
| **E2E tests** | Done (6 spec files, WebdriverIO) | Done (4 spec files, Detox) |
| **Keystore / signing** | EAS managed | Manual (`casa-release.keystore`) |
| **Release build** | Done (`.aab`, EAS production) | Done (signed APK, 21 MB) |
| **Supabase Edge Functions** | N/A | Pending (see below) |
| **Twilio SMS** | N/A | Pending (see below) |
| **Google Play Developer account** | Pending | Pending |
| **Host privacy policy online** | Pending | Pending |
| **Google service account JSON** | Missing | N/A (manual upload) |
| **Content rating (IARC)** | Pending | Pending |
| **Data safety form (Play Console)** | Pending | Pending |
| **Screenshots + feature graphic** | Pending | Pending |
| **Apple Developer account** | Pending ($99/yr) | Pending ($99/yr) |

> **Note:** Both apps share the same Google Play Developer account ($25 one-time). The same privacy policy host (e.g. GitHub Pages) can serve both apps' policies.

---

## Pending Tasks — Details

### 1. Google Play Developer Account
- **Applies to:** Both apps
- **Action:** Pay $25 one-time fee at [play.google.com/console](https://play.google.com/console)
- **Why:** Required to create app listings and upload builds

### 2. Host Privacy Policy
- **Applies to:** Both apps
- **Action:** Upload privacy policy HTML to a public URL (GitHub Pages, Vercel, Netlify, etc.)
- **Files:** `mobile/privacy-policy.html` (Fit Check), `privacy-policy.html` (Casa)
- **Why:** Play Store requires a publicly accessible privacy policy URL
- **Tip:** You can host both on the same domain (e.g. `yourname.github.io/fitcheck/privacy` and `yourname.github.io/casa/privacy`)

### 3. App Icon (Fit Check only)
- **Action:** Replace `mobile/assets/icon.png` and `mobile/assets/adaptive-icon.png` with a branded 1024x1024 PNG
- **Why:** Current icon is a placeholder. Play Store requires a polished app icon

### 4. Supabase Edge Functions (Casa only)
- **Action:** Deploy 2 edge functions to your Supabase project
- **Functions:**
  1. **`send-rent-reminders`** — Scheduled cron job that sends SMS (via Twilio) and push notifications for rent due dates and overdue payments
  2. **`send-push-notification`** — Sends Firebase Cloud Messaging (FCM) push notifications to tenant/landlord devices
- **Deploy command:**
  ```bash
  cd "tenancy app"
  npx supabase functions deploy send-rent-reminders
  npx supabase functions deploy send-push-notification
  ```
- **Required env vars** (set via Supabase dashboard → Edge Functions → Secrets):
  - `SUPABASE_URL` — your Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY` — service role key (NOT anon key)
  - `FCM_SERVER_KEY` — Firebase Cloud Messaging server key (from Firebase Console → Project Settings → Cloud Messaging)
  - `TWILIO_ACCOUNT_SID` — see Twilio setup below
  - `TWILIO_AUTH_TOKEN` — see Twilio setup below
  - `TWILIO_PHONE_NUMBER` — see Twilio setup below
- **Cron schedule:** `send-rent-reminders` should be set up as a cron job (daily) via Supabase dashboard → Database → Extensions → pg_cron, or via the Supabase CLI
- **Why:** Without these deployed, tenants won't receive rent reminders (SMS or push) and landlords won't be able to send notifications

### 5. Twilio Setup (Casa only)
- **Action:** Create a Twilio account and purchase a phone number
- **Steps:**
  1. Sign up at [twilio.com](https://www.twilio.com)
  2. Buy a phone number with SMS capability (from ~$1/month)
  3. Set these env vars in Supabase Edge Functions:
     - `TWILIO_ACCOUNT_SID` — from Twilio dashboard
     - `TWILIO_AUTH_TOKEN` — from Twilio dashboard
     - `TWILIO_PHONE_NUMBER` — your purchased number (e.g. `+1234567890`)
- **Why:** Casa uses Twilio to send SMS rent reminders and overdue payment alerts to tenants. Without a Twilio number, the `send-rent-reminders` edge function silently skips SMS delivery. The app won't crash, but tenants won't receive text notifications.
- **Cost:** ~$1/month for the number + ~$0.0079/SMS sent (pay-as-you-go)

### 6. Google Cloud Service Account (Fit Check only)
- **Action:** Create a service account in GCP Console, download JSON key, save as `mobile/google-services.json`
- **Why:** Required for `eas submit` to automatically upload the `.aab` to Play Console
- **Alternative:** You can skip this and manually upload the `.aab` file to Play Console instead

### 7. Content Rating Questionnaire
- **Applies to:** Both apps
- **Action:** Fill out the IARC form in Play Console after creating each app listing
- **Why:** Required by Google Play. Takes ~5 minutes per app

### 8. Data Safety Form
- **Applies to:** Both apps
- **Action:** Complete the data safety questionnaire in Play Console
- **Reference:** Use `mobile/data-safety-audit.md` (Fit Check) as a guide. Create a similar one for Casa
- **Why:** Required by Google Play since 2022

### 9. Screenshots + Feature Graphic
- **Applies to:** Both apps
- **Action:** Capture 2+ phone screenshots (real device or emulator) + create a 1024x500 feature graphic
- **Tip:** Run each app on an emulator/device, take screenshots of the key screens, and use Canva/Figma for the feature graphic

### 10. Keystore Password Change (Casa only)
- **Action:** Before publishing, change the keystore password from the default `casa2026secure`
- **How:** Generate a new keystore with `keytool` and update `android/gradle.properties`
- **Why:** The current password was set during development and should be changed for security

### 11. Apple Developer Account (iOS)
- **Applies to:** Both apps (when ready for iOS)
- **Action:** Enroll in Apple Developer Program ($99/year) at [developer.apple.com](https://developer.apple.com)
- **Why:** Required to publish on the App Store. Can be deferred — focus on Android first

---

## Already Done

- [x] Privacy policy written for both apps
- [x] Store listing text written (`mobile/store-listing.md` for Fit Check, `store-listing.md` for Casa)
- [x] Data safety audit completed (Fit Check: `mobile/data-safety-audit.md`)
- [x] EAS config cleaned up — Android submit track set to `internal`
- [x] Target API level verified — Expo SDK 54 targets API 35
- [x] Build format verified — Fit Check uses `app-bundle`, Casa uses signed APK
- [x] Production builds completed for both apps
- [x] E2E tests written for both apps
- [x] Firebase configured for Casa (FCM + Google SSO)
- [x] Supabase migrations ready (Casa: `004_add_expenses.sql`, `005_notifications_and_lease_reminders.sql`)
