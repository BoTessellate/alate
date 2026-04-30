/**
 * Feature Flags
 *
 * Compile-time flags for gated features. Flip to `true` to enable.
 *
 * Release tracks:
 *   V2 — single umbrella flag for everything being built toward the v2
 *        release. Every v2 feature (story-share editor, future adds)
 *        must be gated by this same flag. New v2 work does NOT get its
 *        own flag — it reuses `V2`, so flipping one switch cuts the
 *        whole release over.
 */

export type FeatureFlag = 'V2';

export const featureFlags: Record<FeatureFlag, boolean> = {
  V2: false,
};

export function isEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] === true;
}
