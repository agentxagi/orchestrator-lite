#!/usr/bin/env node
/**
 * orchestrator-lite/circuit-breaker.js
 *
 * Circuit breaker state machine for autonomous agent loops.
 * Port of ralph-claude-code lib/circuit_breaker.sh to Node.js.
 *
 * States: CLOSED → HALF_OPEN → OPEN
 * - CLOSED: Normal operation, tracking progress
 * - HALF_OPEN: Monitoring, 2+ loops without progress
 * - OPEN: Circuit tripped, stop execution (auto-recovery after cooldown)
 *
 * Based on Michael Nygard's circuit breaker pattern ("Release It!")
 */

const fs = require('fs');
const path = require('path');

const STATES = {
  CLOSED: 'CLOSED',
  HALF_OPEN: 'HALF_OPEN',
  OPEN: 'OPEN'
};

const DEFAULTS = {
  noProgressThreshold: 3,
  sameErrorThreshold: 5,
  outputDeclineThreshold: 70,
  cooldownMinutes: 30,
  autoReset: false,
  stateFile: '.orchestrator/circuit-breaker-state.json',
  historyFile: '.orchestrator/circuit-breaker-history.json'
};

class CircuitBreaker {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.stateDir = path.dirname(this.config.stateFile);
    this.state = null;
    this._ensureDirs();
    this._loadOrInit();
  }

  _ensureDirs() {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  _loadOrInit() {
    // Auto-recovery: check cooldown
    if (fs.existsSync(this.config.stateFile)) {
      try {
        this.state = JSON.parse(fs.readFileSync(this.config.stateFile, 'utf8'));
        if (this.state.state === STATES.OPEN) {
          this._checkCooldown();
        }
      } catch {
        this.state = null;
      }
    }
    if (!this.state) {
      this.state = this._freshState();
    }
  }

  _freshState() {
    return {
      state: STATES.CLOSED,
      lastChange: new Date().toISOString(),
      consecutiveNoProgress: 0,
      consecutiveSameError: 0,
      lastProgressLoop: 0,
      totalOpens: 0,
      reason: '',
      currentLoop: 0
    };
  }

  _checkCooldown() {
    if (this.config.autoReset) {
      this._transition(STATES.CLOSED, 'Auto-reset on startup');
      return;
    }

    const openedAt = this.state.openedAt || this.state.lastChange;
    if (!openedAt) return;

    const elapsed = (Date.now() - new Date(openedAt).getTime()) / 60000;
    if (elapsed >= this.config.cooldownMinutes) {
      this._transition(STATES.HALF_OPEN, `Cooldown elapsed (${Math.round(elapsed)}m)`);
    }
  }

  _transition(newState, reason) {
    const oldState = this.state.state;
    if (newState === STATES.OPEN && oldState !== STATES.OPEN) {
      this.state.totalOpens++;
      this.state.openedAt = new Date().toISOString();
    }
    this.state.state = newState;
    this.state.lastChange = new Date().toISOString();
    this.state.reason = reason;
    this._persist();
    this._logTransition(oldState, newState, reason);
  }

  _persist() {
    fs.writeFileSync(this.config.stateFile, JSON.stringify(this.state, null, 2));
  }

  _logTransition(from, to, reason) {
    const entry = {
      timestamp: new Date().toISOString(),
      loop: this.state.currentLoop,
      from, to, reason
    };
    let history = [];
    if (fs.existsSync(this.config.historyFile)) {
      try { history = JSON.parse(fs.readFileSync(this.config.historyFile, 'utf8')); } catch { history = []; }
    }
    history.push(entry);
    history = history.slice(-50); // Keep last 50
    fs.writeFileSync(this.config.historyFile, JSON.stringify(history, null, 2));
  }

  /**
   * Record result of a loop execution and update state
   * @param {Object} result
   * @param {number} result.loopNumber
   * @param {number} result.filesChanged - git diff count
   * @param {boolean} result.hasErrors
   * @param {number} result.outputLength
   * @param {boolean} result.hasProgress - explicit progress signal
   * @param {boolean} result.hasCompletionSignal
   * @returns {boolean} true if execution can continue
   */
  record(result) {
    this.state.currentLoop = result.loopNumber;
    const current = this.state.state;

    // Detect progress
    const hasProgress = result.filesChanged > 0 || result.hasProgress || result.hasCompletionSignal;
    if (hasProgress) {
      this.state.consecutiveNoProgress = 0;
      this.state.lastProgressLoop = result.loopNumber;
    } else {
      this.state.consecutiveNoProgress++;
    }

    // Detect errors
    if (result.hasErrors) {
      this.state.consecutiveSameError++;
    } else {
      this.state.consecutiveSameError = 0;
    }

    // State transitions
    if (current === STATES.CLOSED) {
      if (this.state.consecutiveNoProgress >= this.config.noProgressThreshold) {
        this._transition(STATES.OPEN, `No progress in ${this.state.consecutiveNoProgress} loops`);
      } else if (this.state.consecutiveNoProgress >= 2) {
        this._transition(STATES.HALF_OPEN, `Monitoring: ${this.state.consecutiveNoProgress} loops without progress`);
      }
    } else if (current === STATES.HALF_OPEN) {
      if (hasProgress) {
        this._transition(STATES.CLOSED, 'Progress detected, circuit recovered');
      } else if (this.state.consecutiveNoProgress >= this.config.noProgressThreshold) {
        this._transition(STATES.OPEN, `No recovery, opening after ${this.state.consecutiveNoProgress} loops`);
      }
    }
    // OPEN stays OPEN (recovery in init)

    return this.state.state !== STATES.OPEN;
  }

  canExecute() {
    return this.state.state !== STATES.OPEN;
  }

  getState() {
    return { ...this.state };
  }

  reset(reason = 'Manual reset') {
    this.state = this._freshState();
    this.state.reason = reason;
    this._persist();
  }

  getStatus() {
    const s = this.state;
    return {
      state: s.state,
      reason: s.reason,
      loopsSinceProgress: s.consecutiveNoProgress,
      lastProgressLoop: s.lastProgressLoop,
      currentLoop: s.currentLoop,
      totalOpens: s.totalOpens
    };
  }
}

module.exports = { CircuitBreaker, STATES };
