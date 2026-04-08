# Working Directory Usage

**Path:** `.claude/working directory/`

**Purpose:** Track in-progress feature implementations to prevent context loss if session terminates.

---

## How It Works

### During Implementation

When starting a feature:

1. Create a file: `.claude/working directory/FEATURE_NAME.md`
2. Document:
   - What's being built
   - Current progress
   - Blockers/questions
   - Files modified
   - Next steps

**Example structure:**
```markdown
# Feature: Price Filtering

## Goal
Add price range slider to product discovery page

## Progress
- ✅ Added UI slider component
- ✅ Connected to search API
- ⏳ Testing edge cases
- ❌ Not yet: Update URL params

## Files Modified
- frontend/src/app/discover/page.tsx (lines 80-120)
- backend/sdk/searchEngine/index.ts (lines 45-60)

## Blockers
- Need to confirm price range format with API

## Next Steps
1. Test with extreme values
2. Add URL state
3. Run Playwright tests
```

### After Push to Git

**IMPORTANT:** Delete the working file after successful git push.

```bash
# After git push succeeds
rm ".claude/working directory/FEATURE_NAME.md"
```

This keeps the directory clean and shows only active work.

---

## Commands Should Check This Directory

### `/prime` Command
- Check for files in working directory
- If found, show user what was in progress
- Ask if they want to continue or start fresh

### `/build-feature` Command
- Create working file at start
- Update it during implementation
- Delete it after successful commit/push

---

## Benefits

1. **Resume after crash** - Full context preserved
2. **No repeated explanations** - AI picks up where it left off
3. **Clear active work** - Only in-progress items visible
4. **Clean state** - Completed work removed

---

## Current Files

Check what's in progress:
```bash
ls -la ".claude/working directory/"
```

If files exist but work is done, clean up:
```bash
rm ".claude/working directory/OLD_FEATURE.md"
```
