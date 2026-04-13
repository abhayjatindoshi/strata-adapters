import { useContext } from 'react';
import { StrataContext, type StrataContextValue } from '../context';

export function useStrata(): StrataContextValue {
  return useContext(StrataContext);
}
