import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { ProviderBrand } from '@strata-adapters/auth/provider-brand';
import { DEFAULT_BRAND_THEMES } from '@strata-adapters/auth/provider-brand';
import type { ProviderModule } from '@strata-adapters/auth/provider-module';

export type LoginButtonTheme = 'light' | 'dark';

export type LoginButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> & {
  /** Visual theme. Default: light. */
  readonly theme?: LoginButtonTheme;
  /** Custom content. Overrides the default brand icon + label. */
  readonly children?: ReactNode;
  /** Use consumer styles instead of built-in brand chrome. */
  readonly unstyled?: boolean;
};

/** Resolve a brand for a provider — falls back to a neutral default. */
export function resolveBrand(provider: ProviderModule | undefined): ProviderBrand {
  if (provider?.brand) return provider.brand;
  const label = provider ? `Continue with ${provider.label}` : 'Sign in';
  return { label, icon: null, themes: DEFAULT_BRAND_THEMES };
}
