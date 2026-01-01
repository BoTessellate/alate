'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Shirt, Sofa, Loader2, Download, RefreshCw } from 'lucide-react';
import type { Product } from '@/types';
import { Button, IconButton } from '@/components/ui';

interface VirtualTryOnModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

type TryOnType = 'clothing' | 'furniture';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-tml.vercel.app';

export default function VirtualTryOnModal({
  product,
  isOpen,
  onClose,
}: VirtualTryOnModalProps) {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [tryOnType, setTryOnType] = useState<TryOnType>('clothing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setBaseImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setBaseImage(event.target?.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setBaseImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setBaseImage(event.target?.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleGenerate = async () => {
    if (!baseImage || !product.image_url) {
      setError('Please upload a base image first');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const base64Data = baseImage.split(',')[1];

      const response = await fetch(`${BACKEND_URL}/api/ai?action=tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImage: { base64: base64Data },
          productImages: [{ url: product.image_url }],
          type: tryOnType,
          preserveBackground: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate try-on');
      }

      if (data._demo) {
        setIsDemoMode(true);
        setError('Demo mode active. Configure OpenAI API key for real virtual try-on.');
      } else if (data.result?.imageBase64) {
        setResult(`data:image/png;base64,${data.result.imageBase64}`);
      } else if (data.result?.imageUrl) {
        setResult(data.result.imageUrl);
      } else {
        throw new Error('No image returned from API');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate try-on');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result;
    link.download = `tryon-${product.product_name.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setBaseImage(null);
    setBaseImageFile(null);
    setResult(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="virtual-tryon-modal-title"
        className="w-full max-w-2xl mx-4 rounded-xl shadow-2xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2
              id="virtual-tryon-modal-title"
              className="font-semibold text-lg"
              style={{ color: 'var(--foreground)' }}
            >
              Virtual Try-On
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              See how {product.product_name} looks on you or in your space
            </p>
          </div>
          <IconButton icon={X} aria-label="Close modal" onClick={onClose} />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Type Selection */}
          <div className="flex gap-3 mb-6">
            {[
              { type: 'clothing' as TryOnType, icon: Shirt, label: 'Clothing' },
              { type: 'furniture' as TryOnType, icon: Sofa, label: 'Furniture' },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setTryOnType(type)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all min-h-11 ${
                  tryOnType === type ? 'border-2' : ''
                }`}
                style={{
                  borderColor: tryOnType === type ? 'var(--primary)' : 'var(--border)',
                  backgroundColor: tryOnType === type ? 'rgba(76, 112, 49, 0.1)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-2 gap-6">
            {/* Base Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {tryOnType === 'clothing' ? 'Your Photo' : 'Room Photo'}
              </label>
              <div
                className="relative aspect-square rounded-lg border-2 border-dashed overflow-hidden transition-colors"
                style={{ borderColor: 'var(--border)' }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {baseImage ? (
                  <>
                    <img src={baseImage} alt="Base" className="w-full h-full object-cover" />
                    <button
                      onClick={handleReset}
                      aria-label="Remove uploaded image"
                      className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                    >
                      <X size={16} style={{ color: 'white' }} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-opacity-5 transition-colors"
                    style={{ backgroundColor: 'var(--background-secondary)' }}
                  >
                    <Upload size={32} style={{ color: 'var(--foreground-muted)' }} aria-hidden="true" />
                    <span className="text-sm text-center px-4" style={{ color: 'var(--foreground-muted)' }}>
                      {tryOnType === 'clothing' ? 'Upload a photo of yourself' : 'Upload a photo of your room'}
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Result / Product Preview */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                {result ? 'Result' : 'Product'}
              </label>
              <div
                className="relative aspect-square rounded-lg border overflow-hidden"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--background-secondary)',
                }}
              >
                {result ? (
                  <>
                    <img src={result} alt="Try-on result" className="w-full h-full object-cover" />
                    <button
                      onClick={handleDownload}
                      aria-label="Download result image"
                      className="absolute bottom-2 right-2 w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                      title="Download"
                    >
                      <Download size={18} style={{ color: 'white' }} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="w-full h-full object-contain p-4"
                    />
                  )
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={{
                backgroundColor: isDemoMode ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: isDemoMode ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)',
              }}
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            {result && (
              <Button variant="outline" icon={RefreshCw} onClick={handleReset}>
                Try Again
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={handleGenerate}
              disabled={!baseImage || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" aria-hidden="true" />
                  Generating...
                </>
              ) : (
                <>
                  <Shirt size={18} className="mr-2" aria-hidden="true" />
                  Generate Try-On
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
