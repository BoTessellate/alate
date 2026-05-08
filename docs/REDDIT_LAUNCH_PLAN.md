# Reddit launch plan — alate

**Status:** draft 2026-05-06. No subs posted to yet. Update this file as
you post; mark each row with date + outcome.

## Premise

alate solves a problem most online shoppers know but rarely articulate:
"I can't tell from the photo if this will fit me." The most authentic
Reddit voice is *the user who's lived this pain*, not a marketer
announcing a tool. The plan below biases toward earning trust before
asking for a download.

## DO / DON'T

| ✅ | ❌ |
|---|---|
| Read each sub's sidebar + last 30 days of removed posts BEFORE writing | Cross-post the same copy to multiple subs same day (auto-shadowban risk) |
| Post from your real, well-aged account (≥3 months, ≥100 karma min) | Use a fresh throwaway "PM_me_for_alate" account |
| Disclose authorship in the first paragraph if announcing the tool | Hide "I built this" until someone asks |
| Lead with the *problem* and the *learning*, not the tool | Lead with screenshots of your app |
| Reply to every comment within 24 h, even hostile ones | Delete critical comments — Reddit notices |
| Upload images directly to Reddit; drop the link in a top-level comment | Link the Play Store URL in the post body (auto-removed by most subs) |
| Have a `(comment)` ready with: privacy stance, data handling, who built it, why free | Promise features that aren't shipping (wardrobe sync, brand discounts) |

## Account hygiene checklist (before posting)

- [ ] Account age ≥ 3 months
- [ ] Comment karma ≥ 100 (post in 5+ unrelated subs, build tone first)
- [ ] Username is not `alate_team` / `try_alate` / etc.
- [ ] No deleted/removed posts in last 30 days
- [ ] Bio doesn't read like a press kit

## Target subs — tier 1 (high signal, strict rules)

| Subreddit | Subscribers | Why | Self-promo rule | Notes |
|---|---|---|---|---|
| r/PetiteFashionAdvice | ~180k | alate's height-aware fit prediction is the headline value-prop here | Mods allow personal tools if framed as "thing I built for myself"; rule against direct product links | Highest message-fit tier; post here first |
| r/TallGirls | ~200k | Same as petite — opposite end of the height curve, same return-rate pain | Loose self-promo rules but the community downvotes "ad-shaped" posts hard | Story angle: "I'm 5'11", here's how I stopped buying tops that hit at the wrong place" |
| r/femalefashionadvice | ~1.6M | Largest fit-conscious audience | **Rule 6 + Rule 9 ban self-promo outright**; mods remove on sight unless it's the monthly Self-Promo Sunday thread | Use the *Simple Questions* daily thread as a comment, not a top-level post |
| r/malefashionadvice | ~3M | Same as ffa | Self-promo only via the periodic megathread | Same comment-strategy as ffa |

## Target subs — tier 2 (lower signal, looser rules)

| Subreddit | Subscribers | Why | Self-promo rule | Notes |
|---|---|---|---|---|
| r/poshmark | ~60k | Resellers care about fit because returns hurt their margins | Rule against shilling but tools that help buyers are tolerated | Frame: "stops the 'didn't fit, sending back' cycle" |
| r/Frugal | ~3M | Returns waste money; fit prediction = saving money | "Promotion" rule; lead with the data ("X% of online clothing is returned, here's a tool") | Risky — Frugal hates promo |
| r/sustainability | ~430k | Returns generate emissions; fit prediction reduces that | Loose, story-led works | Angle: "online return waste" → tool as one solution |
| r/Sewing | ~700k | Fit-curious audience, but sews their own | Tolerant if framed as "for the days you're not sewing" | Niche but engaged |
| r/Indyx, r/Whering | <5k each | Wardrobe-app communities; alate eventually integrates | Small enough that mods are reachable for permission | Don't post until [`backlog/wardrobe-integration.md`](../backlog/wardrobe-integration.md) Tier-1 ships |

## Post variants

### Variant A — story-led (best for r/PetiteFashionAdvice, r/TallGirls)

> **Title:** "Tired of returns, I built a thing that predicts whether a top will fit before I order — what I learned about why fit photos lie"
>
> **Body** (~250–400 words):
> 1. **Hook** — one return I made that pissed me off ("ordered a 'longline tunic', it hit at my hip; the model is 5'4", I'm 5'11")
> 2. **The pattern** — "I started tracking why each return happened. ~70% of mine were *length on me ≠ length on model*. The size chart didn't catch it because charts measure the garment, not me-on-the-garment."
> 3. **What I built** — "A weekend project turned into an app: paste a product link, it pulls the size chart + photos and tells me where the garment will land on my body given my height/proportions."
> 4. **What I'm sharing** — "It's free, no ads, on Play Store. I'm here because I'd love to know whether the same return-pattern shows up for petites/tall girls/anyone else, and what categories you'd want covered next."
> 5. **Disclosure** — "Yes, I built it. Yes I want feedback. No I'm not selling your data — body profile stays on-device."
>
> **First comment (because most subs auto-remove store links in body):**
> > Play Store: [link]
> > Privacy policy: [link]
> > Source of fit logic: [short writeup or GitHub link if open-sourced]

### Variant B — help-thread reply

Find a thread asking *"how do I stop buying clothes that don't fit"* (search
each sub for last 90 days). Reply genuinely with 2-3 generic tips, then:

> If it helps, I built a tool that predicts fit from a product link — happy to share. (Disclosure: I made it.)

Wait for someone to ask "what's the tool?" before linking. **Do not link in
the first reply** — Reddit reads that as drive-by promo.

### Variant C — tool-announce (only on subs with explicit allow)

Reserve for r/SideProject, r/AppHookup, r/AndroidApps. Lead with the build
("React Native, scrapes size charts, runs fit prediction"), include
screenshot, ask for technical feedback. These subs *expect* tool posts.

## Comment-reply playbook

Pre-write these so you don't fumble live:

| Likely comment | Your reply (keep it tight) |
|---|---|
| "Is this a scam / data harvest?" | "Body profile stays on-device by default. Optional Google sign-in only syncs your fit history across your own devices. Privacy policy: [link]. No ads, no tracking, no data sold." |
| "Why should I trust this over the size chart?" | "You shouldn't trust *only* this. The size chart measures the garment; alate predicts where the garment lands on your body given your height + proportions. It's an extra signal, not a replacement." |
| "How does it work technically?" | "Paste a product URL → backend scrapes size chart + photos → fit logic compares against your body profile → returns a fit score + warnings (e.g. 'cropped at 5'4" model height, will hit higher on you')." |
| "Why free? What's the catch?" | "No catch yet — I'm validating the hypothesis. If it sticks I'll explore brand partnerships (size-chart accuracy, not affiliate). Body data is never on the table." |
| "Doesn't work on \[brand]" | "Yes — currently supports \[N] stores; happy to add yours. Drop a link to a product page that broke and I'll get it on the list." |
| "iOS?" | "Android-first because that's what I have. iOS is on the roadmap — sign up for a heads-up at [TBD]." |

## Timing + cadence

- **First post:** weekday Tue/Wed/Thu, 8–10am ET (catches both US east-coast morning + UK lunch)
- **One sub at a time.** Wait 48 h between subs. Reddit's spam filter cross-references near-duplicate posts across accounts within a week.
- **Reply for the first 4 h** every 15–20 min — early engagement determines whether the post climbs or dies
- **Don't repost** to the same sub for 30 days even if the first post died

## What success looks like (set expectations)

| Tier | Realistic outcome |
|---|---|
| Best case | 1 post hits 200+ upvotes, drives 50–200 installs, 2–3 quality comments worth following up |
| Median case | 20–50 upvotes, 5–15 installs, 1 useful product-feedback thread |
| Worst case | Removed by mods within an hour with no warning. Move to next sub. |

A single top post on r/PetiteFashionAdvice has outperformed entire month-long
ad campaigns for similar tools — but most posts die quietly. Plan for the
median, not the upside.

## Tracking

After each post, log here:

| Date | Sub | Post URL | Upvotes (24h) | Comments | Installs (Play Console) | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |

## What's next after Reddit

- TikTok / Instagram Reels — different funnel; shoot a 30s "predicting fit before buying" demo on a few products and post weekly
- Product Hunt — only after Reddit validates the message; PH amplifies whatever positioning you've already proved
- Wardrobe-app integration — see [`backlog/wardrobe-integration.md`](../backlog/wardrobe-integration.md). Don't announce partnerships until Tier-1 share-sheet ships.
