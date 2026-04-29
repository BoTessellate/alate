import { useEditorStore } from '../store/editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('starts empty', () => {
    const s = useEditorStore.getState();
    expect(s.imageUri).toBeNull();
    expect(s.overlays).toEqual([]);
    expect(s.trackMetadata).toBeUndefined();
  });

  it('setImage stores the uri', () => {
    useEditorStore.getState().setImage('file:///tmp/a.jpg');
    expect(useEditorStore.getState().imageUri).toBe('file:///tmp/a.jpg');
  });

  it('addOverlay generates a unique id and default geometry', () => {
    useEditorStore.getState().addOverlay('peace');
    useEditorStore.getState().addOverlay('mood');
    const overlays = useEditorStore.getState().overlays;
    expect(overlays).toHaveLength(2);
    expect(overlays[0].id).not.toBe(overlays[1].id);
    expect(overlays[0].word).toBe('peace');
    expect(overlays[1].word).toBe('mood');
    // Default scale is 1, default rotate is 0
    expect(overlays[0].scale).toBe(1);
    expect(overlays[0].rotate).toBe(0);
  });

  it('updateOverlay merges a patch without clobbering other fields', () => {
    useEditorStore.getState().addOverlay('era');
    const id = useEditorStore.getState().overlays[0].id;
    useEditorStore.getState().updateOverlay(id, { x: 120, y: 80 });
    const entry = useEditorStore.getState().overlays[0];
    expect(entry.x).toBe(120);
    expect(entry.y).toBe(80);
    expect(entry.word).toBe('era');
    expect(entry.scale).toBe(1);
  });

  it('updateOverlay ignores unknown ids (no throw)', () => {
    expect(() =>
      useEditorStore.getState().updateOverlay('nope', { x: 10 })
    ).not.toThrow();
    expect(useEditorStore.getState().overlays).toEqual([]);
  });

  it('removeOverlay filters by id', () => {
    useEditorStore.getState().addOverlay('a');
    useEditorStore.getState().addOverlay('b');
    const first = useEditorStore.getState().overlays[0].id;
    useEditorStore.getState().removeOverlay(first);
    const overlays = useEditorStore.getState().overlays;
    expect(overlays).toHaveLength(1);
    expect(overlays[0].word).toBe('b');
  });

  it('setTrackMetadata stores the track', () => {
    useEditorStore
      .getState()
      .setTrackMetadata({ title: 'Nightcall', artist: 'Kavinsky' });
    expect(useEditorStore.getState().trackMetadata).toEqual({
      title: 'Nightcall',
      artist: 'Kavinsky',
    });
  });

  it('reset clears image, overlays, and track', () => {
    useEditorStore.getState().setImage('file:///tmp/a.jpg');
    useEditorStore.getState().addOverlay('peace');
    useEditorStore
      .getState()
      .setTrackMetadata({ title: 'x', artist: 'y' });
    useEditorStore.getState().reset();
    const s = useEditorStore.getState();
    expect(s.imageUri).toBeNull();
    expect(s.overlays).toEqual([]);
    expect(s.trackMetadata).toBeUndefined();
  });
});
