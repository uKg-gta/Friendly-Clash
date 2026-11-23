      // 2. REALISTIC SYNTHESIZED AUDIO ENGINE (SOUND ONLY, NO VIBRATION)
      // =========================================================================
      export class SoundEngine {
        constructor() {
          this.ctx = null;
          this.enabled = true;
          this.volume = 0.75;
        }

        ensureContext() {
          if (!this.enabled) return null;
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
          }
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          return this.ctx;
        }

        playDiceTumble() {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          // Realistic series of decaying wooden/ivory impacts over ~0.95s
          const hits = [0.02, 0.11, 0.21, 0.32, 0.44, 0.58, 0.73, 0.87, 0.96];
          hits.forEach((offset, idx) => {
            const t = now + offset;
            const intensity = idx === hits.length - 1 ? 0.55 : (0.75 - idx * 0.06);
            this._woodClick(ctx, t, 460 + (idx % 3) * 140 + Math.random() * 80, intensity * this.volume);
          });
        }

        _woodClick(ctx, time, freq, gainAmt) {
          // Short filtered noise burst + resonant woody body
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.42, time + 0.045);

          gain.gain.setValueAtTime(0.001, time);
          gain.gain.linearRampToValueAtTime(Math.max(0.001, gainAmt * 0.28), time + 0.004);
          gain.gain.exponentialRampToValueAtTime(0.0008, time + 0.055);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(time);
          osc.stop(time + 0.06);
        }

        playHop(stepNum) {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const base = 300 + (stepNum % 6) * 28;
          osc.frequency.setValueAtTime(base, now);
          osc.frequency.exponentialRampToValueAtTime(base * 1.32, now + 0.045);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.16 * this.volume, now + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
        }

        playEntryPop() {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.24 * this.volume, now + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
        }

        playCapture() {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          // Crisp low impact + descending slide
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(210, now);
          osc.frequency.exponentialRampToValueAtTime(68, now + 0.18);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.35 * this.volume, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.24);
        }

        playHomeSparkle() {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((f, i) => {
            const t = now + i * 0.065;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.16 * this.volume, t + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.36);
          });
        }

        playForfeit() {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          [320, 240].forEach((f, i) => {
            const t = now + i * 0.11;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.18 * this.volume, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.18);
          });
        }

        playVictory() {
          const ctx = this.ensureContext();
          if (!ctx || this.volume <= 0.01) return;
          const now = ctx.currentTime;
          const chord = [523.25, 659.25, 783.99, 987.77, 1046.5];
          chord.forEach((f, i) => {
            const t = now + i * 0.08;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, t);
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(0.18 * this.volume, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.68);
          });
        }
      }

      const sound = new SoundEngine();

      // =========================================================================

