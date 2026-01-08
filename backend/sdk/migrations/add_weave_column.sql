-- ============================================================================
-- ADD WEAVE COLUMN TO ENRICHED_PRODUCTS
-- ============================================================================
-- Adds a new 'weave' column to store fabric construction type separately from texture
-- - texture = surface finish (smooth, soft, matte, glossy, etc.)
-- - weave = fabric construction (oxford, twill, sateen, jersey, etc.)

-- Add weave column
ALTER TABLE enriched_products
ADD COLUMN IF NOT EXISTS weave TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN enriched_products.weave IS 'Fabric construction type (oxford, twill, sateen, jersey, flannel, etc.). NULL for non-textile items.';

-- Create index for weave queries (users may search for "oxford shirts")
CREATE INDEX IF NOT EXISTS idx_enriched_products_weave ON enriched_products(weave);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Weave column migration complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Added:';
    RAISE NOTICE '  - weave column to enriched_products';
    RAISE NOTICE '  - Index on weave column for search queries';
    RAISE NOTICE '';
    RAISE NOTICE 'Now you can query: SELECT * FROM enriched_products WHERE weave = ''oxford''';
END $$;
