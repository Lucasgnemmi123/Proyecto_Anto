export class AudioController {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.lastCollisionAt = 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.ensureContext();
    return this.enabled;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return this.context;
  }

  playPocket() {
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(190, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + .24);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.16, now + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .31);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + .32);

    const click = context.createOscillator();
    const clickGain = context.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(640, now + .02);
    click.frequency.exponentialRampToValueAtTime(240, now + .1);
    clickGain.gain.setValueAtTime(.07, now + .02);
    clickGain.gain.exponentialRampToValueAtTime(.0001, now + .13);
    click.connect(clickGain).connect(context.destination);
    click.start(now + .02);
    click.stop(now + .14);
  }

  playCollision(intensity = .5) {
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime;
    if (now - this.lastCollisionAt < .035) return;
    this.lastCollisionAt = now;

    const strength = Math.max(.12, Math.min(1, intensity));
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, now);
    filter.Q.setValueAtTime(1.4, now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.075 * strength, now + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .075);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(820 + strength * 180, now);
    oscillator.frequency.exponentialRampToValueAtTime(390, now + .07);
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(1480 + strength * 260, now);
    overtone.frequency.exponentialRampToValueAtTime(720, now + .045);

    oscillator.connect(filter);
    overtone.connect(filter);
    filter.connect(gain).connect(context.destination);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + .08);
    overtone.stop(now + .055);
  }
}
