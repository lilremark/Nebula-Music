// Accumulate actual media progress, bounded by wall time. A seek never awards
// listening time; callers also reset the baseline for native seeking events.
export class ListeningClock {
  listened = 0;
  qualified = false;
  private position: number | null = null;
  private wall: number | null = null;
  constructor(readonly duration: number) {}
  sample(position: number, wall: number, playing: boolean, rate = 1, seeking = false): boolean {
    const delta = this.position === null ? 0 : position - this.position;
    const elapsed = this.wall === null ? 0 : (wall - this.wall) / 1000;
    if (playing && !seeking && delta > 0 && elapsed > 0 && elapsed < 5 && delta <= elapsed * Math.max(1, rate) + 0.75) this.listened += Math.min(delta / Math.max(0.1, rate), elapsed);
    this.position = position; this.wall = wall;
    const threshold = this.duration > 0 ? Math.min(240, this.duration / 2) : 240;
    const becameQualified = !this.qualified && this.listened >= threshold;
    if (becameQualified) this.qualified = true;
    return becameQualified;
  }
}
