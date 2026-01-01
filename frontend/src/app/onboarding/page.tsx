'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';
import { STYLE_CATEGORIES } from '@/types';
import { Button, PageHeader } from '@/components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

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

  // Fallback tags when API is unavailable
  const FALLBACK_TAGS = [
    'modern', 'vintage', 'natural', 'elegant', 'rustic',
    'cozy', 'minimal', 'bold', 'neutral', 'colorful',
    'scandinavian', 'bohemian', 'industrial', 'coastal', 'farmhouse',
  ];

  // Fetch popular tags from database
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const fetchPopularTags = async () => {
      setLoadingTags(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/search?limit=100`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

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

        // Use fetched tags or fallback if none found
        setPopularTags(sortedTags.length > 0 ? sortedTags : FALLBACK_TAGS);
      } catch (error) {
        // Silently use fallback tags - network errors are expected when backend is down
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('[Onboarding] Using fallback tags - API unavailable');
        }
        setPopularTags(FALLBACK_TAGS);
      } finally {
        clearTimeout(timeoutId);
        setLoadingTags(false);
      }
    };

    fetchPopularTags();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
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
      className="min-h-screen overflow-y-auto"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Fixed height container with scroll, explicit padding ensures skip button visibility */}
      <div className="min-h-screen flex flex-col items-center justify-center px-8 py-16 pb-32">
      {/* Logo */}
      <div className="mb-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#222222' }}
        >
          <div
            className="w-8 h-3 rounded-full agent-pill-blink"
            style={{ backgroundColor: '#546c22' }}
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
        <div className="max-w-2xl w-full">
          <PageHeader
            variant="centered"
            size="md"
            maxWidth="none"
            title="Hi I'm Moody, tell me a little about your style"
            subtitle="Select at least 2 styles that vibe with you."
            className="px-0 pt-0 pb-0 mb-8"
          />

          <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xl mx-auto">
            {STYLE_CATEGORIES.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--primary)'
                      : 'var(--surface)',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                    color: isSelected ? 'white' : 'var(--foreground)',
                  }}
                >
                  <span className="text-base">{category.emoji}</span>
                  <span className="text-sm font-medium">
                    {category.label}
                  </span>
                  {isSelected && (
                    <Check size={14} className="ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Popular Tags */}
      {step === 2 && (
        <div className="max-w-2xl w-full">
          <PageHeader
            variant="centered"
            size="md"
            maxWidth="none"
            title="Pick your favorites"
            subtitle="Select at least 3 tags that catch your eye. These are popular in our catalog."
            className="px-0 pt-0 pb-0 mb-8"
          />

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
                    className="px-4 py-2 rounded-full border transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
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
          <PageHeader
            variant="centered"
            size="md"
            maxWidth="none"
            title="You're all set!"
            subtitle="Your personalized mood layer is ready. Start discovering products that match your style."
            className="px-0 pt-0 pb-0"
          />
        </div>
      )}

      {/* Navigation Button */}
      <Button
        onClick={step === 3 ? handleFinish : handleNext}
        disabled={!canProceed}
        variant="primary"
        size="lg"
        iconRight={ArrowRight}
      >
        {step === 3 ? 'Start Exploring' : 'Continue'}
      </Button>

      {/* Skip option for steps 1 and 2 - always visible with pb-32 on container */}
      {step < 3 && (
        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="mt-8"
        >
          Skip for now
        </Button>
      )}
      </div>
    </div>
  );
}
