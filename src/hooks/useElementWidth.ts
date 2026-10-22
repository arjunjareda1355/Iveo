import { useState, useEffect, useRef } from 'react';

/**
 * Hook to measure container element width in real pixels using ResizeObserver.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial measure
    setWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const cb = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          if (cb.inlineSize > 0) {
            setWidth(cb.inlineSize);
          }
        } else if (entry.contentRect && entry.contentRect.width > 0) {
          setWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width] as const;
}
