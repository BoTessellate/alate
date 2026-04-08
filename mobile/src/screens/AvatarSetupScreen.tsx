import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, shadows, borderRadius } from '../constants/theme';
import {
  useAvatarStore,
  ShoulderType,
  BustType,
  WaistType,
  HipType,
  ThighType,
  TorsoType,
} from '../store/avatarStore';
import { usePendingShareStore } from '../store/pendingShareStore';
import { scrapeProduct } from '../services/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AvatarSetup'>;

const HEIGHT_OPTIONS = [
  { label: "Under 5'3\"", value: 155, metric: '< 160cm' },
  { label: "5'3\" - 5'5\"", value: 163, metric: '160-165cm' },
  { label: "5'5\" - 5'7\"", value: 168, metric: '165-170cm' },
  { label: "5'7\" - 5'9\"", value: 173, metric: '170-175cm' },
  { label: "5'9\" - 5'11\"", value: 178, metric: '175-180cm' },
  { label: "Over 5'11\"", value: 183, metric: '180cm+' },
];

// NOTE: Do not change these descriptions. They have been carefully worded
// to help users self-identify accurately without ambiguity.
const SHOULDER_OPTIONS: { label: string; value: ShoulderType; description: string }[] = [
  { label: 'Narrow', value: 'narrow', description: 'Narrower than your hips' },
  { label: 'Average', value: 'average', description: 'Roughly aligned with hips' },
  { label: 'Broad', value: 'broad', description: 'Wider than your hips' },
];

const BUST_OPTIONS: { label: string; value: BustType; description: string }[] = [
  { label: 'Small', value: 'small', description: 'A-B cup' },
  { label: 'Medium', value: 'medium', description: 'C-D cup' },
  { label: 'Large', value: 'large', description: 'DD-E cup' },
  { label: 'Extra Large', value: 'extra-large', description: 'F+ cup' },
];

const WAIST_OPTIONS: { label: string; value: WaistType; description: string }[] = [
  { label: 'Defined', value: 'defined', description: 'Noticeably narrower than hips' },
  { label: 'Average', value: 'average', description: 'Moderate curve inward' },
  { label: 'Straight', value: 'undefined', description: 'Minimal curve inward' },
];

const HIP_OPTIONS: { label: string; value: HipType; description: string }[] = [
  { label: 'Narrow', value: 'narrow', description: 'Straighter silhouette' },
  { label: 'Average', value: 'average', description: 'Moderate curve' },
  { label: 'Wide', value: 'wide', description: 'Noticeably curvy' },
  { label: 'Extra Wide', value: 'extra-wide', description: 'Very full hips' },
];

const THIGH_OPTIONS: { label: string; value: ThighType; description: string }[] = [
  { label: 'Slim', value: 'slim', description: 'Little contact between thighs' },
  { label: 'Average', value: 'average', description: 'Some contact' },
  { label: 'Muscular', value: 'muscular', description: 'Toned & defined' },
  { label: 'Full', value: 'full', description: 'Fuller with more contact' },
];

const TORSO_OPTIONS: { label: string; value: TorsoType; description: string }[] = [
  { label: 'Short', value: 'short', description: 'Longer legs relative to torso' },
  { label: 'Average', value: 'average', description: 'Balanced proportions' },
  { label: 'Long', value: 'long', description: 'Longer torso relative to legs' },
];

const STEPS = [
  { key: 'height', title: 'Height', subtitle: 'How tall are you?' },
  { key: 'shoulders', title: 'Shoulders', subtitle: 'How would you describe your shoulders?' },
  { key: 'bust', title: 'Bust', subtitle: 'What best describes your bust size?' },
  { key: 'waist', title: 'Waist', subtitle: 'How defined is your waist?' },
  { key: 'hips', title: 'Hips', subtitle: 'How would you describe your hips?' },
  { key: 'thighs', title: 'Thighs', subtitle: 'How would you describe your thighs?' },
  { key: 'torso', title: 'Torso Length', subtitle: 'How long is your torso relative to your legs?' },
];

type ChipOption = { label: string; value: string; description?: string };

function ChipSelector({
  options,
  selected,
  onSelect,
  columns = 3,
}: {
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  columns?: number;
}) {
  return (
    <View style={chipStyles.container}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            chipStyles.chip,
            columns === 2 && chipStyles.chipWide,
            selected === option.value && chipStyles.chipSelected,
          ]}
          onPress={() => onSelect(option.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              chipStyles.chipLabel,
              selected === option.value && chipStyles.chipLabelSelected,
            ]}
          >
            {option.label}
          </Text>
          {option.description && (
            <Text
              style={[
                chipStyles.chipDescription,
                selected === option.value && chipStyles.chipDescriptionSelected,
              ]}
            >
              {option.description}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
    ...shadows.sm,
  },
  chipWide: {
    minWidth: '47%',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '15',
  },
  chipLabel: {
    ...typography.labelLarge,
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.primary,
  },
  chipDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  chipDescriptionSelected: {
    color: colors.primary,
  },
});

export default function AvatarSetupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { avatar, setAvatar } = useAvatarStore();
  const { pendingUrl, clearPendingUrl } = usePendingShareStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const [height, setHeight] = useState<number | null>(avatar?.height_cm ?? null);
  const [shoulders, setShoulders] = useState<ShoulderType | null>(avatar?.shoulders ?? null);
  const [bust, setBust] = useState<BustType | null>(avatar?.bust ?? null);
  const [waist, setWaist] = useState<WaistType | null>(avatar?.waist ?? null);
  const [hips, setHips] = useState<HipType | null>(avatar?.hips ?? null);
  const [thighs, setThighs] = useState<ThighType | null>(avatar?.thighs ?? null);
  const [torso, setTorso] = useState<TorsoType | null>(avatar?.torso_length ?? null);

  const allFieldsFilled =
    height !== null &&
    shoulders !== null &&
    bust !== null &&
    waist !== null &&
    hips !== null &&
    thighs !== null &&
    torso !== null;

  const filledCount = [height, shoulders, bust, waist, hips, thighs, torso].filter(
    (v) => v !== null
  ).length;

  const canContinue = allFieldsFilled && !isProcessing;

  const handleContinue = async () => {
    if (!allFieldsFilled) return;

    const avatar = {
      height_cm: height,
      shoulders: shoulders,
      bust: bust,
      waist: waist,
      hips: hips,
      thighs: thighs,
      torso_length: torso,
    };

    setAvatar(avatar);

    if (pendingUrl) {
      setIsProcessing(true);
      try {
        const result = await scrapeProduct(pendingUrl);
        const url = pendingUrl;
        clearPendingUrl();
        if (result.success && result.data) {
          navigation.replace('FitResult', { product: result.data, url });
          return;
        }
      } catch (error) {
        console.error('Failed to process pending URL:', error);
      } finally {
        setIsProcessing(false);
      }
    }

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Build your body profile</Text>
          <Text style={styles.subtitle}>
            We use each measurement to predict how clothes will fit your unique shape
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(filledCount / STEPS.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {filledCount} of {STEPS.length}
          </Text>
        </View>

        {/* Step 1: Height */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>1</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[0].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[0].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={HEIGHT_OPTIONS.map((o) => ({
              label: o.label,
              value: String(o.value),
              description: o.metric,
            }))}
            selected={height ? String(height) : null}
            onSelect={(v) => setHeight(Number(v))}
            columns={2}
          />
        </View>

        {/* Step 2: Shoulders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>2</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[1].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[1].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={SHOULDER_OPTIONS}
            selected={shoulders}
            onSelect={(v) => setShoulders(v as ShoulderType)}
          />
        </View>

        {/* Step 3: Bust */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>3</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[2].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[2].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={BUST_OPTIONS}
            selected={bust}
            onSelect={(v) => setBust(v as BustType)}
            columns={2}
          />
        </View>

        {/* Step 4: Waist */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>4</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[3].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[3].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={WAIST_OPTIONS}
            selected={waist}
            onSelect={(v) => setWaist(v as WaistType)}
          />
        </View>

        {/* Step 5: Hips */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>5</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[4].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[4].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={HIP_OPTIONS}
            selected={hips}
            onSelect={(v) => setHips(v as HipType)}
            columns={2}
          />
        </View>

        {/* Step 6: Thighs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>6</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[5].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[5].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={THIGH_OPTIONS}
            selected={thighs}
            onSelect={(v) => setThighs(v as ThighType)}
            columns={2}
          />
        </View>

        {/* Step 7: Torso Length */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.stepNumber}>7</Text>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{STEPS[6].title}</Text>
              <Text style={styles.sectionSubtitle}>{STEPS[6].subtitle}</Text>
            </View>
          </View>
          <ChipSelector
            options={TORSO_OPTIONS}
            selected={torso}
            onSelect={(v) => setTorso(v as TorsoType)}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          testID="continue-button"
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {pendingUrl ? 'Save & Check Fit' : 'Save Profile'}
            </Text>
          )}
        </TouchableOpacity>

        {!allFieldsFilled && (
          <Text style={styles.remainingNote}>
            {STEPS.length - filledCount} selection{STEPS.length - filledCount !== 1 ? 's' : ''} remaining
          </Text>
        )}

        <Text style={styles.privacyNote}>
          Your body profile is stored locally on your device and never shared.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headingXL,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stepNumber: {
    ...typography.labelLarge,
    color: colors.white,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.headingS,
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  button: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
  remainingNote: {
    ...typography.bodySmall,
    color: colors.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  privacyNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
