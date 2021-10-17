export const updateKeyInFrontMatter = (
  content: string,
  key: string,
  newValue: string,
) => {
  if (!content.match(new RegExp(/^---[\s\S]*---\n.*/g))) {
    return `---
${key}: ${newValue}
---
${content}`;
  }
  const [start, maybeFrontMatter, ...rest] = content.split(new RegExp(/---\n/));

  const oldMatterSplitted = maybeFrontMatter
    .split('\n')
    .map((item) => item.split(/: /, 2));

  const maybeKeyIndex = oldMatterSplitted.findIndex(
    (it) => it[0] === key && it.length === 2,
  );
  // console.log(maybeKeyIndex, oldMatterSplitted);
  if (maybeKeyIndex >= 0) {
    oldMatterSplitted[maybeKeyIndex][1] = newValue;
    // console.log(maybeKeyIndex, oldMatterSplitted);
  } else {
    oldMatterSplitted.pop();
    oldMatterSplitted.push([key, newValue]);
    oldMatterSplitted.push(['']);
  }
  const newMatter = oldMatterSplitted
    .map((item) => {
      // console.log('New value : ', s);
      return item.join(': ');
    })
    .join('\n');

  return [start, newMatter, ...rest].join(`---\n`);
};
