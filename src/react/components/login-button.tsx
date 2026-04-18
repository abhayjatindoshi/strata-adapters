import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { GoogleLoginButton } from '@strata-adapters/providers/google/google-login-button';

export type LoginButtonTheme = 'light' | 'dark';
export type LoginButtonVariant = 'pill' | 'icon';

/**
 * Props shared by `<LoginButton>` and every provider-branded button
 * (e.g. `<GoogleLoginButton>`). Brand buttons own their own visual
 * treatment — there is no generic fallback style.
 */
export type LoginButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Visual theme. Default: light. */
  readonly theme?: LoginButtonTheme;
  /** Visual variant. Default: pill. */
  readonly variant?: LoginButtonVariant;
  /** Custom button content. Overrides the default brand label. */
  readonly children?: ReactNode;
};

export type LoginButtonProps = LoginButtonBaseProps & {
  /** Provider to log in with. Must be a provider this package ships a branded button for. */
  readonly provider: 'google';
};

/**
 * UI-only dispatcher that renders the correct brand-conformant button
 * for the requested provider. All other props (`theme`, `variant`,
 * `disabled`, `onClick`, `children`, …) pass straight through.
 *
 * ```tsx
 * <LoginButton provider="google" />
 * <LoginButton provider="google" theme="dark" variant="icon" />
 * ```
 *
 * For unknown providers this throws at render — add a new brand component
 * and extend the `provider` union instead of degrading at runtime.
 */
export function LoginButton({ provider, ...rest }: LoginButtonProps) {
  switch (provider) {
    case 'google':
      return <GoogleLoginButton {...rest} />;
    default: {
      const exhaustive: never = provider;
      throw new Error(`<LoginButton> has no branded component for provider: ${String(exhaustive)}`);
    }
  }
}

