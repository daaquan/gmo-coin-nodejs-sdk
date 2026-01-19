/** Token buckets: GET(6/s), POST(1/s), WS(1/s). */
export class FixedGate {
  private last = 0;
  private readonly intervalMs: number;
  constructor(opsPerSec: number) {
    this.intervalMs = Math.ceil(1000 / opsPerSec);
  }
  async wait() {
    const now = Date.now();
    const diff = now - this.last;
    if (diff < this.intervalMs) await new Promise((r) => setTimeout(r, this.intervalMs - diff));
    this.last = Date.now();
  }
}
export const getGate = new FixedGate(6);
export const postGate = new FixedGate(1);
export const wsGate = new FixedGate(1);
