// ===== 설정값 (숫자만 바꾸면 됩니다) =====
const CONFIG = {
  GAME_SECONDS: 30,           // 제한시간(초)
  DEFAULT_LEVEL: "normal",    // 기본 선택 난이도
  LEVELS: {
    easy:   { label: "쉬움",   exposureMs: 1200 },
    normal: { label: "보통",   exposureMs: 800 },
    hard:   { label: "어려움", exposureMs: 500 },
  },
};

const MESSAGES = {
  idle: "난이도를 고르고 시작을 눌러요",
  playing: "두더지를 잡아요!",
  ended: "게임 끝!",
};

// ===== 화면 요소 =====
const gameEl = document.getElementById("game");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const resultEl = document.getElementById("result");
const resultText = document.getElementById("resultText");
const restartBtn = document.getElementById("restartBtn");
const diffBtns = Array.from(document.querySelectorAll(".diff-btn"));
const cells = Array.from(document.querySelectorAll(".cell"));

// ===== 게임 상태 =====
let state = "idle";            // "idle" | "playing" | "ended"
let level = CONFIG.DEFAULT_LEVEL;
let score = 0;
let moleIndex = -1;            // 지금 두더지가 있는 칸 (-1 = 없음)
let lastIndex = -1;            // 직전에 두더지가 나왔던 칸
let endAt = 0;                 // 게임 종료 시각(ms)

let tickTimer = null;          // 남은 시간 표시용
let endTimer = null;           // 정확히 30초에 끝내기용
let moleTimer = null;          // 두더지 노출 시간용

// ===== 타이머 정리 =====
function clearAllTimers() {
  clearInterval(tickTimer);
  clearTimeout(endTimer);
  clearTimeout(moleTimer);
  tickTimer = endTimer = moleTimer = null;
}

// ===== 화면 갱신 =====
function render() {
  gameEl.dataset.state = state;
  statusEl.textContent = MESSAGES[state];
  scoreEl.textContent = score;

  diffBtns.forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.level === level));
    btn.setAttribute("aria-disabled", String(state === "playing"));
  });

  startBtn.disabled = state !== "idle";
  cells.forEach((cell, i) => {
    cell.disabled = state !== "playing";
    cell.classList.toggle("mole", i === moleIndex);
    cell.setAttribute("aria-label", `${i + 1}번 칸${i === moleIndex ? " (두더지)" : ""}`);
  });

  resultEl.hidden = state !== "ended";
}

function renderTime(seconds) {
  timeEl.textContent = seconds;
}

// ===== 두더지 =====
function pickNextIndex() {
  // 직전 칸을 제외한 칸 중에서 무작위
  const candidates = [];
  for (let i = 0; i < cells.length; i++) {
    if (i !== lastIndex) candidates.push(i);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function showNextMole() {
  if (state !== "playing") return;
  clearTimeout(moleTimer);

  moleIndex = pickNextIndex();
  lastIndex = moleIndex;
  render();

  // 노출 시간이 지나면 점수 변화 없이 다음 칸으로
  moleTimer = setTimeout(showNextMole, CONFIG.LEVELS[level].exposureMs);
}

function hideMole() {
  moleIndex = -1;
}

// ===== 게임 흐름 =====
function startGame() {
  if (state !== "idle") return;     // 진행 중/종료 후 [시작]은 무시 → 타이머 중복 없음

  clearAllTimers();
  state = "playing";
  score = 0;
  lastIndex = -1;
  hideMole();

  endAt = performance.now() + CONFIG.GAME_SECONDS * 1000;
  renderTime(CONFIG.GAME_SECONDS);

  tickTimer = setInterval(() => {
    const leftMs = endAt - performance.now();
    renderTime(Math.max(0, Math.ceil(leftMs / 1000)));
    if (leftMs <= 0) endGame();
  }, 100);
  endTimer = setTimeout(endGame, CONFIG.GAME_SECONDS * 1000);

  showNextMole();
}

function endGame() {
  if (state !== "playing") return;

  clearAllTimers();
  state = "ended";
  hideMole();
  renderTime(0);
  resultText.textContent = `${CONFIG.LEVELS[level].label} 모드 · ${score}점`;
  render();
}

function resetGame() {
  clearAllTimers();                  // 이전 게임 타이머 제거
  state = "idle";
  score = 0;
  lastIndex = -1;
  hideMole();
  renderTime(CONFIG.GAME_SECONDS);
  render();
}

function hitCell(index) {
  if (state !== "playing") return;   // 시작 전/종료 후 클릭 무시
  if (index !== moleIndex) return;   // 빈 칸: 변화 없음

  score += 1;
  hideMole();                        // 즉시 사라짐 → 연타해도 1점만
  showNextMole();
}

function selectLevel(newLevel) {
  if (state === "playing") return;   // 진행 중에는 반응하지 않음
  if (!CONFIG.LEVELS[newLevel]) return;
  level = newLevel;
  render();
}

// ===== 이벤트 =====
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", resetGame);

diffBtns.forEach((btn) => {
  btn.addEventListener("click", () => selectLevel(btn.dataset.level));
});

cells.forEach((cell, i) => {
  cell.addEventListener("click", () => hitCell(i));
});

// 초기 화면
resetGame();
