/**
 * PickImageScreen — v2 story share (flag-gated by featureFlags.V2).
 *
 * Entry point for the overlay editor. Lets the user pick a photo from
 * gallery or take a new one via camera, then navigates to OverlayEditor
 * with the chosen uri seeded on the editorStore.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import ToastNotice from '../components/ToastNotice';
import { useEditorStore } from '../store/editorStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PickImageScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ title: string; message?: string; variant?: 'info' | 'error' } | null>(null);
  const setImage = useEditorStore((s) => s.setImage);
  const resetEditor = useEditorStore((s) => s.reset);

  const openPicker = async (source: 'library' | 'camera') => {
    if (loading) return;
    setLoading(true);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setToast({ title: 'Camera access needed', message: 'Enable camera in Settings to take a photo.' });
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setToast({ title: 'Photo access needed', message: 'Enable photo library in Settings.' });
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.9,
            });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      // Clear any stale overlays from a previous session before seeding.
      resetEditor();
      setImage(asset.uri);
      navigation.navigate('OverlayEditor');
    } catch (err) {
      setToast({ title: 'Something went wrong', message: String((err as Error)?.message ?? err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="pick-image-back"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>new story</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.lede}>pick a photo to start — add words and a now-playing track.</Text>

        <GlassCard style={styles.optionCard}>
          <TouchableOpacity
            testID="pick-from-library"
            onPress={() => openPicker('library')}
            disabled={loading}
            style={styles.optionRow}
            activeOpacity={0.75}
          >
            <View style={styles.iconBubble}>
              <Feather name="image" size={20} color={colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>from gallery</Text>
              <Text style={styles.optionSub}>pick a photo you already have</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.optionCard}>
          <TouchableOpacity
            testID="pick-from-camera"
            onPress={() => openPicker('camera')}
            disabled={loading || Platform.OS === 'web'}
            style={styles.optionRow}
            activeOpacity={0.75}
          >
            <View style={styles.iconBubble}>
              <Feather name="camera" size={20} color={colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>take a photo</Text>
              <Text style={styles.optionSub}>new snap straight from the camera</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </GlassCard>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>opening…</Text>
          </View>
        )}
      </View>
      <ToastNotice
        visible={toast !== null}
        title={toast?.title ?? ''}
        message={toast?.message}
        variant={toast?.variant ?? 'info'}
        onDismiss={() => setToast(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.headingL,
    color: colors.text,
  },
  body: {
    flex: 1,
    gap: spacing.md,
  },
  lede: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  optionCard: {
    borderRadius: borderRadius.xxl,
    padding: 0,
    ...shadows.glass,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...typography.labelLarge,
    color: colors.text,
  },
  optionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
