export class Timer {
  constructor() {
    this._startTime = performance.now();
    this._oldTime = this._startTime;
    this._elapsed = 0;
    this._running = true;
  }

  update() {
    if (!this._running) return;

    const now = performance.now();
    this._delta = (now - this._oldTime) / 1000;
    this._oldTime = now;
    this._elapsed += this._delta;
  }

  getDelta() {
    return this._delta || 0;
  }

  getElapsed() {
    return this._elapsed;
  }

  pause() {
    this._running = false;
  }

  resume() {
    if (!this._running) {
      this._running = true;
      this._oldTime = performance.now();
    }
  }

  get running() {
    return this._running;
  }
}