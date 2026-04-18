import { useEffect } from 'react';
import type { LoginButtonBaseProps } from '@strata-adapters/react/components/login-button';

/**
 * Google brand-conformant sign-in button. Renders the exact markup + styles
 * from Google's GSI branding guidelines (hover / focus / active state layers,
 * multi-color G logo). Four variants: pill/icon × light/dark.
 *
 * Pure UI — wire up `onClick` yourself (typically `() => login('google')`).
 *
 * ```tsx
 * <GoogleLoginButton onClick={() => login('google')} />
 * <GoogleLoginButton theme="dark" variant="icon" onClick={handler} />
 * ```
 */
export type GoogleLoginButtonProps = LoginButtonBaseProps;

export function GoogleLoginButton({
  variant = 'pill',
  theme = 'light',
  className,
  children,
  ...rest
}: GoogleLoginButtonProps) {
  useGsiStyles();
  const label = typeof children === 'string' ? children : 'Sign in with Google';
  const isIcon = variant === 'icon';

  return (
    <button
      type="button"
      className={['gsi-material-button', className].filter(Boolean).join(' ')}
      data-gsi-variant={variant}
      data-gsi-theme={theme}
      aria-label={isIcon ? label : undefined}
      {...rest}
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width="100%"
            height="100%"
            style={{ display: 'block' }}
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </div>
        {!isIcon && <span className="gsi-material-button-contents">{label}</span>}
      </div>
    </button>
  );
}

const STYLE_ELEMENT_ID = 'strata-gsi-material-button-styles';

/**
 * One stylesheet covering every variant × theme combination.
 * Variants are selected via `data-gsi-shape` / `data-gsi-theme` on the button.
 */
const GSI_CSS = `
.gsi-material-button {
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  -webkit-appearance: none;
  background-image: none;
  -webkit-border-radius: 20px;
  border-radius: 20px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  cursor: pointer;
  font-family: 'Roboto', arial, sans-serif;
  font-size: 14px;
  height: 40px;
  letter-spacing: 0.25px;
  outline: none;
  overflow: hidden;
  position: relative;
  text-align: center;
  -webkit-transition: background-color .218s, border-color .218s, box-shadow .218s;
  transition: background-color .218s, border-color .218s, box-shadow .218s;
  vertical-align: middle;
  white-space: nowrap;
  max-width: 400px;
  min-width: min-content;
  border: 1px solid #747775;
}

/* Variant: pill (default) */
.gsi-material-button[data-gsi-variant="pill"] { padding: 0 12px; width: auto; }

/* Variant: icon-only */
.gsi-material-button[data-gsi-variant="icon"] { padding: 0; width: 40px; }

/* Theme: light (default) */
.gsi-material-button[data-gsi-theme="light"] { background-color: #ffffff; color: #1f1f1f; border-color: #747775; }
.gsi-material-button[data-gsi-theme="light"]:disabled { background-color: #ffffff61; border-color: #1f1f1f1f; }
.gsi-material-button[data-gsi-theme="light"]:not(:disabled):active .gsi-material-button-state,
.gsi-material-button[data-gsi-theme="light"]:not(:disabled):focus .gsi-material-button-state { background-color: #303030; opacity: 12%; }
.gsi-material-button[data-gsi-theme="light"]:not(:disabled):hover .gsi-material-button-state { background-color: #303030; opacity: 8%; }

/* Theme: dark */
.gsi-material-button[data-gsi-theme="dark"] { background-color: #131314; color: #e3e3e3; border-color: #8e918f; }
.gsi-material-button[data-gsi-theme="dark"]:disabled { background-color: #13131461; border-color: #8e918f1f; }
.gsi-material-button[data-gsi-theme="dark"]:disabled .gsi-material-button-state { background-color: #e3e3e31f; }
.gsi-material-button[data-gsi-theme="dark"]:not(:disabled):active .gsi-material-button-state,
.gsi-material-button[data-gsi-theme="dark"]:not(:disabled):focus .gsi-material-button-state { background-color: white; opacity: 12%; }
.gsi-material-button[data-gsi-theme="dark"]:not(:disabled):hover .gsi-material-button-state { background-color: white; opacity: 8%; }

.gsi-material-button .gsi-material-button-icon {
  box-sizing: border-box;
  height: 20px;
  min-width: 20px;
  width: 20px;
  margin-right: 10px;
}

/* Icon variant: logo is the whole button, so no right margin, and pad inside the 40px box. */
.gsi-material-button[data-gsi-variant="icon"] .gsi-material-button-icon {
  box-sizing: content-box;
  margin: 0;
  padding: 9px;
}

.gsi-material-button .gsi-material-button-content-wrapper {
  -webkit-align-items: center;
  align-items: center;
  display: flex;
  -webkit-flex-direction: row;
  flex-direction: row;
  -webkit-flex-wrap: nowrap;
  flex-wrap: nowrap;
  height: 100%;
  justify-content: space-between;
  position: relative;
  width: 100%;
}

.gsi-material-button .gsi-material-button-contents {
  -webkit-flex-grow: 1;
  flex-grow: 1;
  font-family: 'Roboto', arial, sans-serif;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
}

.gsi-material-button .gsi-material-button-state {
  -webkit-transition: opacity .218s;
  transition: opacity .218s;
  bottom: 0;
  left: 0;
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.gsi-material-button:disabled { cursor: default; }
.gsi-material-button:disabled .gsi-material-button-contents { opacity: 38%; }
.gsi-material-button:disabled .gsi-material-button-icon { opacity: 38%; }

.gsi-material-button:not(:disabled):hover {
  -webkit-box-shadow: 0 1px 2px 0 rgba(60, 64, 67, .30), 0 1px 3px 1px rgba(60, 64, 67, .15);
  box-shadow: 0 1px 2px 0 rgba(60, 64, 67, .30), 0 1px 3px 1px rgba(60, 64, 67, .15);
}
`;

/** Inject the GSI stylesheet once per document. */
function useGsiStyles(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = GSI_CSS;
    document.head.appendChild(style);
  }, []);
}
