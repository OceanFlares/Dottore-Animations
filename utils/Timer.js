export class Timer {
  constructor() {
    this._oldTime = performance.now();
    this._elapsed = 0;
    this._delta = 0;
    this._running = true;

    this._maxDelta = 0.05; // cap at 50ms (~20 FPS)
  }

  update() {
    if (!this._running) {
      this._delta = 0;
      return;
    }

    const now = performance.now();

    let delta = (now - this._oldTime) / 1000;

    if (!Number.isFinite(delta) || delta < 0) {
      delta = 0;
    } else if (delta > this._maxDelta) {
      delta = this._maxDelta;
    }

    this._delta = delta;
    this._oldTime = now;
    this._elapsed += delta;
  }

  getDelta() {
    return this._delta;
  }

  getElapsed() {
    return this._elapsed;
  }

  reset() {
    this._oldTime = performance.now();
    this._delta = 0;
  }

  pause() {
    this._running = false;
  }

  resume() {
    if (!this._running) {
      this._running = true;
      this._oldTime = performance.now();
      this._delta = 0;
    }
  }

  get running() {
    return this._running;
  }
}