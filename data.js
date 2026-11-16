// 레벨별 단어는 data/n5.js ~ data/n1.js 에 있습니다.
const WORDS = {};
for (const [level, text] of Object.entries(RAW)) {
  WORDS[level] = text
    .trim()
    .split('\n')
    .filter((line) => line.includes('|'))
    .map((line, i) => {
      const [word, reading, meaning] = line.split('|').map((s) => s.trim());
      return { id: `${level}-${word}`, word, reading, meaning };
    });
}
