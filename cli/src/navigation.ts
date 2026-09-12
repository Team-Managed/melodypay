export function isBackNavigation(value: unknown): value is symbol {
  return typeof value === "symbol";
}
