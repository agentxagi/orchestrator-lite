#!/usr/bin/env node
/**
 * orchestrator-lite/index.js
 *
 * Main entry point for orchestrator-lite
 * provides unified interface for task orchestration
 *
 * Modules:
 * - router: Intent routing (single/parallel/sequential)
 * - contract-builder: Task contract generation
 * - context-builder: Layered context assembly
 * - output-check: Output quality validation
 * - circuit-breaker: Loop protection state machine (Ralph-inspired)
 * - response-analyzer: Agent output pattern detection (Ralph-inspired)
 * - exit-detector: Dual-condition exit gate (Ralph-inspired)
 */

const path = require('path');
const { routeIntent, countDistinctDomains } = require('./router');
const { buildContract, generateBrief } = require('./contract-builder');
const { buildContext } = require('./context-builder');
const { checkOutput } = require('./output-check');
const { CircuitBreaker, STATES } = require('./circuit-breaker');
const { analyzeResponse, buildLoopContext, getQuestionCorrectionContext } = require('./response-analyzer');
const { ExitDetector } = require('./exit-detector');

/**
 * Main orchestration function
 */
function orchestrate(rawTask, options = {}) {
  const startTime = Date.now();

  const routing = routeIntent(rawTask, {
    forceMultiAgent: options.forceMultiAgent,
    forceSingle: options.forceSingle
  });

  const contract = buildContract(rawTask, {
    domain: routing.domain,
    priority: options.priority,
    motivation: options.motivation,
    project: options.project,
    stack: options.stack,
    files: options.files,
    constraints: options.constraints,
    requirements: options.requirements,
    format: options.format,
    path: options.outputPath,
    success: options.successCriteria
  });

  const context = buildContext({
    contract,
    projectPath: options.projectPath,
    totalTokens: options.totalContextTokens || 4000
  });

  const brief = generateBrief(rawTask, {
    domain: contract.domain,
    priority: contract.priority,
    motivation: contract.motivation,
    project: contract.context.project,
    stack: contract.context.stack,
    files: contract.context.files,
    constraints: [...contract.context.constraints, ...(contract.constraints || [])],
    requirements: contract.requirements,
    format: contract.output.format,
    path: contract.output.path,
    success: contract.successCriteria
  });

  const result = {
    routing,
    contract,
    context,
    brief,
    execution: {
      mode: routing.mode,
      runtime: routing.runtime,
      reason: routing.reason
    },
    metadata: {
      orchestrationTime: Date.now() - startTime,
      version: '1.0.0'
    }
  };

  return result;
}

/**
 * Validate output quality
 */
function validate(output, contract) {
  return checkOutput(output, contract);
}

/**
 * Orchestrate with loop control (Ralph-inspired)
 * For long-running autonomous tasks with circuit breaker + exit detection
 *
 * @param {string} rawTask - Task description
 * @param {Object} options - Orchestration options
 * @param {string} [options.projectPath] - Project directory path
 * @param {Object} [options.circuitBreaker] - Circuit breaker config overrides
 * @param {Object} [options.exitDetection] - Exit detector config overrides
 * @returns {Object} Plan with .loop and .loopControl for autonomous execution
 */
function orchestrateLoop(rawTask, options = {}) {
  const plan = orchestrate(rawTask, options);

  const cb = new CircuitBreaker({
    stateFile: path.join(options.projectPath || '.', '.orchestrator/circuit-breaker-state.json'),
    historyFile: path.join(options.projectPath || '.', '.orchestrator/circuit-breaker-history.json'),
    ...options.circuitBreaker
  });

  const exitDetector = new ExitDetector(options.exitDetection);

  return {
    ...plan,
    loop: {
      circuitBreaker: cb,
      exitDetector,
      analyzeResponse,
      buildLoopContext
    },
    loopControl: {
      /**
       * Call after each agent iteration
       * @param {Object} iterationResult - { text, filesChanged, loopNumber, outputLength }
       * @returns {{ continue: boolean, exitReason: string|null, cbState: string, analysis: Object }}
       */
      next(iterationResult) {
        // Analyze response
        const analysis = analyzeResponse(iterationResult.text, {
          filesChanged: iterationResult.filesChanged,
          loopNumber: iterationResult.loopNumber,
          outputLength: iterationResult.outputLength
        });

        // Record in circuit breaker
        const canContinue = cb.record({
          loopNumber: iterationResult.loopNumber,
          filesChanged: iterationResult.filesChanged,
          hasErrors: analysis.isStuck,
          outputLength: analysis.outputLength,
          hasProgress: analysis.hasProgress,
          hasCompletionSignal: analysis.hasCompletionSignal
        });

        // Update exit detector
        exitDetector.update(analysis);
        const exit = exitDetector.shouldExit(analysis.exitSignal);

        return {
          continue: canContinue && !exit.shouldExit,
          exitReason: exit.reason,
          cbState: cb.getState().state,
          analysis
        };
      }
    }
  };
}

// Export main functions
module.exports = {
  orchestrate,
  orchestrateLoop,
  validate,
  routeIntent,
  countDistinctDomains,
  buildContract,
  generateBrief,
  buildContext,
  checkOutput,
  // Ralph-inspired modules
  CircuitBreaker,
  STATES,
  analyzeResponse,
  buildLoopContext,
  getQuestionCorrectionContext,
  ExitDetector
};

if (require.main === module) {
  const args = process.argv.slice(2).join(' ');
  if (!args) {
    console.log('orchestrator-lite v1.0.0');
    console.log('');
    console.log('Usage: node index.js "task description"');
    console.log('');
    console.log('Options:');
    console.log('  --forceMultiAgent');
    console.log('  --forceSingle');
    console.log('  --projectPath <string>');
    console.log('  --project <string>');
    console.log('  --outputPath <string>');
    console.log('');
    console.log('Example:');
    console.log('  node index.js "build a REST API with authentication" --projectPath ./myproject --project myproject');
    process.exit(0);
  }
  
  const result = orchestrate(args);
  console.log(JSON.stringify(result, null, 2));
}
