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

// 예문은 data/ex_n5.js ~ data/ex_n1.js 에 "단어|예문(밑줄 부분은 [ ])|밑줄 부분 읽기|한국어 해석" 형식으로 있습니다.
for (const [level, text] of Object.entries(EX)) {
  const byWord = new Map(WORDS[level].map((w) => [w.word, w]));
  for (const line of text.trim().split('\n')) {
    const [word, sentence = '', reading, ko] = line.split('|').map((s) => s.trim());
    const m = sentence.match(/^([^\[\]]*)\[([^\[\]]+)\]([^\[\]]*)$/);
    const w = byWord.get(word);
    if (!w || !m || !reading) continue;
    (w.examples ??= []).push({ before: m[1], marked: m[2], after: m[3], reading, ko });
  }
}
