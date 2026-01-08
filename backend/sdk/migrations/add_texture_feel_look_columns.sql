-- ============================================================================
-- ADD TEXTURE_FEEL AND TEXTURE_LOOK COLUMNS TO ENRICHED_PRODUCTS
-- ============================================================================
-- Splits the 'texture' field into two distinct properties:
-- - texture_feel = TACTILE (how it feels when touched): soft, silky, rough, etc.
-- - texture_look = VISUAL (how it appears to the eye): matte, glossy, lustrous, etc.
-- The original 'texture' column is kept for backward compatibility.

-- Add texture_feel column
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS texture_feel TEXT;

-- Add texture_look column
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS texture_look TEXT;

-- Add comments explaining the fields
COMMENT ON COLUMN enriched_products.texture_feel IS 'Tactile texture - how the product FEELS: smooth, soft, rough, fuzzy, silky, crisp, plush, textured, ribbed, velvety, etc.';
COMMENT ON COLUMN enriched_products.texture_look IS 'Visual texture - how the product LOOKS: matte, glossy, shiny, lustrous, satin, metallic, woven, knit, velvet, suede, etc.';

-- Create indexes for texture queries (users may search by texture)
CREATE INDEX IF NOT EXISTS idx_enriched_products_texture_feel ON enriched_products(texture_feel);
CREATE INDEX IF NOT EXISTS idx_enriched_products_texture_look ON enriched_products(texture_look);

-- ============================================================================
-- MIGRATE EXISTING DATA (Optional - run if you want to populate new fields)
-- ============================================================================
-- This migrates existing texture values to texture_feel (since old texture was tactile-focused)

UPDATE enriched_products
SET texture_feel = texture
WHERE texture IS NOT NULL
  AND texture_feel IS NULL;

-- For texture_look, infer from weave or material where possible
UPDATE enriched_products
SET texture_look = CASE
    -- Lustrous fabrics
    WHEN weave IN ('banarasi', 'kanchipuram', 'paithani', 'patola', 'jamdani', 'sateen', 'charmeuse', 'songket', 'nishijin') THEN 'lustrous'
    -- Matte fabrics
    WHEN weave IN ('khadi', 'oxford', 'denim', 'canvas', 'flannel', 'jersey') THEN 'matte'
    -- Woven appearance
    WHEN weave IN ('twill', 'herringbone', 'jacquard', 'kente', 'kilim') THEN 'woven'
    -- Shiny materials
    WHEN material IN ('metal', 'gold', 'silver', 'brass', 'chrome') THEN 'shiny'
    -- Glossy materials
    WHEN material IN ('glass', 'ceramic', 'patent', 'lacquer') THEN 'glossy'
    -- Velvet textures
    WHEN material IN ('velvet', 'velour') THEN 'velvet'
    -- Default to matte for everything else
    ELSE 'matte'
END
WHERE texture_look IS NULL;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Texture feel/look migration complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Added columns:';
    RAISE NOTICE '  - texture_feel (tactile: how it FEELS)';
    RAISE NOTICE '  - texture_look (visual: how it LOOKS)';
    RAISE NOTICE '';
    RAISE NOTICE 'Example queries:';
    RAISE NOTICE '  SELECT * FROM enriched_products WHERE texture_feel = ''silky''';
    RAISE NOTICE '  SELECT * FROM enriched_products WHERE texture_look = ''lustrous''';
    RAISE NOTICE '  SELECT * FROM enriched_products WHERE texture_feel = ''soft'' AND texture_look = ''matte''';
END $$;
