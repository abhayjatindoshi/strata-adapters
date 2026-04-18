/** Per-feature OAuth grant configuration. Login is one feature among many. */
export type FeatureSpec = {
  readonly scopes: readonly string[];
};

export type FeatureMap = Readonly<Record<string, FeatureSpec>>;
