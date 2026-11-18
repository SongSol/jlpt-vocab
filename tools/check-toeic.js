// TOEIC 데이터 검사: node tools/check-toeic.js T600
// data/t600.js 의 "단어|품사|뜻" 과 data/ex_t600.js 의 "단어|예문(빈칸 자리는 [ ])|한국어 해석" 을 검사합니다.
const fs = require('fs');
const path = require('path');

const level = (process.argv[2] || '').toUpperCase();
const root = path.join(__dirname, '..');
const lv = level.toLowerCase();

const RAW = {};
const EX = {};
eval(fs.readFileSync(path.join(root, `data/${lv}.js`), 'utf8'));
eval(fs.readFileSync(path.join(root, `data/ex_${lv}.js`), 'utf8'));

const errors = [];
const words = new Map();
RAW[level].trim().split('\n').forEach((line, i) => {
  const at = `단어 ${i + 1}행 ${line}`;
  const cols = line.split('|').map((c) => c.trim());
  if (cols.length !== 3 || cols.some((c) => !c)) return errors.push(`${at}\n  → 칸이 3개가 아니거나 빈 칸이 있음`);
  const [word, pos, meaning] = cols;
  if (!/^[a-z][a-z' -]*[a-z]$/.test(word)) errors.push(`${at}\n  → 단어는 영어 소문자만`);
  if (!['n', 'v', 'adj', 'adv'].includes(pos)) errors.push(`${at}\n  → 품사는 n, v, adj, adv 중 하나`);
  if (/[a-zA-Z]/.test(meaning)) errors.push(`${at}\n  → 뜻에 영어가 섞임`);
  if (words.has(word)) errors.push(`${at}\n  → 중복 단어`);
  words.set(word, pos);
});

// 다른 TOEIC 레벨과 겹치는 단어
for (const f of fs.readdirSync(path.join(root, 'data')).filter((f) => /^t\d+\.js$/.test(f) && f !== `${lv}.js`)) {
  const other = {};
  new Function('RAW', fs.readFileSync(path.join(root, 'data', f), 'utf8'))(other);
  for (const line of Object.values(other)[0].trim().split('\n')) {
    const w = line.split('|')[0].trim();
    if (words.has(w)) errors.push(`${w} → ${f} 에도 있음`);
  }
}

const covered = new Set();
EX[level].trim().split('\n').forEach((line, i) => {
  const at = `예문 ${i + 1}행 ${line}`;
  const cols = line.split('|').map((c) => c.trim());
  if (cols.length !== 3 || cols.some((c) => !c)) return errors.push(`${at}\n  → 칸이 3개가 아니거나 빈 칸이 있음`);
  const [word, sentence, ko] = cols;
  if (!words.has(word)) return errors.push(`${at}\n  → 단어장에 없는 단어`);
  const m = sentence.match(/^([^\[\]]*)\[([^\[\]]+)\]([^\[\]]*)$/);
  if (!m) return errors.push(`${at}\n  → [ ] 표시가 정확히 한 번 있어야 함`);
  if (m[2] !== word) return errors.push(`${at}\n  → [ ] 안은 단어 그대로여야 함 (${m[2]})`);
  if (!m[1]) return errors.push(`${at}\n  → 단어로 문장을 시작하지 않기`);
  if (/[a-zA-Z]/.test(ko)) return errors.push(`${at}\n  → 해석에 영어가 섞임`);
  covered.add(word);
});

const missing = [...words.keys()].filter((w) => !covered.has(w));
console.log(`${level}: 단어 ${words.size}개, 예문 ${EX[level].trim().split('\n').length}줄, ${covered.size}개 커버`);
if (missing.length) console.log(`예문 없는 단어 ${missing.length}개: ${missing.join(', ')}`);
if (errors.length) console.log(`오류 ${errors.length}개:\n${errors.join('\n')}`);
else console.log('오류 없음');
process.exit(errors.length || missing.length ? 1 : 0);
