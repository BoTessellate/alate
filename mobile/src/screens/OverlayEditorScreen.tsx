/**
 * OverlayEditorScreen — v2 story share (flag-gated by featureFlags.V2).
 *
 * Full-screen canvas showing the picked image. Preset word chips at the
 * bottom drop draggable text nodes onto the canvas. Pan to move, pinch
 * to scale, two-finger rotate, long-press to delete. A Spotify now-
 * playing pill at the top can be tapped to drop track metadata as its
 * own overlay. "Share" flattens the canvas to a PNG via
 * `react-native-view-shot`, writes to cache, and opens the native share
 * sheet via `expo-sharing`.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useEditorStore, TextOverlay } from '../store/editorStore';
import { useMusicStore } from '../store/musicStore';
import { PRESET_WORDS } from '../constants/presetWords';
import ToastNotice from '../components/ToastNotice';

export default function OverlayEditorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canvasRef = useRef<View>(null);

  const imageUri = useEditorStore((s) => s.imageUri);
  const overlays = useEditorStore((s) => s.overlays);
  const addOverlay = useEditorStore((s) => s.addOverlay);
  const setTrackMetadata = useEditorStore((s) => s.setTrackMetadata);
  const reset = useEditorStore((s) => s.reset);

  const accessToken = useMusicStore((s) => s.accessToken);
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const fetchNowPlaying = useMusicStore((s) => s.fetchNowPlaying);

  const [exporting, setExporting] = useState(false);
  const [manualTrack, setManualTrack] = useState('');
  const [toast, setToast] = useState<{ title: string; message?: string; variant?: 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (accessToken) {
      fetchNowPlaying();
    }
  }, [accessToken, fetchNowPlaying]);

  const handleAddWord = (word: string) => {
    // Seed new overlays slightly offset from center so stacking doesn't
    // completely overlap. Canvas coords are relative to the canvas
    // origin; we give a deterministic seed and let the user drag.
    const jitter = overlays.length * 16;
    addOverlay(word, { x: 20 + jitter, y: 120 + jitter });
  };

  const handleDropTrack = () => {
    if (currentTrack) {
      setTrackMetadata(currentTrack);
      addOverlay(`♪ ${currentTrack.title} — ${currentTrack.artist}`, {
        x: 20,
        y: 60,
      });
    } else if (manualTrack.trim()) {
      const text = manualTrack.trim();
      setTrackMetadata({ title: text, artist: '' });
      addOverlay(`♪ ${text}`, { x: 20, y: 60 });
      setManualTrack('');
    }
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const uri = await captureRef(canvasRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setToast({ title: 'Sharing unavailable', message: 'Your device does not support sharing.' });
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'share your story' });
    } catch (err) {
      setToast({ title: 'Export failed', message: String((err as Error)?.message ?? err), variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    reset();
    navigation.goBack();
  };

  if (!imageUri) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.emptyText}>no photo picked.</Text>
        <TouchableOpacity onPress={handleClose} style={styles.emptyBack}>
          <Text style={styles.emptyBackText}>go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Canvas — everything inside is captured on snapshot. */}
      <View ref={canvasRef} collapsable={false} style={styles.canvas}>
        <Image source={{ uri: imageUri }} style={styles.bgImage} resizeMode="cover" />
        {overlays.map((ov) => (
          <OverlayNode key={ov.id} overlay={ov} />
        ))}
      </View>

      {/* Top chrome — close + now-playing pill + share */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity
          testID="overlay-close"
          onPress={handleClose}
          style={styles.roundBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="now-playing-pill"
          onPress={handleDropTrack}
          style={styles.nowPlaying}
          activeOpacity={0.8}
          disabled={!currentTrack}
        >
          <Feather name="music" size={14} color={colors.white} />
          <Text style={styles.nowPlayingText} numberOfLines={1}>
            {currentTrack
              ? `${currentTrack.title} — ${currentTrack.artist}`
              : 'connect spotify'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="overlay-share"
          onPress={handleShare}
          style={styles.roundBtn}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Feather name="share" size={18} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom — manual track input if no Spotify, then preset chips */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {!accessToken && (
          <View style={styles.manualRow}>
            <TextInput
              testID="manual-track-input"
              placeholder="listening to…"
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={manualTrack}
              onChangeText={setManualTrack}
              style={styles.manualInput}
              returnKeyType="done"
              onSubmitEditing={handleDropTrack}
            />
            <TouchableOpacity
              testID="manual-track-add"
              style={styles.manualBtn}
              onPress={handleDropTrack}
              disabled={!manualTrack.trim()}
            >
              <Feather name="plus" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          testID="preset-chip-row"
        >
          {PRESET_WORDS.map((word) => (
            <TouchableOpacity
              key={word}
              testID={`preset-chip-${word}`}
              onPress={() => handleAddWord(word)}
              style={styles.chip}
              activeOpacity={0.75}
            >
              <Text style={styles.chipText}>{word}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <ToastNotice
        visible={toast !== null}
        title={toast?.title ?? ''}
        message={toast?.message}
        variant={toast?.variant ?? 'info'}
        onDismiss={() => setToast(null)}
      />
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// OverlayNode — each draggable/scalable/rotatable/long-press-to-delete text
// ---------------------------------------------------------------------------

function OverlayNode({ overlay }: { overlay: TextOverlay }) {
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);

  const translateX = useSharedValue(overlay.x);
  const translateY = useSharedValue(overlay.y);
  const scale = useSharedValue(overlay.scale);
  const rotate = useSharedValue(overlay.rotate);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotate = useSharedValue(0);

  const commit = () => {
    updateOverlay(overlay.id, {
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
      rotate: rotate.value,
    });
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = startScale.value * e.scale;
      scale.value = Math.max(0.4, Math.min(next, 5));
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const rot = Gesture.Rotation()
    .onBegin(() => {
      startRotate.value = rotate.value;
    })
    .onUpdate((e) => {
      rotate.value = startRotate.value + e.rotation;
    })
    .onEnd(() => {
      runOnJS(commit)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(550)
    .onStart(() => {
      runOnJS(removeOverlay)(overlay.id);
    });

  const composed = Gesture.Simultaneous(pan, pinch, rot, longPress);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        testID={`overlay-${overlay.id}`}
        style={[styles.overlayWrap, animatedStyle]}
      >
        <Text style={styles.overlayText}>{overlay.word}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexShrink: 1,
    maxWidth: 240,
  },
  nowPlayingText: {
    ...typography.caption,
    color: colors.white,
    flexShrink: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: spacing.sm,
  },
  chipRow: {
    gap: 8,
    paddingRight: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipText: {
    ...typography.label,
    color: colors.white,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manualInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: colors.white,
    ...typography.body,
  },
  manualBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  overlayWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  overlayText: {
    ...typography.displayMedium,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.lg,
  },
  emptyBack: {
    alignSelf: 'center',
    padding: spacing.md,
  },
  emptyBackText: {
    ...typography.labelLarge,
    color: colors.primary,
  },
});

