import { useMusicStore } from '../store/musicStore';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

beforeEach(() => {
  useMusicStore.setState({
    accessToken: null,
    refreshToken: null,
    currentTrack: null,
  });
});

describe('musicStore.fetchNowPlaying', () => {
  it('is a no-op when no accessToken is set (no throw, no fetch)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    await expect(useMusicStore.getState().fetchNowPlaying()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useMusicStore.getState().currentTrack).toBeNull();
  });

  it('parses a valid now-playing payload into currentTrack', async () => {
    useMusicStore.setState({ accessToken: 'valid-token' });
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        is_playing: true,
        item: {
          name: 'Nightcall',
          artists: [{ name: 'Kavinsky' }],
          album: { images: [{ url: 'https://art/nightcall.jpg' }] },
        },
      }),
    }) as any;

    await useMusicStore.getState().fetchNowPlaying();

    expect(useMusicStore.getState().currentTrack).toEqual({
      title: 'Nightcall',
      artist: 'Kavinsky',
      albumArt: 'https://art/nightcall.jpg',
    });
  });

  it('handles 204 (nothing playing) by clearing currentTrack without throwing', async () => {
    useMusicStore.setState({
      accessToken: 'valid-token',
      currentTrack: { title: 'stale', artist: 'stale' },
    });
    global.fetch = jest.fn().mockResolvedValue({
      status: 204,
      ok: true,
      json: async () => ({}),
    }) as any;

    await useMusicStore.getState().fetchNowPlaying();

    expect(useMusicStore.getState().currentTrack).toBeNull();
  });

  it('swallows network errors — currentTrack stays null, does not throw', async () => {
    useMusicStore.setState({ accessToken: 'valid-token' });
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as any;

    await expect(useMusicStore.getState().fetchNowPlaying()).resolves.toBeUndefined();
    expect(useMusicStore.getState().currentTrack).toBeNull();
  });

  it('disconnect clears tokens and currentTrack', () => {
    useMusicStore.setState({
      accessToken: 'a',
      refreshToken: 'b',
      currentTrack: { title: 't', artist: 'a' },
    });
    useMusicStore.getState().disconnect();
    const s = useMusicStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.currentTrack).toBeNull();
  });
});
