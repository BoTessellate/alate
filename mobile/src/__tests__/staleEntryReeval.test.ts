/**
 * Regression test for the "I changed my measurements but the history
 * card still shows the old verdict" bug.
 *
 * The fix: avatarStore stamps `lastChangedAt` on every meaningful
 * setAvatar call. FitResultScreen's focus effect then triggers a
 * re-evaluation any time the active entry's `checkedAt` predates
 * `lastChangedAt`, regardless of which path the user took to get there.
 *
 * This test asserts the staleness comparison itself, not the screen
 * (the screen is exercised by the smoke tests).
 */

import { useAvatarStore } from '../store/avatarStore';

const baseAvatar = {
  height_cm: 170,
  gender: 'woman' as const,
  shoulders: 'average' as const,
  bust: 'medium' as const,
  waist: 'average' as const,
  tummy: 'flat' as const,
  hips: 'average' as const,
  thighs: 'average' as const,
  torso_length: 'average' as const,
};

function isStale(entryCheckedAt: string | undefined, lastChangedAt: string | null): boolean {
  if (!lastChangedAt || !entryCheckedAt) return false;
  return new Date(entryCheckedAt).getTime() < new Date(lastChangedAt).getTime();
}

describe('stale-entry detection', () => {
  beforeEach(() => {
    useAvatarStore.setState({ avatar: null, lastChangedAt: null });
  });

  it('an entry checked BEFORE the avatar last changed is stale', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    useAvatarStore.getState().setAvatar(baseAvatar);
    const today = useAvatarStore.getState().lastChangedAt;
    expect(isStale(yesterday, today)).toBe(true);
  });

  it('an entry checked AFTER the avatar last changed is fresh', async () => {
    useAvatarStore.getState().setAvatar(baseAvatar);
    await new Promise((r) => setTimeout(r, 25));
    const future = new Date().toISOString();
    const lastChangedAt = useAvatarStore.getState().lastChangedAt;
    expect(isStale(future, lastChangedAt)).toBe(false);
  });

  it('a no-op avatar save does NOT mark prior entries stale', () => {
    useAvatarStore.getState().setAvatar(baseAvatar);
    const before = useAvatarStore.getState().lastChangedAt;
    useAvatarStore.getState().setAvatar({ ...baseAvatar });
    const after = useAvatarStore.getState().lastChangedAt;
    expect(after).toBe(before);
  });

  it('clearAvatar bumps lastChangedAt, marking entries stale', async () => {
    useAvatarStore.getState().setAvatar(baseAvatar);
    const t1 = useAvatarStore.getState().lastChangedAt;
    await new Promise((r) => setTimeout(r, 25));
    useAvatarStore.getState().clearAvatar();
    const t2 = useAvatarStore.getState().lastChangedAt;
    expect(new Date(t2!).getTime()).toBeGreaterThan(new Date(t1!).getTime());
  });

  it('with no avatar ever set, no entry is ever stale', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isStale(past, null)).toBe(false);
  });
});
