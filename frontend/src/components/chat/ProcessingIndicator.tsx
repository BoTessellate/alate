'use client';

import { Loader2 } from 'lucide-react';
import type { ProcessingStage } from '@/stores/useChatStore';

export interface ProcessingIndicatorProps {
  stage: ProcessingStage;
  progress?: number;
  statusText?: string;
  compact?: boolean;
}

/**
 * ProcessingIndicator - Shows processing status with optional progress bar
 *
 * Used in expanded panel mode to show detailed processing status.
 * In bubble mode, status is shown in the header instead.
 */
export function ProcessingIndicator({
  stage,
  progress = 0,
  statusText,
  compact = false,
}: ProcessingIndicatorProps) {
  if (stage === 'idle' || stage === 'complete') return null;

  const isError = stage === 'error';

  // Get display text
  const displayText = statusText || getStageText(stage);

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1">
        {!isError && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />}
        <span
          className="text-xs"
          style={{ color: isError ? 'var(--error)' : 'var(--foreground-secondary)' }}
        >
          {displayText}
        </span>
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-lg border"
      style={{
        backgroundColor: isError ? 'var(--error-light, rgba(239, 68, 68, 0.1))' : 'var(--surface-light)',
        borderColor: isError ? 'var(--error)' : 'var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {!isError && (
          <Loader2
            size={16}
            className="animate-spin"
            style={{ color: 'var(--primary)' }}
          />
        )}
        <span
          className="text-sm font-medium"
          style={{ color: isError ? 'var(--error)' : 'var(--foreground)' }}
        >
          {displayText}
        </span>
      </div>

      {/* Progress bar */}
      {!isError && progress > 0 && (
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: 'var(--primary)',
            }}
          />
        </div>
      )}
    </div>
  );
}

function getStageText(stage: ProcessingStage): string {
  switch (stage) {
    case 'uploading':
      return 'Uploading image...';
    case 'removing-bg':
      return 'Removing background...';
    case 'enriching':
      return 'Analyzing product...';
    case 'scraping':
      return 'Fetching product info...';
    case 'searching':
      return 'Searching...';
    case 'error':
      return 'Something went wrong';
    default:
      return 'Processing...';
  }
}

export default ProcessingIndicator;
