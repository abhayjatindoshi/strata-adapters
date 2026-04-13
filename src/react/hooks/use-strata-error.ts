import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StrataError } from '@strata-adapters/errors/strata-error';
import { useStrata } from './use-strata';

export function useStrataError(): {
  readonly lastError: StrataError | null;
  readonly errors: ReadonlyArray<StrataError>;
  readonly dismiss: (index?: number) => void;
  readonly clearAll: () => void;
} {
  const { errorBus } = useStrata();
  const [errors, setErrors] = useState<StrataError[]>([]);

  useEffect(() => {
    if (!errorBus) return;
    const sub = errorBus.errors$.subscribe((err) => {
      setErrors((prev) => [...prev, err]);
    });
    return () => sub.unsubscribe();
  }, [errorBus]);

  const dismiss = useCallback((index?: number) => {
    setErrors((prev) => {
      if (index !== undefined) return prev.filter((_, i) => i !== index);
      return prev.slice(0, -1);
    });
  }, []);

  const clearAll = useCallback(() => setErrors([]), []);

  const lastError = useMemo(
    () => (errors.length > 0 ? errors[errors.length - 1] : null),
    [errors],
  );

  return { lastError, errors, dismiss, clearAll };
}
