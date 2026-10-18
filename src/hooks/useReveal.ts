import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

interface UseRevealOptions {
  threshold?: number;
  rootMargin?: string;
  staggerIndex?: number;
  instant?: boolean;
}

export function useReveal({
  threshold = 0.15,
  rootMargin = '0px 0px -10% 0px',
  staggerIndex = 0,
  instant = false,
}: UseRevealOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [isVisible, setIsVisible] = useState<boolean>(instant || prefersReducedMotion);

  useEffect(() => {
    if (instant || prefersReducedMotion || isVisible) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, instant, prefersReducedMotion, isVisible]);

  const delayMs = Math.min(staggerIndex, 5) * 60;

  const style: React.CSSProperties = prefersReducedMotion
    ? {}
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
        transitionProperty: 'opacity, transform',
        transitionDuration: '600ms',
        transitionTimingFunction: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        transitionDelay: `${delayMs}ms`,
      };

  return { ref, isVisible, style };
}
