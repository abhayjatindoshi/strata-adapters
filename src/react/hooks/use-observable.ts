import { useState, useEffect } from 'react';
import type { Observable } from 'rxjs';

export function useObservable<T>(observable: Observable<T> | undefined, initialValue: T): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    if (!observable) return;
    const sub = observable.subscribe(setValue);
    return () => sub.unsubscribe();
  }, [observable]);

  return value;
}
