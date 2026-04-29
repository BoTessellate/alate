/**
 * svgo config for Alate's heading + brand SVG exports.
 *
 * Canva exports nest each glyph in its own `<g transform="translate(...)">`
 * wrapper, then sets `width="600" height="600"` with a tighter
 * `viewBox`. On Android, react-native-svg / Skia mis-rasterizes the
 * nested-transform structure for some paths, producing a visible
 * horizontal banding artifact through every glyph (visible across
 * home-verse, body-profile, history, profile in the April 29 build).
 *
 * The fix is to flatten every transform into the path coordinates
 * (via `convertPathData` + `mergePaths` with the default preset's
 * `applyTransforms` enabled) so the rendered SVG has a single flat
 * <path> per glyph with no transforms, no nested groups.
 *
 * Run:  npx svgo --config svgo.config.js -f assets/images/headings
 *       npx svgo --config svgo.config.js -f assets/images/brands
 */
module.exports = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Keep the viewBox — react-native-svg-transformer relies on it to
          // compute width × aspect at render time (see SVG_ASPECTS in
          // HeadingImage.tsx).
          removeViewBox: false,
          // Allow style+attribute merging so we can fold all the
          // duplicate fill="#ffffff" attributes onto the root.
          mergeStyles: true,
          // Crucial: this collapses nested groups by applying their
          // transforms onto the children's coordinates. After this
          // pass each path renders with no parent transform, which
          // is what fixes the Android rasterization banding.
          collapseGroups: true,
          convertPathData: true,
        },
      },
    },
    // Explicitly run convertTransform after the preset so any
    // residual transforms on individual paths get baked in too.
    'convertTransform',
    // Drop the legacy `width`/`height` attributes when they conflict
    // with the viewBox — react-native-svg-transformer renders SVGs
    // at the dimensions the consumer (HeadingImage) passes anyway,
    // so stripping these prevents preserveAspectRatio confusion.
    'removeDimensions',
  ],
};
