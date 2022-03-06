import { updateKeyInFrontMatter } from './updateKeyInFrontMatter';

describe('updateKeyInFrontMatter', () => {
  it('should not touch existing front matter keys when updating', () => {
    const content = `---
some: parameter
toto: oldValue
---

# Hello
 `;

    const result = updateKeyInFrontMatter(content, 'toto', 'tata');
    expect(result).toEqual(`---
some: parameter
toto: tata
---

# Hello
 `);
  });

  it('should update the key in the front matter', () => {
    const content = `---
some: parameter
---

# Hello
`;

    const result = updateKeyInFrontMatter(content, 'some', 'value');

    expect(result).toEqual(`---
some: value
---

# Hello
`);
  });

  it('should update the key in the front matter while not editing everything else', () => {
    const content = `---
some: parameter
tags: test/🟩
some:
 some:
   some: 5
   some: 6
 some:
   some: 'Important!'
---

# Hello
`;

    const result = updateKeyInFrontMatter(content, 'some', 'value');

    expect(result).toEqual(`---
some: value
tags: test/🟩
some:
 some:
   some: 5
   some: 6
 some:
   some: 'Important!'
---

# Hello
`);
  });

  it('should work when there is no front matter', () => {
    const content = '# Hello';

    const result = updateKeyInFrontMatter(content, 'myKey', 'myValue');

    expect(result).toEqual(`---
myKey: myValue
---
# Hello`);
  });

  it('should work when there is no front matter but --- blocks', () => {
    const content = `# Hello
---
some: stuff here
---`;

    const result = updateKeyInFrontMatter(content, 'myKey', 'myValue');

    expect(result).toEqual(`---
myKey: myValue
---
# Hello
---
some: stuff here
---`);
  });

  it('should allow to add a non existing key', () => {
    const content = `---
old: data
---

# Hello
`;

    const result = updateKeyInFrontMatter(content, 'some', 'value');

    expect(result).toEqual(`---
old: data
some: value
---

# Hello
`);
  });
  it('should handle multiple --- blocks in the document and only taking care of the first one', () => {
    const content = `---
old: data
---

# Hello

---
second: block
---
`;

    const result = updateKeyInFrontMatter(content, 'some', 'value');

    expect(result).toEqual(`---
old: data
some: value
---

# Hello

---
second: block
---
`);
  });

  it('should work with an empty file', () => {
    const result = updateKeyInFrontMatter('', 'some', 'value');

    expect(result).toEqual(`---
some: value
---
`);
  });

  it('should update existing frontmatter without \\n in the last line', () => {
    const content = `---
old: data
---`;
    const result = updateKeyInFrontMatter(content, 'some', 'value');
    expect(result).toEqual(`---
old: data
some: value
---`);
  });
});
