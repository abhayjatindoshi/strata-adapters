import type { CSSProperties } from 'react';
import { useProviders } from '../hooks/use-providers';
import { LoginButton, type LoginButtonProps } from './login-button';
import { LOGIN_FEATURE } from '@strata-adapters/auth/constants';

export type LoginButtonsProps = Omit<LoginButtonProps, 'provider'> & {
  /** Gap between stacked buttons (CSS). Default: 12px. */
  readonly gap?: string | number;
  /** Wrapper className (for consumers using utility CSS). */
  readonly containerClassName?: string;
  /** Wrapper style. */
  readonly containerStyle?: CSSProperties;
};

/** Renders one <LoginButton> per registered login provider, stacked. */
export function LoginButtons({
  gap = 12,
  containerClassName,
  containerStyle,
  ...buttonProps
}: LoginButtonsProps) {
  const providers = useProviders();
  const loginProviders = providers.filter((p) => p.features[LOGIN_FEATURE]);

  return (
    <div
      className={containerClassName}
      style={{ display: 'flex', flexDirection: 'column', gap, ...containerStyle }}
    >
      {loginProviders.map((p) => (
        <LoginButton key={p.name} provider={p.name} {...buttonProps} />
      ))}
    </div>
  );
}
