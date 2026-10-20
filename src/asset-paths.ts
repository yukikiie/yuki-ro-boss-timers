export function normalizeAssetBase(value: string) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(value)) throw new Error("APP_BASE_PATH must be an absolute directory path ending in /.");
  return value;
}

export function rewritePublicAssetPaths(source: string, base: string) {
  const prefix = normalizeAssetBase(base);
  return source.replace(/(["'`])\/(art|pixel|fonts)\//g, (_match, quote: string, directory: string) => `${quote}${prefix}${directory}/`);
}
