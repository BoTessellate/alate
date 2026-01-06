'use client';

import { useUploadStore, SimilarProduct } from '@/stores/useUploadStore';

interface SimilarProductMatchProps {
  /** URL of the uploaded image being compared */
  uploadedImageUrl: string;
  /** Callback when user chooses to use existing product metadata */
  onUseExisting: (product: SimilarProduct) => void;
  /** Callback when user chooses to continue as new product */
  onAddAsNew: () => void;
}

/**
 * SimilarProductMatch - Side-by-side comparison component
 *
 * Shows when a similar product is found in user's closet during upload.
 * Allows user to either:
 * - Use existing metadata (copy from matched product)
 * - Add as new (continue with fresh AI enrichment)
 */
export function SimilarProductMatch({
  uploadedImageUrl,
  onUseExisting,
  onAddAsNew,
}: SimilarProductMatchProps) {
  const { similarProducts, showSimilarityUI, selectSimilarProduct, selectedSimilarProduct } =
    useUploadStore();

  if (!showSimilarityUI || similarProducts.length === 0) {
    return null;
  }

  const topMatch = similarProducts[0];
  const matchPercentage = Math.round(topMatch.score * 100);

  // Determine match quality message
  const getMatchMessage = (score: number) => {
    if (score >= 0.9) return 'Near duplicate found!';
    if (score >= 0.8) return 'Very similar item found';
    return 'Similar item in your closet';
  };

  return (
    <div className="bg-surface-secondary rounded-xl p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {getMatchMessage(topMatch.score)}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {matchPercentage}% match with existing item
          </p>
        </div>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            topMatch.score >= 0.9
              ? 'bg-warning/20 text-warning'
              : topMatch.score >= 0.8
              ? 'bg-primary/20 text-primary'
              : 'bg-muted/20 text-muted'
          }`}
        >
          {matchPercentage}%
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="flex gap-3 mb-4">
        {/* New upload */}
        <div className="flex-1">
          <div className="aspect-square rounded-lg overflow-hidden bg-surface border border-border mb-2">
            <img
              src={uploadedImageUrl}
              alt="Your upload"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-xs text-muted text-center">Your upload</p>
        </div>

        {/* VS divider */}
        <div className="flex items-center">
          <span className="text-xs text-muted font-medium">vs</span>
        </div>

        {/* Existing product */}
        <div className="flex-1">
          <div className="aspect-square rounded-lg overflow-hidden bg-surface border border-border mb-2">
            {topMatch.imageUrl ? (
              <img
                src={topMatch.imageUrl}
                alt={topMatch.productName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
            )}
          </div>
          <p className="text-xs text-muted text-center truncate">{topMatch.productName}</p>
        </div>
      </div>

      {/* Existing product details */}
      <div className="bg-surface rounded-lg p-3 mb-4 border border-border">
        <p className="text-sm font-medium text-foreground mb-1">{topMatch.productName}</p>
        {topMatch.brand && (
          <p className="text-xs text-muted mb-2">by {topMatch.brand}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {topMatch.category && (
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              {topMatch.category}
            </span>
          )}
          {topMatch.colors?.slice(0, 3).map((color) => (
            <span
              key={color}
              className="text-xs px-2 py-0.5 bg-muted/10 text-muted rounded-full"
            >
              {color}
            </span>
          ))}
          {topMatch.tags?.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-muted/10 text-muted rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            selectSimilarProduct(topMatch);
            onUseExisting(topMatch);
          }}
          className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Use Existing
        </button>
        <button
          onClick={onAddAsNew}
          className="flex-1 px-4 py-2.5 bg-surface border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface-secondary transition-colors"
        >
          Add as New
        </button>
      </div>

      {/* Show more matches if available */}
      {similarProducts.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted mb-2">
            {similarProducts.length - 1} more similar item{similarProducts.length > 2 ? 's' : ''} found
          </p>
          <div className="flex gap-2 overflow-x-auto">
            {similarProducts.slice(1, 4).map((product) => (
              <button
                key={product.productId}
                onClick={() => {
                  selectSimilarProduct(product);
                  onUseExisting(product);
                }}
                className="flex-shrink-0 w-16 group"
              >
                <div className="aspect-square rounded-md overflow-hidden bg-surface border border-border mb-1 group-hover:border-primary transition-colors">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted truncate">{Math.round(product.score * 100)}%</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
