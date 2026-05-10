// Data model and IndexedDB persistence via idb-keyval
import { get, set, del, keys } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

const BOARDS_PREFIX = 'board:';
const GAMESTATE_PREFIX = 'gamestate:';

// ── Data model constructors ──────────────────────────────────────────────────

export function makeCell(promptText = '', answerText = '') {
  return {
    prompt: { text: promptText, imageDataUrl: null },
    answer: { text: answerText, imageDataUrl: null },
  };
}

export function makeCategory(title = '', cellCount = 5) {
  return {
    title,
    cells: Array.from({ length: cellCount }, () => makeCell()),
  };
}

export function makeBoard(name = 'New Board', categoryCount = 3) {
  const VALUES = [100, 200, 300, 400, 500];
  return {
    schema: 1,
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    rounds: [
      {
        categories: Array.from({ length: categoryCount }, (_, i) =>
          makeCategory(`Category ${i + 1}`)
        ),
        values: VALUES,
      },
    ],
  };
}

export function makeGameState(boardId) {
  return {
    boardId,
    p1Score: 0,
    p2Score: 0,
    revealedCells: [],
  };
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────

export async function saveBoard(board) {
  await set(BOARDS_PREFIX + board.id, board);
}

export async function loadBoard(id) {
  return get(BOARDS_PREFIX + id);
}

export async function deleteBoard(id) {
  await del(BOARDS_PREFIX + id);
  await del(GAMESTATE_PREFIX + id);
}

export async function listBoards() {
  const allKeys = await keys();
  const boardKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(BOARDS_PREFIX));
  const boards = await Promise.all(boardKeys.map(k => get(k)));
  return boards.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveGameState(state) {
  // Store revealedCells as array for JSON-safe serialization
  const toStore = { ...state, revealedCells: [...state.revealedCells] };
  await set(GAMESTATE_PREFIX + state.boardId, toStore);
}

export async function loadGameState(boardId) {
  const stored = await get(GAMESTATE_PREFIX + boardId);
  if (!stored) return makeGameState(boardId);
  return { ...stored, revealedCells: stored.revealedCells ?? [] };
}

// ── JSON export / import ─────────────────────────────────────────────────────

export function exportBoard(board) {
  return JSON.stringify(board, null, 2);
}

export function importBoard(jsonString) {
  const board = JSON.parse(jsonString);
  if (board.schema !== 1) throw new Error(`Unknown schema version: ${board.schema}`);
  if (!board.id) board.id = crypto.randomUUID();
  if (!board.rounds?.length) throw new Error('Board has no rounds');
  return board;
}

// Convenience: get round 0 categories and values
export function getRound(board) {
  return board.rounds[0];
}
