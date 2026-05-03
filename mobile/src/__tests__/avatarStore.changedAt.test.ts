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

describe('avatarStore.lastChangedAt', () => {
  beforeEach(() => {
    useAvatarStore.setState({ avatar: null, lastChangedAt: null });
  });

  it('initialises lastChangedAt as null', () => {
    expect(useAvatarStore.getState().lastChangedAt).toBeNull();
  });

  it('setAvatar stamps lastChangedAt with the current time', () => {
    const before = Date.now();
    useAvatarStore.getState().setAvatar(baseAvatar);
    const stamped = useAvatarStore.getState().lastChangedAt;
    expect(stamped).not.toBeNull();
    expect(new Date(stamped!).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('setAvatar updates lastChangedAt on each change (so stale-checks see the latest)', async () => {
    useAvatarStore.getState().setAvatar(baseAvatar);
    const first = useAvatarStore.getState().lastChangedAt;
    expect(first).not.toBeNull();

    // Wait long enough that Date.now() ticks even on Windows (15ms granularity).
    await new Promise((r) => setTimeout(r, 25));

    useAvatarStore.getState().setAvatar({ ...baseAvatar, height_cm: 175 });
    const second = useAvatarStore.getState().lastChangedAt;
    expect(new Date(second!).getTime()).toBeGreaterThan(new Date(first!).getTime());
  });

  it('setAvatar does NOT bump lastChangedAt when the new value is structurally equal', () => {
    useAvatarStore.getState().setAvatar(baseAvatar);
    const first = useAvatarStore.getState().lastChangedAt;
    useAvatarStore.getState().setAvatar({ ...baseAvatar });
    const second = useAvatarStore.getState().lastChangedAt;
    expect(second).toBe(first);
  });

  it('clearAvatar bumps lastChangedAt (clearing IS a change)', async () => {
    useAvatarStore.getState().setAvatar(baseAvatar);
    const first = useAvatarStore.getState().lastChangedAt;
    await new Promise((r) => setTimeout(r, 25));
    useAvatarStore.getState().clearAvatar();
    const second = useAvatarStore.getState().lastChangedAt;
    expect(new Date(second!).getTime()).toBeGreaterThan(new Date(first!).getTime());
  });
});
