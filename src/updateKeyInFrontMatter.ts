export const updateKeyInFrontMatter = (
  content: string,
  key: string,
  newValue: string,
) => {
  const rgx = new RegExp(/(^---\e*)([\s\S]*?)(\n)(---\e*)([\s\S]*)/)
  const foundContentMatch = rgx.exec(content)
  if (!foundContentMatch) {
    return `---
${key}: ${newValue}
---
${content}`;
  }

  const start = foundContentMatch[1];
  const maybeFrontMatter = foundContentMatch[2]+foundContentMatch[3];
  const rest = foundContentMatch[4]+foundContentMatch[5];

  const oldMatterSplitted = maybeFrontMatter
    .split('\n')
    .map((item) => item.split(/: /));

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

  return [start, newMatter, rest].join(``);
};
