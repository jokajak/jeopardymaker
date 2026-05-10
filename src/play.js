import { getRound, saveGameState } from './store.js';

// ── Play screen ──────────────────────────────────────────────────────────────
// Step 1: renders board grid, click to reveal prompt → answer → close.
// Buzzer/scoring added in step 4.

let _board = null;
let _state = null;
let _onExit = null;

export function mountPlay(container, board, state, onExit) {
  _board = board;
  _state = state;
  _onExit = onExit;

  container.innerHTML = '';
  container.appendChild(renderPlay());
}

function renderPlay() {
  const { categories, values } = getRound(_board);
  const revealed = new Set(_state.revealedCells);

  const root = document.createElement('div');
  root.className = 'play-root';

  // Score bar
  const scorebar = document.createElement('div');
  scorebar.className = 'scorebar';
  scorebar.innerHTML = `
    <div class="score p1-score">P1: <span id="p1-score">${_state.p1Score}</span></div>
    <button class="exit-btn" id="play-exit">← Home</button>
    <div class="score p2-score">P2: <span id="p2-score">${_state.p2Score}</span></div>
  `;
  root.appendChild(scorebar);

  // Board grid
  const board = document.createElement('div');
  board.className = 'play-board';
  board.style.gridTemplateColumns = `repeat(${categories.length}, 1fr)`;

  // Category headers
  categories.forEach(cat => {
    const header = document.createElement('div');
    header.className = 'cell header-cell';
    header.textContent = cat.title;
    board.appendChild(header);
  });

  // Value rows
  values.forEach((val, row) => {
    categories.forEach((cat, col) => {
      const key = `${row},${col}`;
      const cell = document.createElement('div');
      cell.className = 'cell value-cell' + (revealed.has(key) ? ' revealed' : '');
      cell.dataset.row = row;
      cell.dataset.col = col;

      if (!revealed.has(key)) {
        cell.textContent = `$${val}`;
        cell.addEventListener('click', () => openCell(row, col, val, cat.cells[row]));
      }
      board.appendChild(cell);
    });
  });

  root.appendChild(board);

  // Exit button
  root.querySelector('#play-exit').addEventListener('click', _onExit);

  return root;
}

// ── Cell modal ───────────────────────────────────────────────────────────────

let _modalEscHandler = null;
let _modalSpaceHandler = null;

function openCell(row, col, value, cellData) {
  showPrompt(row, col, value, cellData);
}

function showPrompt(row, col, value, cellData) {
  const modal = createModal();
  modal.dataset.phase = 'prompt';

  const content = document.createElement('div');
  content.className = 'modal-content';

  const valLabel = document.createElement('div');
  valLabel.className = 'modal-value';
  valLabel.textContent = `$${value}`;
  content.appendChild(valLabel);

  appendCellContent(content, cellData.prompt);

  const hint = document.createElement('div');
  hint.className = 'modal-hint';
  hint.textContent = 'Space → reveal answer  ·  Esc → close';
  content.appendChild(hint);

  modal.appendChild(content);
  document.body.appendChild(modal);

  cleanupModalHandlers();

  _modalSpaceHandler = e => {
    if (e.code === 'Space') {
      e.preventDefault();
      closeModal(modal);
      showAnswer(row, col, value, cellData);
    }
  };
  _modalEscHandler = e => {
    if (e.code === 'Escape') {
      closeModal(modal);
    }
  };

  document.addEventListener('keydown', _modalSpaceHandler);
  document.addEventListener('keydown', _modalEscHandler);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
}

function showAnswer(row, col, value, cellData) {
  const modal = createModal();
  modal.dataset.phase = 'answer';

  const content = document.createElement('div');
  content.className = 'modal-content';

  const valLabel = document.createElement('div');
  valLabel.className = 'modal-value';
  valLabel.textContent = `$${value}`;
  content.appendChild(valLabel);

  appendCellContent(content, cellData.answer);

  const hint = document.createElement('div');
  hint.className = 'modal-hint';
  hint.textContent = 'Space → close';
  content.appendChild(hint);

  modal.appendChild(content);
  document.body.appendChild(modal);

  cleanupModalHandlers();

  _modalSpaceHandler = e => {
    if (e.code === 'Space') {
      e.preventDefault();
      closeModal(modal);
      markRevealed(row, col);
    }
  };
  _modalEscHandler = e => {
    if (e.code === 'Escape') {
      closeModal(modal);
      markRevealed(row, col);
    }
  };

  document.addEventListener('keydown', _modalSpaceHandler);
  document.addEventListener('keydown', _modalEscHandler);
  modal.addEventListener('click', e => { if (e.target === modal) { closeModal(modal); markRevealed(row, col); } });
}

function appendCellContent(container, part) {
  if (part.imageDataUrl) {
    const img = document.createElement('img');
    img.src = part.imageDataUrl;
    img.className = 'modal-image';
    container.appendChild(img);
  }
  if (part.text) {
    const p = document.createElement('p');
    p.className = 'modal-text';
    p.textContent = part.text;
    container.appendChild(p);
  }
}

function createModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  return modal;
}

function closeModal(modal) {
  cleanupModalHandlers();
  modal.remove();
}

function cleanupModalHandlers() {
  if (_modalSpaceHandler) document.removeEventListener('keydown', _modalSpaceHandler);
  if (_modalEscHandler) document.removeEventListener('keydown', _modalEscHandler);
  _modalSpaceHandler = null;
  _modalEscHandler = null;
}

function markRevealed(row, col) {
  const key = `${row},${col}`;
  if (!_state.revealedCells.includes(key)) {
    _state.revealedCells.push(key);
    saveGameState(_state);
  }
  // Refresh the board cell
  const cellEl = document.querySelector(`.value-cell[data-row="${row}"][data-col="${col}"]`);
  if (cellEl) {
    cellEl.classList.add('revealed');
    cellEl.textContent = '';
    cellEl.replaceWith(cellEl.cloneNode(true)); // remove event listener
  }
}
