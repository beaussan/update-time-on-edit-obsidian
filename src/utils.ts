import { TAbstractFile, TFile } from 'obsidian';

declare global {
  var __DEV_MODE__: boolean;
}
export function onlyUniqueArray<T>(value: T, index: number, self: T[]) {
  return self.indexOf(value) === index;
}

export function isTFile(value: TAbstractFile): value is TFile {
  return 'stat' in value;
}

export function compileRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern);
  } catch (e) {
    return undefined;
  }
}

// Case-sensitive, tested against the full vault path. Invalid patterns are ignored.
export function matchesAnyRegex(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => compileRegex(pattern)?.test(path) ?? false);
}
