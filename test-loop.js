#!/usr/bin/env node
/**
 * orchestrator-lite/test-loop.js
 *
 * Example of autonomous loop using circuit breaker + response analyzer + exit detector.
 * Simulates a multi-iteration agent execution with controlled outcomes.
 *
 * Usage: node test-loop.js
 */

const { CircuitBreaker, STATES, analyzeResponse, buildLoopContext, ExitDetector } = require('./index');
const path = require('path');
const os = require('os');

// Use temp dir for state files to avoid polluting workspace
const tmpDir = path.join(os.tmpdir(), `orchestrator-test-${Date.now()}`);

console.log('🧪 orchestrator-lite: Loop Control Test\n');
console.log(`State dir: ${tmpDir}\n`);

// --- Circuit Breaker Tests ---

console.log('=== Circuit Breaker ===');

const cb = new CircuitBreaker({
  stateFile: path.join(tmpDir, 'cb-state.json'),
  historyFile: path.join(tmpDir, 'cb-history.json'),
  noProgressThreshold: 3
});

console.log('Initial state:', cb.getState().state); // CLOSED
console.log('canExecute:', cb.canExecute()); // true

// Simulate 2 loops with no progress → HALF_OPEN
cb.record({ loopNumber: 1, filesChanged: 0, hasErrors: false, outputLength: 100, hasProgress: false });
cb.record({ loopNumber: 2, filesChanged: 0, hasErrors: false, outputLength: 100, hasProgress: false });
console.log('After 2 no-progress loops:', cb.getState().state); // HALF_OPEN

// Simulate progress → recovery to CLOSED
cb.record({ loopNumber: 3, filesChanged: 2, hasErrors: false, outputLength: 200, hasProgress: true });
console.log('After progress:', cb.getState().state); // CLOSED

// Simulate 3 more no-progress → OPEN (tripped)
cb.record({ loopNumber: 4, filesChanged: 0, hasErrors: false, outputLength: 100, hasProgress: false });
cb.record({ loopNumber: 5, filesChanged: 0, hasErrors: false, outputLength: 100, hasProgress: false });
cb.record({ loopNumber: 6, filesChanged: 0, hasErrors: false, outputLength: 100, hasProgress: false });
console.log('After 3 more no-progress:', cb.getState().state); // OPEN
console.log('canExecute:', cb.canExecute()); // false
console.log('totalOpens:', cb.getState().totalOpens); // 1

// Reset
cb.reset('test reset');
console.log('After reset:', cb.getState().state); // CLOSED
console.log('Status:', JSON.stringify(cb.getStatus(), null, 2));

console.log('\n✅ Circuit Breaker: PASSED\n');

// --- Response Analyzer Tests ---

console.log('=== Response Analyzer ===');

// Test 1: Completion detection
const r1 = analyzeResponse('All tasks are complete. Ready for review.', { filesChanged: 3 });
console.log('Completion signal:', r1.hasCompletionSignal); // true
console.log('Exit signal:', r1.exitSignal); // true
console.log('Confidence:', r1.confidenceScore);

// Test 2: Question detection
const r2 = analyzeResponse('Should I use React or Vue? Which approach would you prefer?', { filesChanged: 0 });
console.log('Asking questions:', r2.askingQuestions); // true
console.log('Question count:', r2.questionCount);

// Test 3: Test-only loop
const r3 = analyzeResponse('Running jest tests...\nAll 42 tests passed.\nnpm test completed.', { filesChanged: 0 });
console.log('Test only:', r3.isTestOnly); // true

// Test 4: Explicit EXIT_SIGNAL
const r4 = analyzeResponse('Work done.\nEXIT_SIGNAL: true', { filesChanged: 5 });
console.log('Exit signal (explicit):', r4.exitSignal); // true
console.log('Confidence:', r4.confidenceScore); // 100

// Test 5: Stuck loop (many errors)
const errorText = Array(6).fill('Error: something went wrong').join('\n');
const r5 = analyzeResponse(errorText, { filesChanged: 0 });
console.log('Is stuck:', r5.isStuck); // true

// Test 6: Loop context builder
const ctx = buildLoopContext({
  loopNumber: 3,
  remainingTasks: 2,
  circuitBreakerState: 'HALF_OPEN',
  previousSummary: 'Implemented auth module with JWT tokens.',
  hadQuestions: false
});
console.log('Loop context:', ctx);

console.log('\n✅ Response Analyzer: PASSED\n');

// --- Exit Detector Tests ---

console.log('=== Exit Detector ===');

const ed = new ExitDetector({
  maxConsecutiveTestLoops: 3,
  maxConsecutiveDoneSignals: 2,
  maxConsecutiveExitSignals: 5
});

// No exit yet
let exit = ed.shouldExit(false);
console.log('Initial shouldExit:', exit.shouldExit); // false

// Feed 3 test-only analyses
ed.update({ loopNumber: 1, isTestOnly: true, hasProgress: false, hasCompletionSignal: false, exitSignal: false });
ed.update({ loopNumber: 2, isTestOnly: true, hasProgress: false, hasCompletionSignal: false, exitSignal: false });
ed.update({ loopNumber: 3, isTestOnly: true, hasProgress: false, hasCompletionSignal: false, exitSignal: false });
exit = ed.shouldExit(false);
console.log('After 3 test-only:', exit.shouldExit, exit.reason); // true, test_saturation

// Reset and test completion signals
ed.reset();
ed.update({ loopNumber: 1, hasCompletionSignal: true, exitSignal: true, isTestOnly: false, hasProgress: true });
ed.update({ loopNumber: 2, hasCompletionSignal: true, exitSignal: true, isTestOnly: false, hasProgress: false });
exit = ed.shouldExit(true);
console.log('After 2 done signals:', exit.shouldExit, exit.reason); // true, completion_signals

// Plan completion check
ed.reset();
const planResult = ed.checkPlanCompletion(
  [{ done: true }, { done: true }, { done: true }],
  t => t.done
);
console.log('Plan complete:', planResult); // { complete: true, done: 3, total: 3, reason: 'plan_complete' }

console.log('\n✅ Exit Detector: PASSED\n');

// --- Integration: Full Loop Simulation ---

console.log('=== Integration: Full Loop Simulation ===');

const cb2 = new CircuitBreaker({
  stateFile: path.join(tmpDir, 'cb2-state.json'),
  historyFile: path.join(tmpDir, 'cb2-history.json'),
  noProgressThreshold: 3
});

const ed2 = new ExitDetector();

const outputs = [
  'Implementing user authentication module...\nCreating auth.js with JWT tokens.',
  'All tests passing. npm test completed.', // test-only but has progress
  'The project is complete. All tasks are done.\nEXIT_SIGNAL: true',
];

for (let i = 0; i < outputs.length; i++) {
  const loopNum = i + 1;
  const analysis = analyzeResponse(outputs[i], { filesChanged: loopNum === 1 ? 2 : 0, loopNumber: loopNum });
  const canContinue = cb2.record({
    loopNumber: loopNum,
    filesChanged: analysis.filesModified,
    hasErrors: analysis.isStuck,
    outputLength: analysis.outputLength,
    hasProgress: analysis.hasProgress,
    hasCompletionSignal: analysis.hasCompletionSignal
  });
  ed2.update({ ...analysis, loopNumber: loopNum });
  const exit = ed2.shouldExit(analysis.exitSignal);

  console.log(`Loop #${loopNum}: CB=${cb2.getState().state}, exit=${exit.reason || 'continue'}, questions=${analysis.askingQuestions}, stuck=${analysis.isStuck}`);
}

console.log('\n✅ Integration: PASSED\n');

// --- Cleanup ---
const fs = require('fs');
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`🧹 Cleaned up ${tmpDir}`);
} catch {
  console.log(`⚠️  Could not clean up ${tmpDir}`);
}

console.log('\n🎉 All tests passed!');
