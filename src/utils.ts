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
