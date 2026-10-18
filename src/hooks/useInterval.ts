import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delay: number | null, isPaused: boolean = false) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || isPaused) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay, isPaused]);
}
