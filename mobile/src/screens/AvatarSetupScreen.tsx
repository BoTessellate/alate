import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors, spacing, typography, shadows, borderRadius, fontFamily, whiteAlpha, primaryAlpha } from '../constants/theme';
import {
  useAvatarStore,
  GenderType,
  ShoulderType,
  BustType,
  WaistType,
  HipType,
  ThighType,
  TorsoType,
} from '../store/avatarStore';
import { usePendingShareStore } from '../store/pendingShareStore';
import { scrapeProduct } from '../services/api';
// Croquis figurine was retired per Claude Design handoff (user: "fashion
// croquis is inaccurate and really bad looking"). BodyCroquis.tsx +
// BodyFigurine.tsx remain in the repo as dead code for a future v3
// rebuild — see `project_body_croquis_plan.md` memory.
import { BodyFocusArea } from '../components/bodyFigurineModel';
import HeadingImage from '../components/HeadingImage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AvatarSetup'>;

// Gender chip options. Three values, plain labels — the brand voice
// stays editorial-neutral, no exclamation marks. The order is
// deliberately woman → man → nonbinary so the historical default
// (woman) is the leading affordance, but no chip is pre-selected at
// mount time so the user has to actively pick.
const GENDER_OPTIONS: { label: string; value: GenderType; description: string }[] = [
  { label: 'Woman', value: 'woman', description: 'Womenswear sizing' },
  { label: 'Man', value: 'man', description: 'Menswear sizing' },
  { label: 'Non-binary', value: 'nonbinary', description: 'Mix of either' },
];

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

// Bust chips for women + non-binary — described in cup-size language
// since that's the most familiar reference point for womenswear sizing.
const BUST_OPTIONS_WOMEN: { label: string; value: BustType; description: string }[] = [
  { label: 'Small', value: 'small', description: 'A-B cup' },
  { label: 'Medium', value: 'medium', description: 'C-D cup' },
  { label: 'Large', value: 'large', description: 'DD-E cup' },
  { label: 'Extra Large', value: 'extra-large', description: 'F+ cup' },
];

// Chest chips for men — same underlying values feed the avatar store
// (small/medium/large/extra-large translate to the same chest-girth
// buckets in checkFit), but the descriptions speak in chest-build
// language instead of cup sizes. Per user feedback April 29 2026:
// "Why would a man have 'cup' sizes?"
const BUST_OPTIONS_MEN: { label: string; value: BustType; description: string }[] = [
  { label: 'Slim', value: 'small', description: 'Lean chest, narrow build' },
  { label: 'Average', value: 'medium', description: 'Balanced chest' },
  { label: 'Broad', value: 'large', description: 'Fuller chest, athletic build' },
  { label: 'Powerful', value: 'extra-large', description: 'Very developed chest' },
];

/**
 * Pick the chip set to render for step 4 based on gender. Falls
 * back to the women set when gender is null (initial state) so the
 * UI shows something coherent before the user picks step 1.
 */
function bustOptionsFor(gender: GenderType | null) {
  return gender === 'man' ? BUST_OPTIONS_MEN : BUST_OPTIONS_WOMEN;
}

// Legacy alias — kept so any third-party import path doesn't break
// during the v2 rollout. New code should call `bustOptionsFor(gender)`.
const BUST_OPTIONS = BUST_OPTIONS_WOMEN;

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

// STEPS drives the progress bar copy + step-numbering label below
// each section title. Gender is step 1 — picked first so the rest of
// the flow can adapt (the chest/bust label is the immediate
// example). Bust copy is generated dynamically from `genderToBustLabel`
// at render time so the heading reads "Bust" / "Chest" depending on
// the gender chip the user just tapped.
const STEPS = [
  { key: 'gender', title: 'Gender', subtitle: 'How do you shop?' },
  { key: 'height', title: 'Height', subtitle: 'How tall are you?' },
  { key: 'shoulders', title: 'Shoulders', subtitle: 'How would you describe your shoulders?' },
  { key: 'bust', title: 'Bust', subtitle: 'What best describes your bust size?' },
  { key: 'waist', title: 'Waist', subtitle: 'How defined is your waist?' },
  { key: 'hips', title: 'Hips', subtitle: 'How would you describe your hips?' },
  { key: 'thighs', title: 'Thighs', subtitle: 'How would you describe your thighs?' },
  { key: 'torso', title: 'Torso Length', subtitle: 'How long is your torso relative to your legs?' },
];

/**
 * Title/subtitle override for the bust/chest step based on gender.
 * Same chip values (small/medium/large/extra-large) apply to both —
 * the chips describe overall chest girth at the bust line which is
 * meaningful for fit regardless of gender. We only swap the label so
 * the language matches what the user calls it.
 */
function bustStepCopy(gender: GenderType | null) {
  if (gender === 'man') {
    return {
      title: 'Chest',
      subtitle: 'What best describes your chest size?',
    };
  }
  // Woman + non-binary stay on "Bust" — the chip group is bust-coded
  // (cup-size descriptions in BUST_OPTIONS) and the non-binary path
  // currently keeps the same UX. If we eventually ship a separate
  // chest chip group for non-binary, branch here.
  return {
    title: 'Bust',
    subtitle: 'What best describes your bust size?',
  };
}

type ChipOption = { label: string; value: string; description?: string };

function ChipSelector({
  options,
  selected,
  onSelect,
  columns = 3,
  testIDPrefix,
}: {
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  columns?: number;
  /** Namespace chip testIDs so values don't collide across groups */
  testIDPrefix?: string;
}) {
  return (
    <View style={chipStyles.container}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          testID={testIDPrefix ? `${testIDPrefix}-chip-${option.value}` : undefined}
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
    // Frosted chip — near-opaque so the gradient doesn't bleed through.
    backgroundColor: whiteAlpha.surfaceSolid,
    borderRadius: borderRadius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: whiteAlpha.borderMid,
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
    fontSize: 12,
  },
  chipLabelSelected: {
    color: colors.primary,
  },
  chipDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
    fontSize: 10,
  },
  chipDescriptionSelected: {
    color: colors.primary,
  },
});

export default function AvatarSetupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { avatar, setAvatar } = useAvatarStore();
  const { pendingUrl, clearPendingUrl } = usePendingShareStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePart, setActivePart] = useState<BodyFocusArea | null>(null);

  // Gender — read with `?? 'woman'` for legacy avatars persisted
  // before this field existed (April 2026). New profiles always pick
  // explicitly via the chip group; nothing is pre-selected on first
  // mount so the user has to actively answer.
  const [gender, setGender] = useState<GenderType | null>(avatar?.gender ?? null);
  const [height, setHeight] = useState<number | null>(avatar?.height_cm ?? null);
  const [shoulders, setShoulders] = useState<ShoulderType | null>(avatar?.shoulders ?? null);
  const [bust, setBust] = useState<BustType | null>(avatar?.bust ?? null);
  const [waist, setWaist] = useState<WaistType | null>(avatar?.waist ?? null);
  const [hips, setHips] = useState<HipType | null>(avatar?.hips ?? null);
  const [thighs, setThighs] = useState<ThighType | null>(avatar?.thighs ?? null);
  const [torso, setTorso] = useState<TorsoType | null>(avatar?.torso_length ?? null);

  const allFieldsFilled =
    gender !== null &&
    height !== null &&
    shoulders !== null &&
    bust !== null &&
    waist !== null &&
    hips !== null &&
    thighs !== null &&
    torso !== null;

  const filledCount = [gender, height, shoulders, bust, waist, hips, thighs, torso].filter(
    (v) => v !== null
  ).length;

  const canContinue = allFieldsFilled && !isProcessing;

  const handleContinue = async () => {
    if (!allFieldsFilled) return;

    const avatar = {
      gender: gender!,
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
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Back chevron — native stack header is hidden so the TAN
          Nightingale "body profile" title below is the sole page
          heading (no duplicate "Body Profile" next to a chevron). */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backChev, { top: insets.top + spacing.sm }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.75}
      >
        <Feather name="chevron-left" size={22} color={colors.text} />
      </TouchableOpacity>

      {/* Claude Design handoff direction: body croquis removed from the
          onboarding flow ("inaccurate and really bad looking" — user
          words). Full-width chip flow is what the design landed on.
          BodyCroquis.tsx + BodyFigurine.tsx stay in the repo as dead
          components for now so the v3 rebuild has the same starting
          point; see `project_body_croquis_plan.md` memory. */}
      <View style={styles.row}>
        <ScrollView
          style={styles.formPane}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <HeadingImage
              testID="avatar-setup-title"
              slot="body-profile"
              fallback="body profile"
              height={48}
              color={colors.text}
              textStyle={styles.title}
            />
            <Text style={styles.subtitle}>
              Select each measurement to build your fit model
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
              {filledCount}/{STEPS.length}
            </Text>
          </View>

          {/* Step 1: Gender — drives the Bust/Chest copy below.
              Picked first so the rest of the flow can adapt. The
              chip group is at columns=3 to fit the three options
              (woman / man / non-binary) on one row. */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>1</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[0].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[0].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={GENDER_OPTIONS}
              selected={gender}
              onSelect={(v) => { setGender(v as GenderType); }}
              testIDPrefix="gender"
            />
          </View>

          {/* Step 2: Height */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>2</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[1].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[1].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={HEIGHT_OPTIONS.map((o) => ({
                label: o.label,
                value: String(o.value),
                description: o.metric,
              }))}
              selected={height ? String(height) : null}
              onSelect={(v) => { setHeight(Number(v)); setActivePart('height'); }}
              columns={2}
              testIDPrefix="height"
            />
          </View>

          {/* Step 3: Shoulders */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>3</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[2].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[2].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={SHOULDER_OPTIONS}
              selected={shoulders}
              onSelect={(v) => { setShoulders(v as ShoulderType); setActivePart('shoulders'); }}
              testIDPrefix="shoulders"
            />
          </View>

          {/* Step 4: Bust / Chest — title flips with gender. Same
              chips either way (chest girth at the bust line is the
              fit-relevant dimension for both menswear + womenswear). */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>4</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{bustStepCopy(gender).title}</Text>
                <Text style={styles.sectionSubtitle}>{bustStepCopy(gender).subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={bustOptionsFor(gender)}
              selected={bust}
              onSelect={(v) => { setBust(v as BustType); setActivePart('bust'); }}
              columns={2}
              testIDPrefix="bust"
            />
          </View>

          {/* Step 5: Waist */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>5</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[4].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[4].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={WAIST_OPTIONS}
              selected={waist}
              onSelect={(v) => { setWaist(v as WaistType); setActivePart('waist'); }}
              testIDPrefix="waist"
            />
          </View>

          {/* Step 6: Hips */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>6</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[5].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[5].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={HIP_OPTIONS}
              selected={hips}
              onSelect={(v) => { setHips(v as HipType); setActivePart('hips'); }}
              columns={2}
              testIDPrefix="hips"
            />
          </View>

          {/* Step 7: Thighs */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>7</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[6].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[6].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={THIGH_OPTIONS}
              selected={thighs}
              onSelect={(v) => { setThighs(v as ThighType); setActivePart('thighs'); }}
              columns={2}
              testIDPrefix="thighs"
            />
          </View>

          {/* Step 8: Torso Length */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.stepNumber}>8</Text>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>{STEPS[7].title}</Text>
                <Text style={styles.sectionSubtitle}>{STEPS[7].subtitle}</Text>
              </View>
            </View>
            <ChipSelector
              options={TORSO_OPTIONS}
              selected={torso}
              onSelect={(v) => { setTorso(v as TorsoType); setActivePart('torso'); }}
              testIDPrefix="torso"
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  // Croquis pane retired — form now takes full width.
  formPane: {
    width: '100%',
  },
  // Back chevron — floats top-left with safe-area offset applied inline.
  // Primary @ 0.18 (instead of colors.text @ 0.06) so the chip carries a
  // subtle lavender warmth on the solid #e6e4e9 background — the old fill
  // was a near-transparent neutral that read as grey, not theme-aware.
  backChev: {
    position: 'absolute',
    left: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: primaryAlpha.tintMd,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  formContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Header — italic serif "body profile" + subtle 12px sub copy per
  // Claude Design ScreenOnboarding.
  //
  // paddingTop pushes the heading below the absolute-positioned back
  // chevron (38px tall, anchored at insets.top + spacing.sm). Without
  // it, the chevron's circular fill draws over the leading characters
  // of the SVG (visible regression in user screenshot, April 29). 40px
  // = chevron-height (38) + 2px breathing margin so even a slightly-
  // taller font face stays clear.
  header: {
    paddingTop: 40,
    marginBottom: spacing.md,
  },
  title: {
    // displayMedium already renders DM Serif Italic lowercase from the
    // theme token, but at 36px it's too heavy for this pane — dial down
    // to 30px while keeping the serif italic voice.
    ...typography.displayMedium,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fontFamily.primary,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
    minWidth: 28,
    textAlign: 'right',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepNumber: {
    ...typography.labelLarge,
    color: colors.white,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
    fontSize: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: colors.text,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  button: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.md,
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
