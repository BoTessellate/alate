'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { STYLE_CATEGORIES } from '@/types';

const API_BASE_URL = 'https://backend-tml.vercel.app';

export default function OnboardingPage() {
  const router = useRouter();
  const {
    setStyleCategories,
    setStyleTags,
    completeOnboarding,
    hasCompletedOnboarding,
  } = useUserStore();

  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Redirect if already completed onboarding
  useEffect(() => {
    if (isHydrated && hasCompletedOnboarding()) {
      router.replace('/');
    }
  }, [isHydrated, hasCompletedOnboarding, router]);

  // Fetch popular tags from database
  useEffect(() => {
    const fetchPopularTags = async () => {
      setLoadingTags(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/search?limit=100`);
        if (response.ok) {
          const data = await response.json();
          const products = data.products || [];

          // Count tag frequency
          const tagCounts = new Map<string, number>();
          products.forEach((p: { tags?: string[] }) => {
            (p.tags || []).forEach((tag: string) => {
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
          });

          // Get top 20 tags, filter out very short or generic ones
          const sortedTags = [...tagCounts.entries()]
            .filter(([tag]) => tag.length > 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([tag]) => tag);

          setPopularTags(sortedTags);
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
        // Set some fallback tags
        setPopularTags([
          'modern', 'vintage', 'natural', 'elegant', 'rustic',
          'cozy', 'minimal', 'bold', 'neutral', 'colorful',
        ]);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchPopularTags();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      setStyleCategories(selectedCategories);
      setStep(2);
    } else if (step === 2) {
      setStyleTags(selectedTags);
      completeOnboarding();
      setStep(3);
    }
  };

  const handleFinish = () => {
    router.push('/');
  };

  const handleSkip = () => {
    completeOnboarding();
    router.push('/');
  };

  const canProceed =
    step === 1
      ? selectedCategories.length >= 2
      : step === 2
        ? selectedTags.length >= 3
        : true;

  // Show loading while checking hydration
  if (!isHydrated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: 'var(--primary)' }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Logo */}
      <div className="mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#f6e9cf' }}
        >
          <div
            className="w-8 h-3 rounded-full"
            style={{ backgroundColor: '#4a7c4e' }}
          />
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className="w-2 h-2 rounded-full transition-colors"
            style={{
              backgroundColor: s <= step ? 'var(--primary)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {/* Step 1: Style Categories */}
      {step === 1 && (
        <div className="max-w-2xl w-full text-center">
          <h1
            className="text-3xl font-bold mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            What's your style?
          </h1>
          <p className="mb-8" style={{ color: 'var(--foreground-secondary)' }}>
            Select at least 2 styles that vibe with you. This helps us
            personalize your experience.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {STYLE_CATEGORIES.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className="p-4 rounded-lg border-2 transition-all relative cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? 'rgba(76, 112, 49, 0.15)'
                      : 'var(--surface)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      <Check size={12} style={{ color: 'white' }} />
                    </div>
                  )}
                  <span className="text-2xl mb-2 block">{category.emoji}</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {category.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Popular Tags */}
      {step === 2 && (
        <div className="max-w-2xl w-full text-center">
          <h1
            className="text-3xl font-bold mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            Pick your favorites
          </h1>
          <p className="mb-8" style={{ color: 'var(--foreground-secondary)' }}>
            Select at least 3 tags that catch your eye. These are popular in our
            catalog.
          </p>

          {loadingTags ? (
            <div className="flex justify-center py-12">
              <Loader2
                size={32}
                className="animate-spin"
                style={{ color: 'var(--primary)' }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {popularTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="px-4 py-2 rounded-full border transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--primary)'
                        : 'var(--surface)',
                      borderColor: isSelected
                        ? 'var(--primary)'
                        : 'var(--border)',
                      color: isSelected ? 'white' : 'var(--foreground)',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && (
        <div className="max-w-md w-full text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
          >
            <Sparkles size={40} style={{ color: 'var(--primary)' }} />
          </div>
          <h1
            className="text-3xl font-bold mb-3"
            style={{ color: 'var(--foreground)' }}
          >
            You're all set!
          </h1>
          <p className="mb-8" style={{ color: 'var(--foreground-secondary)' }}>
            Your personalized mood layer is ready. Start discovering products
            that match your style.
          </p>
        </div>
      )}

      {/* Navigation Button */}
      <button
        onClick={step === 3 ? handleFinish : handleNext}
        disabled={!canProceed}
        className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all"
        style={{
          backgroundColor: canProceed ? 'var(--primary)' : 'var(--surface-light)',
          color: canProceed ? 'white' : 'var(--foreground-muted)',
          cursor: canProceed ? 'pointer' : 'not-allowed',
        }}
      >
        {step === 3 ? 'Start Exploring' : 'Continue'}
        <ArrowRight size={18} />
      </button>

      {/* Skip option for steps 1 and 2 */}
      {step < 3 && (
        <button
          onClick={handleSkip}
          className="mt-4 text-sm transition-colors hover:underline"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
