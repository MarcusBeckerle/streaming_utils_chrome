/* Kept separate so the playback transitions can be tested without YouTube. */
(() => {
  class AdController {
    constructor() {
      this.video = null;
      this.ad = false;
      this.originalRate = 1;
      this.lastNormalRate = 1;
      this.appliedRate = null;
      this.holdUntil = 0;
      this.progressAt = 0;
      this.lastTime = null;
      this.source = '';
      this.fallback = false;
    }
    restore() {
      if (this.video && this.ad) {
        try { this.video.playbackRate = this.originalRate; } catch { /* Detached player. */ }
      }
      this.ad = false;
      this.appliedRate = null;
      this.holdUntil = 0;
      this.lastTime = null;
      this.fallback = false;
    }
    beforeSkip(now = Date.now()) {
      if (!this.ad || !this.video) return;
      this.holdUntil = Math.max(this.holdUntil, now + 1200);
      try { this.video.playbackRate = this.originalRate; } catch { /* Detached player. */ }
      this.appliedRate = this.video.playbackRate;
    }
    update(video, advertising, enabled, requestedRate, now = Date.now()) {
      if (video !== this.video) {
        const continuingAd = this.ad && advertising && enabled;
        const previousRate = this.originalRate;
        this.restore();
        this.video = video;
        this.lastNormalRate = continuingAd ? previousRate : (video?.playbackRate || 1);
      }
      if (!video) return;
      if (!advertising || !enabled) {
        this.restore();
        this.lastNormalRate = video.playbackRate;
        return;
      }
      if (!this.ad) {
        this.originalRate = this.lastNormalRate;
        this.ad = true;
        this.lastTime = null;
      }
      // Let the media element load the next spot before accelerating it. Watch
      // progress rather than repeatedly forcing high speed into a stalled player.
      let settling = false;
      if (Number.isFinite(video.readyState)) {
        const time = video.currentTime;
        if (this.lastTime === null || video.currentSrc !== this.source || time < this.lastTime - 0.25) {
          this.source = video.currentSrc;
          this.holdUntil = Math.max(this.holdUntil, now + 600);
          this.progressAt = now;
          this.fallback = false;
        }
        if (video.paused || video.ended || video.seeking || video.readyState < 3) {
          this.holdUntil = Math.max(this.holdUntil, now + 600);
          this.progressAt = now;
        } else if (this.lastTime === null || Math.abs(time - this.lastTime) > 0.01 || now < this.holdUntil) {
          this.progressAt = now;
        } else if (now - this.progressAt >= 2000) {
          this.fallback = true;
        }
        this.lastTime = time;
        settling = now < this.holdUntil;
      }
      // Chromium rejects playbackRate > 16. No seeking, hiding, muting or skipping.
      const target = this.fallback ? 1 : (settling || now < this.holdUntil) ? this.originalRate
        : Math.max(1, Math.min(16, Number(requestedRate) || 20));
      try {
        if (video.playbackRate !== target) video.playbackRate = target;
        this.appliedRate = video.playbackRate;
      } catch { this.appliedRate = video.playbackRate; }
    }
  }
  globalThis.YouTubeAdController = AdController;
})();
