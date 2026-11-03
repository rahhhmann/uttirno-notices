import { setTimeout as delay } from 'node:timers/promises';
type HostState = { tail: Promise<void>; lastStart: number };
export class HostLimiter {
  private readonly states = new Map<string, HostState>();
  constructor(
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = async (ms) => {
      await delay(ms);
    },
  ) {}
  async run<T>(host: string, intervalMs: number, action: () => Promise<T>): Promise<T> {
    let state = this.states.get(host);
    if (!state) {
      state = { tail: Promise.resolve(), lastStart: Number.NEGATIVE_INFINITY };
      this.states.set(host, state);
    }
    const previous = state.tail;
    let release!: () => void;
    state.tail = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    try {
      const wait = state.lastStart + intervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      state.lastStart = this.now();
      return await action();
    } finally {
      release();
    }
  }
}
export const sharedHostLimiter = new HostLimiter();
