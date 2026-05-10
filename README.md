# Jeopardy Maker

A local-web Jeopardy clone for two players on a shared screen. Author custom
boards with text and images using the built-in editor, save them to your browser
via IndexedDB, and export/import as self-contained JSON files. No server, no
build step, no accounts — just open `index.html` in any modern browser and play.

## How to run

Open `index.html` directly in your browser (Chrome, Firefox, Safari, Edge).
No install, no server required.

## How to play

1. Create a board on the Home screen (or import a JSON file).
2. Click **Play** on any board.
3. Players click a cell to see the prompt. Host presses **Space** to reveal the
   answer, then **Space** or **Esc** to close.
4. Keyboard shortcuts (buzzer + scoring) are shown via **?** during play.

## Keyboard shortcuts (Play screen)

| Key   | Action                                     |
|-------|--------------------------------------------|
| `A`   | Player 1 buzz in                           |
| `L`   | Player 2 buzz in                           |
| `Y`   | Award buzzed player                        |
| `N`   | Deduct buzzed player, reopen buzzers       |
| Space | Reveal answer / close cell                 |
| Esc   | Close without resolving                    |
| `?`   | Toggle keyboard shortcut overlay           |
