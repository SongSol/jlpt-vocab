// 예문 데이터 검사: node tools/check-examples.js N5
// data/ex_n5.js 의 각 줄 "단어|예문(밑줄 부분은 [ ])|밑줄 부분 읽기|한국어 해석" 을 검사합니다.
const fs = require('fs');
const path = require('path');

const level = (process.argv[2] || '').toUpperCase();
const root = path.join(__dirname, '..');
const lv = level.toLowerCase();

const RAW = {};
const EX = {};
eval(fs.readFileSync(path.join(root, `data/${lv}.js`), 'utf8'));
eval(fs.readFileSync(path.join(root, `data/ex_${lv}.js`), 'utf8'));

const words = new Map(
  RAW[level].trim().split('\n').filter((l) => l.includes('|')).map((l) => {
    const [word, reading] = l.split('|').map((s) => s.trim());
    return [word, reading];
  })
);
const kanjiWords = [...words].filter(([w, r]) => w !== r).map(([w]) => w);

const isKana = (s) => /^[ぁ-ゟ]/.test(s);
const errors = [];
const covered = new Set();

EX[level].trim().split('\n').forEach((line, i) => {
  const at = `${i + 1}행 ${line}`;
  const cols = line.split('|');
  if (cols.length !== 4 || cols.some((c) => !c.trim())) return errors.push(`${at}\n  → 칸이 4개가 아니거나 빈 칸이 있음`);
  const [word, sentence, reading, ko] = cols.map((c) => c.trim());
  if (!words.has(word)) return errors.push(`${at}\n  → 단어장에 없는 단어`);
  const m = sentence.match(/^([^\[\]]*)\[([^\[\]]+)\]([^\[\]]*)$/);
  if (!m) return errors.push(`${at}\n  → [ ] 표시가 정확히 한 번 있어야 함`);
  const marked = m[2];
  if (!/[ぁ-ゟ]/.test(reading) || /[^ぁ-ゟー]/.test(reading)) return errors.push(`${at}\n  → 읽기는 히라가나만`);
  // 밑줄 부분에 단어의 한자가 순서대로 들어 있어야 함
  const kanji = [...word].filter((c) => !isKana(c)).join('');
  const markedKanji = [...marked].filter((c) => !isKana(c)).join('');
  if (!markedKanji.startsWith(kanji) && markedKanji !== kanji) return errors.push(`${at}\n  → 밑줄 부분의 한자가 단어와 다름 (${kanji} / ${markedKanji})`);
  // 밑줄 부분의 가나가 읽기와 맞아야 함
  const segs = marked.match(/[ぁ-ゟ]+|[^ぁ-ゟ]+/g);
  const re = new RegExp('^' + segs.map((s) => (isKana(s) ? s : '(.+?)')).join('') + '$');
  if (!re.test(reading)) return errors.push(`${at}\n  → 밑줄 부분의 가나와 읽기가 맞지 않음`);
  if (marked === word && reading !== words.get(word)) return errors.push(`${at}\n  → 단어장의 읽기(${words.get(word)})와 다름`);
  if (/[a-zA-Z]/.test(ko)) return errors.push(`${at}\n  → 해석에 영어가 섞임`);
  covered.add(word);
});

const missing = kanjiWords.filter((w) => !covered.has(w));
console.log(`${level}: 예문 ${EX[level].trim().split('\n').length}줄, 한자 단어 ${kanjiWords.length}개 중 ${covered.size}개 커버`);
if (missing.length) console.log(`예문 없는 단어 ${missing.length}개: ${missing.join(' ')}`);
if (errors.length) console.log(`오류 ${errors.length}개:\n${errors.join('\n')}`);
else console.log('오류 없음');
process.exit(errors.length || missing.length ? 1 : 0);
