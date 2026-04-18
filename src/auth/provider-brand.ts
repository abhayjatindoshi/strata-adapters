import type { ReactNode } from 'react';

/** Brand-correct visual assets for a login provider. */
export type ProviderBrand = {
  readonly label: string;
  readonly icon: ReactNode;
  readonly themes: {
    readonly light: ButtonStyle;
    readonly dark: ButtonStyle;
  };
};

export type ButtonStyle = {
  readonly background: string;
  readonly color: string;
  readonly border: string;
};

/** Neutral fallback brand when a provider supplies none. */
export const DEFAULT_BRAND_THEMES = {
  light: { background: '#ffffff', color: '#1f1f1f', border: '1px solid #dadce0' },
  dark: { background: '#131314', color: '#e3e3e3', border: '1px solid #8e918f' },
} as const;
