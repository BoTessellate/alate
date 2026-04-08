import { useAvatarStore } from '../store/avatarStore';

const makeAvatar = (overrides = {}) => ({
  height_cm: 170,
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
