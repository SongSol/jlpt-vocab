const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const MODES = {
  meaning: { title: '뜻 맞추기', desc: '단어를 보고 뜻 고르기', badge: '意', label: '이 단어의 뜻은?' },
  reading: { title: '読み方 맞추기', desc: '한자를 보고 읽는 법 고르기', badge: 'あ', label: '읽는 법은?' },
  word: { title: '단어 맞추기', desc: '뜻을 보고 단어 고르기', badge: '字', label: '이 뜻의 단어는?' },
  mix: { title: '전부 섞기', desc: '세 가지 유형이 랜덤으로 출제', badge: '混' },
};

const $main = document.getElementById('main');
const $levels = document.getElementById('levels');
const $tabs = document.querySelectorAll('.tabbar button');

// ---------- 저장소 ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

const state = {
  level: store.get('level', 'N5'),
  tab: 'list',
  query: '',
  hideReading: false,
  hideMeaning: false,
  revealed: new Set(),
  order: 'sorted', // 'sorted' | 'shuffled'
  shuffled: null,
  mode: store.get('mode', 'meaning'),
  count: store.get('count', 10),
  scope: 'all',
  wrong: store.get('wrong', {}), // { wordId: 틀린 횟수 }
  quiz: null,
};
if (!LEVELS.includes(state.level)) state.level = 'N5';

function saveWrong() { store.set('wrong', state.wrong); }

// ---------- 유틸 ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const words = () => WORDS[state.level];
const wrongWords = () => words().filter((w) => state.wrong[w.id]);

// 読み方 기준 あいうえお순 (레벨별로 한 번만 정렬)
const collator = new Intl.Collator('ja');
const sortedCache = {};
const sortedWords = () =>
  (sortedCache[state.level] ??= [...words()].sort((a, b) => collator.compare(a.reading, b.reading)));
const hasKanji = (w) => w.word !== w.reading;

// 모드별로 정답으로 쓰는 필드
const answerOf = (mode, w) => (mode === 'meaning' ? w.meaning : mode === 'reading' ? w.reading : w.word);

// ---------- 레벨 / 탭 ----------
function renderLevels() {
  $levels.innerHTML = LEVELS.map(
    (lv) => `<button data-level="${lv}" class="${lv === state.level ? 'active' : ''}">${lv}</button>`
  ).join('');
}

$levels.addEventListener('click', (e) => {
  const lv = e.target.dataset.level;
  if (!lv || lv === state.level) return;
  state.level = lv;
  state.revealed.clear();
  state.scope = 'all';
  store.set('level', lv);
  renderLevels();
  render();
  window.scrollTo(0, 0);
});

$tabs.forEach((btn) =>
  btn.addEventListener('click', () => {
    if (state.quiz && !confirm('퀴즈를 그만둘까요?')) return;
    state.quiz = null;
    state.tab = btn.dataset.tab;
    render();
    window.scrollTo(0, 0);
  })
);

function render() {
  document.body.classList.toggle('in-quiz', !!state.quiz);
  $tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  if (state.quiz) return state.quiz.done ? renderResult() : renderQuestion();
  if (state.tab === 'list') renderList();
  else if (state.tab === 'quiz') renderQuizSetup();
  else renderWrong();
}

// ---------- 단어장 ----------
function renderList() {
  $main.innerHTML = `
    <div class="toolbar">
      <input class="search" type="search" placeholder="단어, 読み方, 뜻 검색" value="${esc(state.query)}" />
      <div class="toggles">
        <button class="chip ${state.hideReading ? 'on' : ''}" data-toggle="hideReading">読み方 가리기</button>
        <button class="chip ${state.hideMeaning ? 'on' : ''}" data-toggle="hideMeaning">뜻 가리기</button>
      </div>
      <div class="toggles">
        <button class="chip" data-order="sorted">あいうえお순</button>
        <button class="chip" data-order="shuffled">🔀 섞기</button>
        <span class="count"></span>
      </div>
    </div>
    <ul class="word-list"></ul>`;

  const $search = $main.querySelector('.search');
  $search.addEventListener('input', () => {
    state.query = $search.value;
    renderRows();
  });
  $main.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      state[b.dataset.toggle] = !state[b.dataset.toggle];
      state.revealed.clear();
      b.classList.toggle('on');
      renderRows();
    })
  );
  $main.querySelectorAll('[data-order]').forEach((b) =>
    b.addEventListener('click', () => {
      // 섞기는 누를 때마다 새로 섞음
      state.order = b.dataset.order;
      state.shuffled = state.order === 'shuffled' ? shuffle(words()) : null;
      renderRows();
      window.scrollTo(0, 0);
    })
  );
  $main.querySelector('.word-list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    state.revealed.has(id) ? state.revealed.delete(id) : state.revealed.add(id);
    renderRows();
  });
  renderRows();
}

function renderRows() {
  const q = state.query.trim().toLowerCase();
  if (state.order === 'shuffled' && state.shuffled?.[0]?.id.split('-')[0] !== state.level) {
    state.shuffled = shuffle(words());
  }
  $main.querySelectorAll('[data-order]').forEach((b) => b.classList.toggle('on', b.dataset.order === state.order));
  const base = state.order === 'shuffled' ? state.shuffled : sortedWords();
  const list = base.filter(
    (w) => !q || w.word.includes(q) || w.reading.includes(q) || w.meaning.toLowerCase().includes(q)
  );
  $main.querySelector('.count').textContent = `${list.length}개`;
  $main.querySelector('.word-list').innerHTML = list.length
    ? list.map(rowHtml).join('')
    : `<li class="empty" style="display:block">검색 결과가 없어요</li>`;
}

function rowHtml(w) {
  const open = state.revealed.has(w.id);
  const hr = state.hideReading && !open ? ' hid' : '';
  const hm = state.hideMeaning && !open ? ' hid' : '';
  const dot = state.wrong[w.id] ? `<span class="wrong-dot">●</span>` : '';
  return `<li data-id="${w.id}">
    <span class="w">${esc(w.word)}${dot}</span>
    <span class="m${hm}">${esc(w.meaning)}</span>
    <span class="r${hr}">${hasKanji(w) ? esc(w.reading) : '&nbsp;'}</span>
  </li>`;
}

// ---------- 오답노트 ----------
function renderWrong() {
  const list = wrongWords().sort((a, b) => state.wrong[b.id] - state.wrong[a.id]);
  if (!list.length) {
    $main.innerHTML = `<div class="empty">${state.level} 오답이 없어요 🎉<br/>퀴즈에서 틀린 단어가 여기에 모여요.</div>`;
    return;
  }
  $main.innerHTML = `
    <div class="toggles" style="margin-bottom:12px">
      <span class="count" style="margin-left:0">틀린 단어 ${list.length}개 · 퀴즈에서 맞히면 빠져요</span>
    </div>
    <ul class="word-list">${list
      .map(
        (w) => `<li>
          <span class="w">${esc(w.word)}</span>
          <span class="m">${esc(w.meaning)}</span>
          <span class="r">${hasKanji(w) ? esc(w.reading) : '&nbsp;'} · ${state.wrong[w.id]}회 틀림</span>
        </li>`
      )
      .join('')}</ul>
    <button class="primary" id="wrong-quiz">오답만 퀴즈 풀기</button>
    <button class="ghost" id="wrong-clear">오답노트 비우기</button>`;

  document.getElementById('wrong-quiz').onclick = () => {
    state.scope = 'wrong';
    state.tab = 'quiz';
    render();
  };
  document.getElementById('wrong-clear').onclick = () => {
    if (!confirm(`${state.level} 오답노트를 비울까요?`)) return;
    list.forEach((w) => delete state.wrong[w.id]);
    saveWrong();
    render();
  };
}

// ---------- 퀴즈 설정 ----------
function quizPool() {
  let pool = state.scope === 'wrong' ? wrongWords() : words();
  if (state.mode === 'reading') pool = pool.filter(hasKanji);
  return pool;
}

function renderQuizSetup() {
  const wrongCount = wrongWords().length;
  if (state.scope === 'wrong' && !wrongCount) state.scope = 'all';
  const pool = quizPool();
  const counts = [10, 20, 0]; // 0 = 전체

  $main.innerHTML = `
    <div class="section-title">문제 유형</div>
    <div class="modes">
      ${Object.entries(MODES)
        .map(
          ([key, m]) => `<button class="mode ${state.mode === key ? 'active' : ''}" data-mode="${key}">
            <span class="badge">${m.badge}</span>
            <span><b>${m.title}</b><small>${m.desc}</small></span>
          </button>`
        )
        .join('')}
    </div>

    <div class="section-title">범위</div>
    <div class="seg" id="scope">
      <button data-scope="all" class="${state.scope === 'all' ? 'active' : ''}">전체 단어</button>
      <button data-scope="wrong" class="${state.scope === 'wrong' ? 'active' : ''}" ${wrongCount ? '' : 'disabled style="opacity:.4"'}>오답만 (${wrongCount})</button>
    </div>

    <div class="section-title">문제 수</div>
    <div class="seg" id="count">
      ${counts
        .map((c) => `<button data-count="${c}" class="${state.count === c ? 'active' : ''}">${c ? c + '문제' : '전체'}</button>`)
        .join('')}
    </div>

    <button class="primary" id="start" ${pool.length ? '' : 'disabled'}>
      ${state.level} 퀴즈 시작 · ${Math.min(state.count || pool.length, pool.length)}문제
    </button>`;

  $main.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      store.set('mode', state.mode);
      renderQuizSetup();
    })
  );
  $main.querySelectorAll('[data-scope]').forEach((b) =>
    b.addEventListener('click', () => {
      state.scope = b.dataset.scope;
      renderQuizSetup();
    })
  );
  $main.querySelectorAll('[data-count]').forEach((b) =>
    b.addEventListener('click', () => {
      state.count = Number(b.dataset.count);
      store.set('count', state.count);
      renderQuizSetup();
    })
  );
  document.getElementById('start').onclick = () => startQuiz(pool);
}

// ---------- 퀴즈 진행 ----------
function makeChoices(mode, target) {
  const answer = answerOf(mode, target);
  // 뜻이 같은 단어가 오답 보기로 나오면 정답이 두 개가 되므로 제외
  let candidates = words().filter(
    (w) => w.id !== target.id && answerOf(mode, w) !== answer && w.meaning !== target.meaning
  );
  if (mode === 'reading') {
    // 글자 수가 비슷한 읽기를 오답으로 써서 난이도를 올림
    candidates = candidates.filter(hasKanji);
    candidates = shuffle(candidates)
      .sort((a, b) => Math.abs(a.reading.length - answer.length) - Math.abs(b.reading.length - answer.length))
      .slice(0, 10);
  }
  const wrongs = [];
  for (const w of shuffle(candidates)) {
    const v = answerOf(mode, w);
    if (!wrongs.includes(v)) wrongs.push(v);
    if (wrongs.length === 3) break;
  }
  return shuffle([answer, ...wrongs]);
}

function startQuiz(pool) {
  const picked = shuffle(pool).slice(0, state.count || pool.length);
  const modeFor = (w) => {
    if (state.mode !== 'mix') return state.mode;
    const options = hasKanji(w) ? ['meaning', 'reading', 'word'] : ['meaning', 'word'];
    return options[Math.floor(Math.random() * options.length)];
  };
  state.quiz = {
    mode: state.mode,
    questions: picked.map((w) => {
      const mode = modeFor(w);
      return { word: w, mode, choices: makeChoices(mode, w) };
    }),
    idx: 0,
    picked: null,
    score: 0,
    missed: [],
    done: false,
  };
  render();
  window.scrollTo(0, 0);
}

function renderQuestion() {
  const qz = state.quiz;
  const q = qz.questions[qz.idx];
  const w = q.word;
  const m = MODES[q.mode];
  const answer = answerOf(q.mode, w);
  const answered = qz.picked !== null;
  const isOk = qz.picked === answer;
  const prompt =
    q.mode === 'word'
      ? `<div class="big ko">${esc(w.meaning)}</div>`
      : `<div class="big jp">${esc(w.word)}</div>`;
  const choiceJp = q.mode !== 'meaning';

  $main.innerHTML = `
    <div class="q-head">
      <button class="quit" aria-label="그만두기">✕</button>
      <div class="bar"><i style="width:${(qz.idx / qz.questions.length) * 100}%"></i></div>
      <span class="num">${qz.idx + 1}/${qz.questions.length}</span>
    </div>

    <div class="card-wrap">
      <div class="card ${answered ? 'flipped' : ''}">
        <div class="face front">
          <span class="label">${m.label}</span>
          ${prompt}
        </div>
        <div class="face back ${answered ? (isOk ? 'ok' : 'bad') : ''}">
          <span class="result">${answered ? (isOk ? '정답 ⭕' : '오답 ❌') : ''}</span>
          ${hasKanji(w) ? `<div class="reading">${esc(w.reading)}</div>` : ''}
          <div class="word">${esc(w.word)}</div>
          <div class="meaning">${esc(w.meaning)}</div>
        </div>
      </div>
    </div>

    <div class="choices">
      ${q.choices
        .map((c, i) => {
          let cls = '';
          if (answered && c === answer) cls = 'correct';
          else if (answered && c === qz.picked) cls = 'wrong';
          return `<button class="choice ${cls} ${choiceJp ? 'jp' : ''}" data-i="${i}" ${answered ? 'disabled' : ''}>
            <span class="n">${i + 1}</span><span>${esc(c)}</span>
          </button>`;
        })
        .join('')}
    </div>
    ${answered ? `<button class="primary" id="next">${qz.idx + 1 < qz.questions.length ? '다음 →' : '결과 보기'}</button>` : ''}`;

  $main.querySelector('.quit').onclick = () => {
    if (confirm('퀴즈를 그만둘까요?')) {
      state.quiz = null;
      render();
    }
  };
  $main.querySelectorAll('.choice').forEach((b) => (b.onclick = () => pick(q.choices[b.dataset.i])));
  const next = document.getElementById('next');
  if (next) next.onclick = nextQuestion;
}

function pick(choice) {
  const qz = state.quiz;
  if (qz.picked !== null) return;
  const { word: w, mode } = qz.questions[qz.idx];
  const ok = choice === answerOf(mode, w);
  qz.picked = choice;
  if (ok) {
    qz.score++;
    delete state.wrong[w.id];
  } else {
    qz.missed.push(w);
    state.wrong[w.id] = (state.wrong[w.id] || 0) + 1;
  }
  saveWrong();
  if (navigator.vibrate) navigator.vibrate(ok ? 15 : [30, 40, 30]);
  renderQuestion();
}

function nextQuestion() {
  const qz = state.quiz;
  qz.idx++;
  qz.picked = null;
  if (qz.idx >= qz.questions.length) qz.done = true;
  render();
  window.scrollTo(0, 0);
}

// ---------- 결과 ----------
function renderResult() {
  const qz = state.quiz;
  const total = qz.questions.length;
  const pct = Math.round((qz.score / total) * 100);
  const msg = pct === 100 ? '완벽해요! 🎉' : pct >= 80 ? '아주 잘했어요 👏' : pct >= 50 ? '조금만 더 힘내요 💪' : '오답노트로 복습해봐요 📝';

  $main.innerHTML = `
    <div class="result-card">
      <div class="score">${pct}점</div>
      <div class="sub">${total}문제 중 ${qz.score}개 정답 · ${MODES[qz.mode].title}</div>
      <div class="msg">${msg}</div>
    </div>
    ${
      qz.missed.length
        ? `<div class="section-title">틀린 단어</div>
           <ul class="word-list">${qz.missed
             .map(
               (w) => `<li><span class="w">${esc(w.word)}</span><span class="m">${esc(w.meaning)}</span>
                 <span class="r">${hasKanji(w) ? esc(w.reading) : '&nbsp;'}</span></li>`
             )
             .join('')}</ul>
           <button class="primary" id="retry-missed">틀린 것만 다시 풀기</button>`
        : ''
    }
    <button class="${qz.missed.length ? 'ghost' : 'primary'}" id="again">새 퀴즈</button>
    <button class="ghost" id="home">단어장으로</button>`;

  const retry = document.getElementById('retry-missed');
  if (retry) retry.onclick = () => { state.mode = qz.mode; startQuiz(qz.missed); };
  document.getElementById('again').onclick = () => { state.quiz = null; state.tab = 'quiz'; render(); };
  document.getElementById('home').onclick = () => { state.quiz = null; state.tab = 'list'; render(); };
}

// ---------- 키보드 (PC에서 테스트할 때) ----------
document.addEventListener('keydown', (e) => {
  if (!state.quiz || state.quiz.done) return;
  const q = state.quiz.questions[state.quiz.idx];
  if (state.quiz.picked === null && /^[1-4]$/.test(e.key) && q.choices[e.key - 1]) pick(q.choices[e.key - 1]);
  else if (state.quiz.picked !== null && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    nextQuestion();
  }
});

// ---------- 시작 ----------
renderLevels();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}
