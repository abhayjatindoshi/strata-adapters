import type { CSSProperties } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useProviders } from '../hooks/use-providers';
import { resolveBrand, type LoginButtonBaseProps } from './provider-brand';
import { LOGIN_FEATURE } from '@strata-adapters/auth/constants';

export type LoginButtonProps = LoginButtonBaseProps & {
  /** Provider name to log in with. Defaults to the first registered login provider. */
  readonly provider?: string;
};

const DEFAULT_STYLE_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  height: '40px',
  padding: '0 16px',
  borderRadius: '4px',
  fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
  fontWeight: 500,
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
};

/**
 * Brand-correct login button. One-liner for the common case:
 *
 * ```tsx
 * <LoginButton />              // single-provider app
 * <LoginButton provider="google" theme="dark" />
 * ```
 *
 * Consumers who want their own styles can pass `unstyled` + `className`:
 * ```tsx
 * <LoginButton unstyled className="my-btn">Sign in</LoginButton>
 * ```
 */
export function LoginButton({
  provider,
  theme = 'light',
  style,
  children,
  disabled,
  unstyled = false,
  ...rest
}: LoginButtonProps) {
  const { state, login } = useAuth();
  const providers = useProviders();

  const target = provider ?? providers.find((p) => p.features[LOGIN_FEATURE])?.name;
  const providerModule = target ? providers.find((p) => p.name === target) : undefined;
  const brand = resolveBrand(providerModule);
  const busy = state.status === 'loading' || !target;

  const themeStyle = brand.themes[theme];
  const mergedStyle: CSSProperties = unstyled
    ? (style ?? {})
    : {
        ...DEFAULT_STYLE_BASE,
        background: themeStyle.background,
        color: themeStyle.color,
        border: themeStyle.border,
        opacity: disabled || busy ? 0.6 : 1,
        ...style,
      };

  return (
    <button
      type="button"
      disabled={disabled || busy}
      style={mergedStyle}
      onClick={() => target && login(target)}
      {...rest}
    >
      {children ?? (
        <>
          {brand.icon}
          <span>{brand.label}</span>
        </>
      )}
    </button>
  );
}
