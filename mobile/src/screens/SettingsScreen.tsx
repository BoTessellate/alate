/**
 * Settings Screen - App configuration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography, borderRadius } from '../constants/theme';

interface SettingToggleProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function SettingToggle({ title, description, value, onValueChange }: SettingToggleProps) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surface, true: colors.primaryDark }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [aiEnhancements, setAiEnhancements] = useState(true);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [smartLabels, setSmartLabels] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* AI Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Features</Text>
          <View style={styles.sectionContent}>
            <SettingToggle
              title="AI Enhancements"
              description="Enable AI-powered features throughout the app"
              value={aiEnhancements}
              onValueChange={setAiEnhancements}
            />
            <SettingToggle
              title="Auto-Enrich Products"
              description="Automatically generate tags and colors for scraped products"
              value={autoEnrich}
              onValueChange={setAutoEnrich}
            />
            <SettingToggle
              title="Smart Label Placement"
              description="AI-assisted label positioning on moodboards"
              value={smartLabels}
              onValueChange={setSmartLabels}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.sectionContent}>
            <SettingToggle
              title="Dark Mode"
              description="Use dark theme throughout the app"
              value={darkMode}
              onValueChange={setDarkMode}
            />
            <SettingToggle
              title="Haptic Feedback"
              description="Vibration feedback for interactions"
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
            />
          </View>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.settingButton}>
              <Text style={styles.settingButtonText}>Clear Image Cache</Text>
              <Text style={styles.settingButtonMeta}>~0 MB</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingButton}>
              <Text style={styles.settingButtonText}>Export All Data</Text>
              <Text style={styles.settingButtonMeta}>JSON format</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={[styles.settingButton, styles.dangerButton]}>
              <Text style={styles.dangerButtonText}>Delete All Moodboards</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingButton, styles.dangerButton]}>
              <Text style={styles.dangerButtonText}>Reset App</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>TML Moodboard</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutInfo}>
            AI-powered moodboard creation for designers and creatives.
            Built with React Native, Expo, and Claude Opus 4.5.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    ...typography.body,
    color: colors.text,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingButtonText: {
    ...typography.body,
    color: colors.text,
  },
  settingButtonMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dangerButton: {
    borderBottomColor: colors.error,
  },
  dangerButtonText: {
    ...typography.body,
    color: colors.error,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  aboutTitle: {
    ...typography.h3,
    color: colors.text,
  },
  aboutVersion: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  aboutInfo: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
