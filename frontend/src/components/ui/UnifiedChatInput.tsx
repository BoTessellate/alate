'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { Send, Loader2, Camera, Link2, X } from 'lucide-react';
import { analyzeInput, looksLikeUrl, type InputAnalysis } from '@/utils/inputTypeDetector';

export interface ChatInputPayload {
  type: 'text' | 'image' | 'url';
  content: string;
  file?: File;
  analysis: InputAnalysis;
}

export interface UnifiedChatInputProps {
  /** Callback when message is submitted */
  onSubmit: (payload: ChatInputPayload) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether processing is in progress */
  isLoading?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Attached image file */
  attachedImage?: File | null;
  /** Preview URL for attached image */
  attachedImagePreview?: string | null;
  /** Callback to set attached image */
  onImageAttach?: (file: File, previewUrl: string) => void;
  /** Callback to clear attached image */
  onClearAttachment?: () => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * UnifiedChatInput - iMessage-style input with attachment icons
 *
 * Features:
 * - Camera icon for image upload
 * - Link icon (highlights when URL detected)
 * - Auto-expanding textarea
 * - Image preview with remove button
 * - Submit on Enter (Shift+Enter for new line)
 */
export function UnifiedChatInput({
  onSubmit,
  placeholder = 'Ask anything...',
  disabled = false,
  isLoading = false,
  autoFocus = false,
  attachedImage,
  attachedImagePreview,
  onImageAttach,
  onClearAttachment,
  'data-testid': testId,
}: UnifiedChatInputProps) {
  const [value, setValue] = useState('');
  const [isUrlDetected, setIsUrlDetected] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const maxHeight = 80; // ~3 lines max in compact mode
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  // Detect URL in input
  useEffect(() => {
    setIsUrlDetected(looksLikeUrl(value));
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && !attachedImage) || disabled || isLoading) return;

    const analysis = analyzeInput(trimmed, !!attachedImage);

    const payload: ChatInputPayload = {
      type: analysis.type,
      content: analysis.type === 'url' && analysis.cleanUrl ? analysis.cleanUrl : trimmed,
      file: attachedImage || undefined,
      analysis,
    };

    onSubmit(payload);
    setValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, attachedImage, disabled, isLoading, onSubmit]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageAttach) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    onImageAttach(file, previewUrl);

    // Reset file input
    e.target.value = '';
  };

  const canSubmit = (value.trim().length > 0 || !!attachedImage) && !disabled && !isLoading;

  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--border)' }}
      data-testid={testId}
    >
      {/* Image preview row - only shown when image attached */}
      {attachedImage && attachedImagePreview && (
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="relative">
            <img
              src={attachedImagePreview}
              alt="Attached"
              className="w-12 h-12 object-cover rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
            />
            <button
              onClick={onClearAttachment}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--foreground)',
                color: 'var(--background)',
              }}
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {attachedImage.name}
          </span>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-1.5 p-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Camera button */}
        <button
          onClick={handleCameraClick}
          disabled={disabled || isLoading}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0"
          style={{
            color: attachedImage ? 'white' : 'var(--foreground-secondary)',
            backgroundColor: attachedImage ? 'var(--primary)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!attachedImage) {
              e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              e.currentTarget.style.color = 'var(--foreground)';
            }
          }}
          onMouseLeave={(e) => {
            if (!attachedImage) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--foreground-secondary)';
            }
          }}
          aria-label="Attach image"
          title="Attach image"
        >
          <Camera size={18} />
        </button>

        {/* Link indicator */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            color: isUrlDetected ? 'white' : 'var(--foreground-secondary)',
            backgroundColor: isUrlDetected ? 'var(--primary)' : 'transparent',
          }}
          title={isUrlDetected ? 'URL detected' : 'Paste a product URL'}
        >
          <Link2 size={18} />
        </div>

        {/* Text input */}
        <div
          className="flex-1 flex items-center rounded-xl px-3 min-h-[32px]"
          style={{ backgroundColor: 'var(--surface-light)' }}
          data-testid={testId ? `${testId}-input-container` : undefined}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachedImage ? 'Add a description...' : placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className="w-full bg-transparent resize-none text-sm outline-none focus:outline-none leading-normal py-1"
            style={{
              color: 'var(--foreground)',
              minHeight: '24px',
              maxHeight: '80px',
            }}
            data-testid={testId ? `${testId}-textarea` : undefined}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0"
          style={{
            backgroundColor: canSubmit ? 'var(--primary-dark)' : 'var(--surface-light)',
            color: canSubmit ? 'white' : 'var(--foreground-muted)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (canSubmit) {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (canSubmit) {
              e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
            }
          }}
          aria-label="Send"
          data-testid={testId ? `${testId}-send` : undefined}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}

export default UnifiedChatInput;
