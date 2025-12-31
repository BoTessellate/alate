/**
 * Create Screen - New moodboard creation
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { useMoodboardStore } from '../store/moodboardStore';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CANVAS_PRESETS = [
  { name: 'Instagram Post', width: 1080, height: 1080, icon: 'square' as const },
  { name: 'Instagram Story', width: 1080, height: 1920, icon: 'smartphone' as const },
  { name: 'Pinterest', width: 1000, height: 1500, icon: 'image' as const },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'monitor' as const },
  { name: 'Custom', width: 1200, height: 800, icon: 'edit-2' as const },
];

export default function CreateScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { createMoodboard, isLoading } = useMoodboardStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [nameError, setNameError] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);

    console.log('Creating moodboard:', name.trim());

    try {
      const moodboard = await createMoodboard(name.trim(), description.trim() || undefined);
      console.log('Moodboard created:', moodboard);
      navigation.navigate('MoodboardDetail', { moodboardId: moodboard.id });
    } catch (error) {
      console.error('Failed to create moodboard:', error);
      alert('Failed to create moodboard. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Moodboard</Text>
            <Text style={styles.subtitle}>
              Start curating your perfect aesthetic
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, nameError && styles.inputError]}
                placeholder="My awesome moodboard"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (text.trim()) setNameError(false);
                }}
                maxLength={50}
              />
              {nameError && (
                <Text style={styles.errorText}>Please enter a name for your moodboard</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What's this moodboard about?"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            {/* Canvas Size Presets */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Canvas Size</Text>
              <View style={styles.presetGrid}>
                {CANVAS_PRESETS.map((preset, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.presetCard,
                      selectedPreset === index && styles.presetCardSelected,
                    ]}
                    onPress={() => setSelectedPreset(index)}
                  >
                    <Feather
                      name={preset.icon}
                      size={24}
                      color={selectedPreset === index ? colors.primary : colors.textSecondary}
                      style={styles.presetIcon}
                    />
                    <Text style={styles.presetName}>{preset.name}</Text>
                    <Text style={styles.presetSize}>
                      {preset.width} × {preset.height}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? 'Creating...' : 'Create Moodboard'}
            </Text>
          </TouchableOpacity>

          {/* AI Feature Hint */}
          <View style={styles.aiHint}>
            <Feather name="zap" size={20} color={colors.accent} style={styles.aiHintIcon} />
            <Text style={styles.aiHintText}>
              AI will help you with smart layouts, label placement, and theme generation
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  required: {
    color: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetCard: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLight,
  },
  presetIcon: {
    marginBottom: spacing.xs,
  },
  presetName: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  presetSize: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  createButtonDisabled: {
    backgroundColor: colors.primaryDark,
    opacity: 0.7,
  },
  createButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  aiHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  aiHintIcon: {
    marginRight: spacing.xs,
  },
  aiHintText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
});
