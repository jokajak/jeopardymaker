import { getRound, saveGameState } from './store.js';
import { createBuzzer, Phase } from './buzzer.js';

let _board = null;
let _state = null;
let _onExit = null;
let _buzzer = null;
let _boardEl = null;
let _p1El = null;
let _p2El = null;

export function mountPlay(container, board, state, onExit) {
  _board = board;
  _state = state;
  _onExit = onExit;
  _buzzer = createBuzzer();

  container.innerHTML = '';
  container.appendChild(_buildRoot());
}

// ── Root layout ──────────────────────────────────────────────────────────────

function _buildRoot() {
  const root = document.createElement('div');
  root.className = 'play-root';
  root.appendChild(_buildScorebbar());
  _boardEl = _buildBoard();
  root.appendChild(_boardEl);
  return root;
}

function _buildScorebbar() {
  const bar = document.createElement('div');
  bar.className = 'scorebar';

  _p1El = document.createElement('div');
  _p1El.className = 'score p1-score';

  const controls = document.createElement('div');
  controls.className = 'scorebar-controls';

  const exitBtn = document.createElement('button');
  exitBtn.className = 'ctrl-btn';
  exitBtn.textContent = '← Home';
  exitBtn.addEventListener('click', _onExit);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'ctrl-btn';
  resetBtn.textContent = 'Reset';
  resetBtn.title = 'Clear all revealed cells and zero scores';
  resetBtn.addEventListener('click', _resetGame);

  const helpBtn = document.createElement('button');
  helpBtn.className = 'ctrl-btn';
  helpBtn.textContent = '?';
  helpBtn.addEventListener('click', _showHelp);

  controls.append(exitBtn, resetBtn, helpBtn);

  _p2El = document.createElement('div');
  _p2El.className = 'score p2-score';

  bar.append(_p1El, controls, _p2El);
  _refreshScores();
  return bar;
}

function _refreshScores() {
  _p1El.innerHTML = `P1: <span>${_state.p1Score}</span>`;
  _p2El.innerHTML = `P2: <span>${_state.p2Score}</span>`;
}

function _buildBoard() {
  const { categories, values } = getRound(_board);
  const revealed = new Set(_state.revealedCells);

  const board = document.createElement('div');
  board.className = 'play-board';
  board.style.gridTemplateColumns = `repeat(${categories.length}, 1fr)`;

  categories.forEach(cat => {
    const h = document.createElement('div');
    h.className = 'cell header-cell';
    h.textContent = cat.title;
    board.appendChild(h);
  });

  values.forEach((val, row) => {
    categories.forEach((cat, col) => {
      const key = `${row},${col}`;
      const el = document.createElement('div');
      el.className = 'cell value-cell' + (revealed.has(key) ? ' revealed' : '');
      el.dataset.row = row;
      el.dataset.col = col;
      if (!revealed.has(key)) {
        el.textContent = `$${val}`;
        el.addEventListener('click', () => _openCell(row, col, val, cat.cells[row]));
      }
      board.appendChild(el);
    });
  });

  return board;
}

function _refreshBoard() {
  const newBoard = _buildBoard();
  _boardEl.replaceWith(newBoard);
  _boardEl = newBoard;
}

function _markRevealed(row, col) {
  const key = `${row},${col}`;
  if (!_state.revealedCells.includes(key)) {
    _state.revealedCells.push(key);
    saveGameState(_state);
  }
  const el = _boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (el) {
    el.classList.add('revealed');
    el.textContent = '';
    const fresh = el.cloneNode(false);
    el.replaceWith(fresh);
  }
}

function _resetGame() {
  if (!confirm('Reset game? This clears all revealed cells and scores.')) return;
  _state.revealedCells = [];
  _state.p1Score = 0;
  _state.p2Score = 0;
  saveGameState(_state);
  _refreshScores();
  _refreshBoard();
}

// ── Cell modal ───────────────────────────────────────────────────────────────
// State machine per cell open:
//   PROMPT/IDLE → buzz A/L → PROMPT/BUZZED → Y (award) or N (deduct+reopen)
//   PROMPT/* → Space → show ANSWER → Space/Esc → close+reveal
//   PROMPT/* → Esc → close, do NOT mark revealed

function _openCell(row, col, value, cellData) {
  _buzzer.reset();
  _showPromptModal(row, col, value, cellData);
}

function _showPromptModal(row, col, value, cellData) {
  const overlay = _createOverlay();
  const content = _createModalContent();
  _renderModalPart(content, value, cellData.prompt, 'Space → reveal answer  ·  A/L buzz  ·  Esc → close');
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // Keep overlay border in sync with buzzer state
  const unsub = _buzzer.subscribe(phase => _syncBuzzBorder(overlay, phase));
  _syncBuzzBorder(overlay, _buzzer.phase);

  // Buzz badge slot (inserted above hint when someone buzzes)
  let buzzBadgeEl = null;

  const keyHandler = e => {
    const phase = _buzzer.phase;

    if (e.key === 'a' || e.key === 'A') { _buzzer.buzz(1); return; }
    if (e.key === 'l' || e.key === 'L') { _buzzer.buzz(2); return; }

    if ((e.key === 'y' || e.key === 'Y') && phase !== Phase.IDLE) {
      e.preventDefault();
      const player = _buzzer.buzzedPlayer();
      _adjustScore(player, value);
      cleanup(true);
      _showAnswerModal(row, col, value, cellData, true);
      return;
    }

    if ((e.key === 'n' || e.key === 'N') && phase !== Phase.IDLE) {
      e.preventDefault();
      const player = _buzzer.buzzedPlayer();
      _adjustScore(player, -value);
      _buzzer.reset();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      cleanup(false);
      _showAnswerModal(row, col, value, cellData, false);
    }

    if (e.code === 'Escape') {
      cleanup(false);
      // Esc from prompt: do not mark revealed
    }
  };

  // Update buzz badge when phase changes
  _buzzer.subscribe(phase => {
    const existing = content.querySelector('.buzz-badge');
    if (existing) existing.remove();
    if (phase !== Phase.IDLE) {
      const badge = document.createElement('div');
      badge.className = `buzz-badge ${phase === Phase.P1 ? 'p1' : 'p2'}`;
      badge.textContent = phase === Phase.P1 ? 'P1 BUZZED IN' : 'P2 BUZZED IN';
      // Insert after modal-value
      const valEl = content.querySelector('.modal-value');
      valEl ? valEl.after(badge) : content.prepend(badge);
      // Update hint
      const hint = content.querySelector('.modal-hint');
      if (hint) hint.textContent = 'Y → correct (+pts)  ·  N → wrong (−pts)';
    } else {
      const hint = content.querySelector('.modal-hint');
      if (hint) hint.textContent = 'Space → reveal answer  ·  A/L buzz  ·  Esc → close';
    }
  });

  document.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(false); } });

  function cleanup(willShowAnswer) {
    document.removeEventListener('keydown', keyHandler);
    unsub();
    if (!willShowAnswer) _buzzer.reset();
    overlay.remove();
  }
}

function _showAnswerModal(row, col, value, cellData, alreadyScored) {
  const overlay = _createOverlay();
  const content = _createModalContent();
  const hintText = alreadyScored
    ? 'Space / Esc → close'
    : 'Space / Esc → close';
  _renderModalPart(content, value, cellData.answer, hintText);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  const keyHandler = e => {
    if (e.code === 'Space' || e.code === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  };

  document.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(); });

  function cleanup() {
    document.removeEventListener('keydown', keyHandler);
    overlay.remove();
    _markRevealed(row, col);
  }
}

// ── Modal helpers ────────────────────────────────────────────────────────────

function _createOverlay() {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  return el;
}

function _createModalContent() {
  const el = document.createElement('div');
  el.className = 'modal-content';
  return el;
}

function _renderModalPart(content, value, part, hintText) {
  const valEl = document.createElement('div');
  valEl.className = 'modal-value';
  valEl.textContent = `$${value}`;
  content.appendChild(valEl);

  if (part.imageDataUrl) {
    const img = document.createElement('img');
    img.className = 'modal-image';
    img.src = part.imageDataUrl;
    content.appendChild(img);
  }
  if (part.text) {
    const p = document.createElement('p');
    p.className = 'modal-text';
    p.textContent = part.text;
    content.appendChild(p);
  }

  const hint = document.createElement('div');
  hint.className = 'modal-hint';
  hint.textContent = hintText;
  content.appendChild(hint);
}

function _syncBuzzBorder(overlay, phase) {
  overlay.classList.toggle('buzz-p1', phase === Phase.P1);
  overlay.classList.toggle('buzz-p2', phase === Phase.P2);
}

function _adjustScore(player, delta) {
  if (player === 1) _state.p1Score += delta;
  else _state.p2Score += delta;
  saveGameState(_state);
  _refreshScores();
}

// ── Help overlay ─────────────────────────────────────────────────────────────

function _showHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';

  const box = document.createElement('div');
  box.className = 'help-content';
  box.innerHTML = `
    <h2>Keyboard Shortcuts</h2>
    <table class="help-table">
      <tr><td>A</td><td>Player 1 buzz in</td></tr>
      <tr><td>L</td><td>Player 2 buzz in</td></tr>
      <tr><td>Y</td><td>Award buzzed player (+value)</td></tr>
      <tr><td>N</td><td>Deduct buzzed player (−value), reopen buzzers</td></tr>
      <tr><td>Space</td><td>Reveal answer / close cell</td></tr>
      <tr><td>Esc</td><td>Close prompt without resolving</td></tr>
      <tr><td>?</td><td>Show / hide this overlay</td></tr>
    </table>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn primary help-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => overlay.remove());
  box.appendChild(closeBtn);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const handler = e => {
    if (e.code === 'Escape' || e.key === '?') { overlay.remove(); document.removeEventListener('keydown', handler); }
  };
  document.addEventListener('keydown', handler);
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', handler); } });
}
