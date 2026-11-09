import { matchesAnyRegex } from './utils';

const INDEX = ['(^|/)index\\.md$'];

describe('matchesAnyRegex', () => {
  it('excludes index.md in any folder but not other notes', () => {
    expect(matchesAnyRegex('index.md', INDEX)).toBe(true);
    expect(matchesAnyRegex('a/b/index.md', INDEX)).toBe(true);
    expect(matchesAnyRegex('a/b/my-index.md', INDEX)).toBe(false);
    expect(matchesAnyRegex('a/index.md.bak', INDEX)).toBe(false);
    expect(matchesAnyRegex('a/Index.md', INDEX)).toBe(false);
  });

  it('ignores invalid patterns without throwing', () => {
    expect(matchesAnyRegex('a/index.md', ['(unclosed'])).toBe(false);
    expect(matchesAnyRegex('a/index.md', ['(unclosed', ...INDEX])).toBe(true);
  });

  it('changes nothing with an empty list', () => {
    expect(matchesAnyRegex('a/index.md', [])).toBe(false);
  });
});
