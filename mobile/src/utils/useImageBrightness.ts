/**
 * useImageBrightness — async hook that returns whether the dominant
 * colour of a remote image is "light" or "dark".
 *
 * Driven by `react-native-image-colors`: native pickers on iOS / Android
 * sample the image and return per-platform palette objects. We pick a
 * single representative colour (Android: `dominant`; iOS: `background`),
 * compute its WCAG relative luminance, and bucket into light/dark on a
 * 0.5 split.
 *
 * Use cases (May 4 2026 onward):
 *   - FitResultScreen hero brand+name: switch text colour to dark on
 *     a light product photo (white-on-white was unreadable on the
 *     RIO drawstring-shorts shot the user flagged).
 *
 * The hook returns `null` while the colour is still being sampled
 * (first render after the URI changes) AND on any failure (network
 * error, malformed image, missing colour key). Callers should treat
 * `null` as "default to white text" so the UX never blocks on the
 * sampler — the worst case is the prior unsampled-image behaviour.
 *
 * Caching: the underlying library caches per-URI in memory by default,
 * so flipping back and forth between cards in History is free after
 * the first sample.
 */

import { useEffect, useState } from 'react';
import { getColors } from 'react-native-image-colors';
import { Platform } from 'react-native';

export type Brightness = 'light' | 'dark';

/** Convert a hex string to relative luminance per WCAG 2.1.
 *  Returns 0..1; >= 0.5 → light, < 0.5 → dark. */
function hexLuminance(hex: string): number {
  // Strip # and any alpha component (some pickers return #RRGGBBAA).
  const cleaned = hex.replace('#', '').slice(0, 6);
  if (cleaned.length !== 6) return 0.5; // ambiguous → default to light
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Best per-platform pick from the sampler result. */
function pickColor(result: Awaited<ReturnType<typeof getColors>>): string | null {
  if (!result) return null;
  if (result.platform === 'android') return result.dominant ?? result.average ?? null;
  if (result.platform === 'ios') return result.background ?? null;
  // web fallback (jest mocks land here too)
  if ('dominant' in result && typeof result.dominant === 'string') return result.dominant;
  return null;
}

/**
 * Sample the dominant colour of `uri` and report whether the image is
 * light or dark. Returns `null` while sampling or on failure.
 *
 * Pass `null` / `undefined` as `uri` to short-circuit (returns `null`).
 */
export function useImageBrightness(uri: string | null | undefined): Brightness | null {
  const [brightness, setBrightness] = useState<Brightness | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      setBrightness(null);
      return;
    }

    setBrightness(null);
    getColors(uri, {
      cache: true,
      key: uri,
      fallback: '#000000',
      // Android-only — bigger spacing = faster sample, fine for the
      // top-of-image hero region where exact precision doesn't matter.
      pixelSpacing: Platform.OS === 'android' ? 8 : undefined,
      quality: 'low',
    } as any)
      .then((result) => {
        if (cancelled) return;
        const hex = pickColor(result);
        if (!hex) {
          setBrightness(null);
          return;
        }
        setBrightness(hexLuminance(hex) >= 0.55 ? 'light' : 'dark');
      })
      .catch(() => {
        if (cancelled) return;
        setBrightness(null);
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return brightness;
}
