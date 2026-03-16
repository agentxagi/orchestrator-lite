#!/usr/bin/env node
/**
 * orchestrator-lite/exit-detector.js
 *
 * Dual-condition exit gate for autonomous agent loops.
 * Port of ralph-claude-code exit detection logic.
 *
 * Requires BOTH completion indicators AND explicit exit signal
 * to prevent premature loop termination.
 *
 * Priority exit conditions:
 * 1. test_saturation - Too many consecutive test-only loops
 * 2. completion_signals - Multiple done signals detected
 * 3. safety_circuit_breaker - N consecutive EXIT_SIGNAL=true (safety limit)
 * 4. project_complete - Dual condition: 2+ completion indicators + explicit EXIT_SIGNAL
 */

const DEFAULTS = {
  maxConsecutiveTestLoops: 3,
  maxConsecutiveDoneSignals: 2,
  maxConsecutiveExitSignals: 5
};

class ExitDetector {
  constructor(options = {}) {
    this.config = { ...DEFAULTS, ...options };
    this.signals = {
      testOnlyLoops: [],
      doneSignals: [],
      completionIndicators: []
    };
  }

  /**
   * Update signals based on response analysis
   * @param {Object} analysis - Output from response-analyzer.analyzeResponse()
   * @param {number} [analysis.loopNumber] - Current loop number
   * @param {boolean} analysis.isTestOnly - Whether this loop was test-only
   * @param {boolean} analysis.hasProgress - Whether progress was detected
   * @param {boolean} analysis.hasCompletionSignal - Whether completion was signaled
   * @param {boolean} analysis.exitSignal - Whether explicit exit signal found
   */
  update(analysis) {
    // Track test-only loops (clear on progress)
    if (analysis.isTestOnly) {
      this.signals.testOnlyLoops.push(analysis.loopNumber);
    } else if (analysis.hasProgress) {
      this.signals.testOnlyLoops = [];
    }

    // Track done signals
    if (analysis.hasCompletionSignal) {
      this.signals.doneSignals.push(analysis.loopNumber);
    }

    // Track completion indicators (only on explicit exit signal)
    if (analysis.exitSignal) {
      this.signals.completionIndicators.push(analysis.loopNumber);
    }

    // Rolling window of last 5
    this.signals.testOnlyLoops = this.signals.testOnlyLoops.slice(-5);
    this.signals.doneSignals = this.signals.doneSignals.slice(-5);
    this.signals.completionIndicators = this.signals.completionIndicators.slice(-5);
  }

  /**
   * Check if loop should exit
   * @param {boolean} claudeExitSignal - Explicit exit signal from agent
   * @returns {{ shouldExit: boolean, reason: string|null }}
   */
  shouldExit(claudeExitSignal = false) {
    const { testOnlyLoops, doneSignals, completionIndicators } = this.signals;

    // Priority 1: Too many test-only loops
    if (testOnlyLoops.length >= this.config.maxConsecutiveTestLoops) {
      return { shouldExit: true, reason: 'test_saturation' };
    }

    // Priority 2: Multiple done signals
    if (doneSignals.length >= this.config.maxConsecutiveDoneSignals) {
      return { shouldExit: true, reason: 'completion_signals' };
    }

    // Priority 3: Safety circuit breaker (N consecutive EXIT_SIGNAL=true)
    if (completionIndicators.length >= this.config.maxConsecutiveExitSignals) {
      return { shouldExit: true, reason: 'safety_circuit_breaker' };
    }

    // Priority 4: Dual-condition gate (completion indicators + explicit EXIT_SIGNAL)
    if (completionIndicators.length >= 2 && claudeExitSignal) {
      return { shouldExit: true, reason: 'project_complete' };
    }

    return { shouldExit: false, reason: null };
  }

  /**
   * Check if fix_plan/task list is complete
   * @param {Array} taskList - List of tasks
   * @param {Function} isCompleted - Predicate to check if a task is done
   * @returns {{ complete: boolean, reason?: string, done?: number, total?: number }}
   */
  checkPlanCompletion(taskList, isCompleted) {
    if (!taskList || !isCompleted) return { complete: false };
    const total = taskList.length;
    if (total === 0) return { complete: false };
    const done = taskList.filter(isCompleted).length;
    if (done === total) return { complete: true, reason: 'plan_complete', done, total };
    return { complete: false, done, total };
  }

  reset() {
    this.signals = {
      testOnlyLoops: [],
      doneSignals: [],
      completionIndicators: []
    };
  }
}

module.exports = { ExitDetector };
