/**
 * React Performance Optimization Utilities
 * Memoization, debouncing, throttling for React components
 */

import { memo, useMemo, useCallback, useRef, useEffect, DependencyList, ReactNode } from 'react';
import type { FC, ComponentType } from 'react';

/**
 * Deep equality check for props
 */
export const isPropsEqual = (prevProps: any, nextProps: any): boolean => {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);

  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  return prevKeys.every(key => {
    const prevValue = prevProps[key];
    const nextValue = nextProps[key];

    if (typeof prevValue === 'function' && typeof nextValue === 'function') {
      return prevValue.toString() === nextValue.toString();
    }

    if (typeof prevValue === 'object' && typeof nextValue === 'object') {
      return JSON.stringify(prevValue) === JSON.stringify(nextValue);
    }

    return prevValue === nextValue;
  });
};

/**
 * Memoize component with deep prop comparison
 */
export const memoDeep = <P extends object>(
  Component: FC<P>,
  displayName?: string
): FC<P> => {
  const MemoizedComponent = memo(Component, isPropsEqual);
  MemoizedComponent.displayName = displayName || `Memoized${Component.displayName || Component.name}`;
  return MemoizedComponent;
};

/**
 * Debounce hook
 */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = memo(value as any) as [T, (val: T) => void];

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay, setDebouncedValue]);

  return debouncedValue;
};

/**
 * Throttle hook
 */
export const useThrottle = <T,>(value: T, delay: number): T => {
  const [throttledValue, setThrottledValue] = memo(value as any) as [T, (val: T) => void];
  const lastRanRef = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRanRef.current >= delay) {
        setThrottledValue(value);
        lastRanRef.current = Date.now();
      }
    }, delay - (Date.now() - lastRanRef.current));

    return () => clearTimeout(handler);
  }, [value, delay, setThrottledValue]);

  return throttledValue;
};

/**
 * Memoize expensive computation
 */
export const useMemoDeep = <T,>(factory: () => T, deps: DependencyList): T => {
  return useMemo(factory, deps);
};

/**
 * Stable callback reference
 */
export const useCallbackDeep = <T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList
): T => {
  return useCallback(callback, deps) as T;
};

/**
 * Previous value hook
 */
export const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
};

/**
 * Async value hook
 */
export const useAsync = <T,>(
  asyncFunction: () => Promise<T>,
  immediate = true,
  deps: DependencyList = []
) => {
  const [status, setStatus] = memo('idle' as any) as [string, (val: string) => void];
  const [value, setValue] = memo(null as any) as [T | null, (val: T | null) => void];
  const [error, setError] = memo(null as any) as [Error | null, (val: Error | null) => void];

  const execute = useCallbackDeep(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('error');
      throw err;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, deps);

  return { execute, status, value, error };
};

/**
 * Intersection Observer hook
 */
export const useIntersectionObserver = (
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
) => {
  const [isVisible, setIsVisible] = memo(false as any) as [boolean, (val: boolean) => void];

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
};

/**
 * Request animation frame hook
 */
export const useRequestAnimationFrame = (callback: FrameRequestCallback) => {
  const frameIdRef = useRef<number>();

  useEffect(() => {
    frameIdRef.current = requestAnimationFrame(callback);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [callback]);
};

/**
 * Observer for DOM size changes
 */
export const useResizeObserver = (ref: React.RefObject<HTMLElement>) => {
  const [size, setSize] = memo({ width: 0, height: 0 } as any) as [
    { width: number; height: number },
    (val: { width: number; height: number }) => void
  ];

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref]);

  return size;
};

export default {
  isPropsEqual,
  memoDeep,
  useDebounce,
  useThrottle,
  useMemoDeep,
  useCallbackDeep,
  usePrevious,
  useAsync,
  useIntersectionObserver,
  useRequestAnimationFrame,
  useResizeObserver,
};

