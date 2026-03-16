#!/usr/bin/env node
/**
 * orchestrator-lite/response-analyzer.js
 *
 * Analyze agent responses to detect completion, stuck loops, questions, and errors.
 * Adaptation of ralph-claude-code lib/response_analyzer.sh.
 *
 * Features:
 * - Two-stage error filtering (avoids JSON field false positives)
 * - Question detection (anti-headless-pattern)
 * - Test-only loop detection
 * - Completion signal detection
 * - Loop context builder for prompt injection
 */

const COMPLETION_KEYWORDS = [
  'done', 'complete', 'finished', 'all tasks complete',
  'project complete', 'ready for review'
];

const TEST_ONLY_PATTERNS = [
  'npm test', 'bats', 'pytest', 'jest', 'cargo test', 'go test', 'running tests'
];

const QUESTION_PATTERNS = [
  'should i', 'would you', 'do you want', 'which approach',
  'which option', 'how should', 'what should', 'shall i',
  'do you prefer', 'can you clarify', 'could you',
  'what do you think', 'please confirm', 'awaiting.*input',
  'waiting.*response', 'your preference'
];

/**
 * Analyze agent response to detect completion, stuck loops, questions
 * @param {string} text - Agent output text
 * @param {Object} metadata - { filesChanged, loopNumber, outputLength }
 * @returns {Object} Analysis result
 */
function analyzeResponse(text, metadata = {}) {
  const result = {
    hasCompletionSignal: false,
    isTestOnly: false,
    isStuck: false,
    hasProgress: metadata.filesChanged > 0,
    exitSignal: false,
    confidenceScore: 0,
    workSummary: '',
    askingQuestions: false,
    questionCount: 0,
    filesModified: metadata.filesChanged || 0,
    outputLength: metadata.outputLength || text.length
  };

  if (!text) return result;

  const lower = text.toLowerCase();

  // 1. Completion keywords
  for (const kw of COMPLETION_KEYWORDS) {
    if (lower.includes(kw)) {
      result.hasCompletionSignal = true;
      result.confidenceScore += 10;
      break;
    }
  }

  // 2. Test-only detection
  let testCount = 0;
  let implCount = 0;
  for (const p of TEST_ONLY_PATTERNS) {
    if (lower.includes(p)) testCount++;
  }
  implCount = (lower.match(/implementing|creating|writing|adding|function|class/g) || []).length;

  if (testCount > 0 && implCount === 0) {
    result.isTestOnly = true;
    result.workSummary = 'Test execution only, no implementation';
  }

  // 3. Question detection
  for (const p of QUESTION_PATTERNS) {
    const regex = new RegExp(p, 'gi');
    const matches = text.match(regex);
    if (matches) result.questionCount += matches.length;
  }

  if (result.questionCount > 0) {
    result.askingQuestions = true;
    result.workSummary = 'Agent is asking questions instead of acting autonomously';
  }

  // 4. "Nothing to do" patterns
  const noWorkPatterns = ['nothing to do', 'no changes', 'already implemented', 'up to date'];
  for (const p of noWorkPatterns) {
    if (lower.includes(p)) {
      result.hasCompletionSignal = true;
      result.confidenceScore += 15;
      result.workSummary = 'No work remaining';
      break;
    }
  }

  // 5. Exit signal from structured blocks (e.g., RALPH_STATUS)
  const exitMatch = text.match(/EXIT_SIGNAL:\s*(true|false)/i);
  if (exitMatch) {
    result.exitSignal = exitMatch[1].toLowerCase() === 'true';
    if (result.exitSignal) {
      result.hasCompletionSignal = true;
      result.confidenceScore = 100;
    }
  }

  // 6. Two-stage error detection (avoid JSON field false positives)
  const filteredText = text.replace(/"[^"]*error[^"]*"\s*:/gi, '');
  const errorPatterns = filteredText.match(
    /(^Error:|^ERROR:|^error:|\]: error|Error occurred|failed with error|[Ee]xception|Fatal|FATAL)/gm
  );
  if (errorPatterns && errorPatterns.length > 5) {
    result.isStuck = true;
  }

  // 7. Progress boost
  if (result.hasProgress) {
    result.confidenceScore += 20;
  }

  // 8. Summary extraction
  if (!result.workSummary) {
    const summaryMatch = text.match(/(?:summary|completed|implemented)[^.]*\./i);
    result.workSummary = summaryMatch ? summaryMatch[0].slice(0, 100) : 'Output analyzed, no explicit summary';
  }

  // 9. Heuristic exit signal (only if no explicit EXIT_SIGNAL found)
  if (!exitMatch && (result.confidenceScore >= 40 || result.hasCompletionSignal)) {
    result.exitSignal = true;
  }

  return result;
}

/**
 * Build corrective context when agent asks questions
 * @returns {string} Context to inject
 */
function getQuestionCorrectionContext() {
  return 'IMPORTANT: You asked questions in the previous iteration. ' +
    'This is a headless automation loop with no human to answer. ' +
    'Do NOT ask questions. Choose the most conservative/safe default and proceed autonomously.';
}

/**
 * Build loop context for injection into agent prompt
 * @param {Object} params
 * @returns {string} Context string (max ~500 chars)
 */
function buildLoopContext(params) {
  const { loopNumber, remainingTasks, circuitBreakerState, previousSummary, hadQuestions } = params;
  let ctx = `Loop #${loopNumber}. `;
  if (remainingTasks !== undefined) ctx += `Remaining tasks: ${remainingTasks}. `;
  if (circuitBreakerState && circuitBreakerState !== 'CLOSED') ctx += `Circuit breaker: ${circuitBreakerState}. `;
  if (previousSummary) ctx += `Previous: ${previousSummary.slice(0, 200)} `;
  if (hadQuestions) ctx += getQuestionCorrectionContext();
  return ctx.slice(0, 500);
}

module.exports = { analyzeResponse, buildLoopContext, getQuestionCorrectionContext };
