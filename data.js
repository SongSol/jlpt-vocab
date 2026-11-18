// 레벨별 단어는 data/n5.js ~ data/n1.js 에 있습니다.
const WORDS = {};
for (const [level, text] of Object.entries(RAW)) {
  WORDS[level] = text
    .trim()
    .split('\n')
    .filter((line) => line.includes('|'))
    .map((line, i) => {
      // TOEIC(T600 등)은 "단어|품사|뜻" 이고 읽기 칸이 없음
      if (level[0] === 'T') {
        const [word, pos, meaning] = line.split('|').map((s) => s.trim());
        return { id: `${level}-${word}`, word, reading: word, pos, meaning };
      }
      const [word, reading, meaning] = line.split('|').map((s) => s.trim());
      return { id: `${level}-${word}`, word, reading, meaning };
    });
}

// TOEIC 예문은 data/ex_t600.js ~ data/ex_t900.js 에 있습니다.
// 예문은 data/ex_n5.js ~ data/ex_n1.js 에 "단어|예문(밑줄 부분은 [ ])|밑줄 부분 읽기|한국어 해석" 형식으로 있습니다.
for (const [level, text] of Object.entries(EX)) {
  const byWord = new Map(WORDS[level].map((w) => [w.word, w]));
  for (const line of text.trim().split('\n')) {
    const cols = line.split('|').map((s) => s.trim());
    // TOEIC 예문은 "단어|예문|해석" (읽기 칸 없음)
    if (level[0] === 'T') cols.splice(2, 0, cols[0]);
    const [word, sentence = '', reading, ko] = cols;
    const m = sentence.match(/^([^\[\]]*)\[([^\[\]]+)\]([^\[\]]*)$/);
    const w = byWord.get(word);
    if (!w || !m || !reading) continue;
    (w.examples ??= []).push({ before: m[1], marked: m[2], after: m[3], reading, ko });
  }
}
