type Listener = (event: any) => void;

const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(event: any) {
  for (const fn of listeners) {
    try { fn(event); } catch {}
  }
}

export function trackingEvent(type: string, payload: any) {
  broadcast({ type, ...payload, ts: Date.now() });
}