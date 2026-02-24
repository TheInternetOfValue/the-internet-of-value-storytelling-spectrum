export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

export class EngineLoop {
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private frameId: number | null = null;

  constructor(
    private readonly update: UpdateFn,
    private readonly render?: RenderFn,
    private readonly timestep = 1 / 60
  ) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    const tick = (time: number) => {
      if (!this.running) return;
      const delta = Math.min((time - this.lastTime) / 1000, 0.25);
      this.lastTime = time;
      this.accumulator += delta;

      while (this.accumulator >= this.timestep) {
        this.update(this.timestep);
        this.accumulator -= this.timestep;
      }

      if (this.render) {
        this.render(this.accumulator / this.timestep);
      }

      this.frameId = requestAnimationFrame(tick);
    };

    this.frameId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}

