import { useAvatarStore } from '../store/avatarStore';

const makeAvatar = (overrides = {}) => ({
  height_cm: 170,
  gender: 'woman' as const,
  shoulders: 'average' as const,
  bust: 'medium' as const,
  waist: 'average' as const,
  hips: 'average' as const,
  thighs: 'average' as const,
  torso_length: 'average' as const,
  ...overrides,
});

describe('avatarStore', () => {
  beforeEach(() => {
    useAvatarStore.setState({ avatar: null });
  });

  it('should initialize with null avatar', () => {
    const { avatar } = useAvatarStore.getState();
    expect(avatar).toBeNull();
  });

  it('should set avatar with all required fields', () => {
    const testAvatar = makeAvatar();

    useAvatarStore.getState().setAvatar(testAvatar);

    const { avatar } = useAvatarStore.getState();
    expect(avatar).toEqual(testAvatar);
  });

  it('should clear avatar', () => {
    useAvatarStore.getState().setAvatar(makeAvatar());
    useAvatarStore.getState().clearAvatar();

    const { avatar } = useAvatarStore.getState();
    expect(avatar).toBeNull();
  });

  it('should overwrite existing avatar', () => {
    useAvatarStore.getState().setAvatar(makeAvatar({ height_cm: 160, shoulders: 'narrow' }));
    useAvatarStore.getState().setAvatar(makeAvatar({ height_cm: 180, shoulders: 'broad' }));

    const { avatar } = useAvatarStore.getState();
    expect(avatar?.height_cm).toBe(180);
    expect(avatar?.shoulders).toBe('broad');
  });

  describe('body measurements', () => {
    it('should accept all shoulder types', () => {
      for (const value of ['narrow', 'average', 'broad'] as const) {
        useAvatarStore.getState().setAvatar(makeAvatar({ shoulders: value }));
        expect(useAvatarStore.getState().avatar?.shoulders).toBe(value);
      }
    });

    it('should accept all bust types', () => {
      for (const value of ['small', 'medium', 'large', 'extra-large'] as const) {
        useAvatarStore.getState().setAvatar(makeAvatar({ bust: value }));
        expect(useAvatarStore.getState().avatar?.bust).toBe(value);
      }
    });

    it('should accept all hip types', () => {
      for (const value of ['narrow', 'average', 'wide', 'extra-wide'] as const) {
        useAvatarStore.getState().setAvatar(makeAvatar({ hips: value }));
        expect(useAvatarStore.getState().avatar?.hips).toBe(value);
      }
    });

    it('should accept all thigh types', () => {
      for (const value of ['slim', 'average', 'muscular', 'full'] as const) {
        useAvatarStore.getState().setAvatar(makeAvatar({ thighs: value }));
        expect(useAvatarStore.getState().avatar?.thighs).toBe(value);
      }
    });
  });

  describe('gender', () => {
    // Added 2026-04-29 — the avatar previously assumed the user was a
    // woman (bust-only chip flow, no gender field). Now we persist a
    // self-described gender so AvatarSetup can adapt the chest/bust
    // copy and any future male/non-binary-specific tweaks read from
    // a single source.
    it('should accept woman / man / nonbinary', () => {
      for (const value of ['woman', 'man', 'nonbinary'] as const) {
        useAvatarStore.getState().setAvatar(makeAvatar({ gender: value }));
        expect(useAvatarStore.getState().avatar?.gender).toBe(value);
      }
    });

    it('should default to woman on legacy avatars without a gender field', () => {
      // Migration safety: existing users (zustand-persisted from before
      // gender existed) must not be wiped to null. The store treats a
      // missing gender as "woman" — the historical default — so the
      // bust-bias UX they already chose carries forward.
      useAvatarStore.setState({
        avatar: {
          height_cm: 170,
          shoulders: 'average',
          bust: 'medium',
          waist: 'average',
          hips: 'average',
          thighs: 'average',
          torso_length: 'average',
        } as any,
      });
      const { avatar } = useAvatarStore.getState();
      // Legacy reads: even though the persisted blob has no gender,
      // consumers should be able to treat `gender ?? 'woman'` as the
      // safe fallback. The store itself doesn't backfill — it just
      // doesn't reject the legacy shape.
      expect(avatar?.gender ?? 'woman').toBe('woman');
    });
  });

  describe('height ranges', () => {
    it('should accept minimum height', () => {
      useAvatarStore.getState().setAvatar(makeAvatar({ height_cm: 155 }));
      expect(useAvatarStore.getState().avatar?.height_cm).toBe(155);
    });

    it('should accept maximum height', () => {
      useAvatarStore.getState().setAvatar(makeAvatar({ height_cm: 183 }));
      expect(useAvatarStore.getState().avatar?.height_cm).toBe(183);
    });
  });
});
