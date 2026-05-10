export const Phase = { IDLE: 'idle', P1: 'p1', P2: 'p2' };

export function createBuzzer() {
  let phase = Phase.IDLE;
  const subs = new Set();

  const notify = () => subs.forEach(fn => fn(phase));

  return {
    get phase() { return phase; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    buzz(player) {
      if (phase !== Phase.IDLE) return false;
      phase = player === 1 ? Phase.P1 : Phase.P2;
      notify();
      return true;
    },
    reset() { phase = Phase.IDLE; notify(); },
    buzzedPlayer() {
      return phase === Phase.P1 ? 1 : phase === Phase.P2 ? 2 : null;
    },
  };
}
