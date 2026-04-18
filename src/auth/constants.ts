/** Reserved feature name for the primary login grant on a provider. */
export const LOGIN_FEATURE = 'login' as const;

export type LoginFeature = typeof LOGIN_FEATURE;
