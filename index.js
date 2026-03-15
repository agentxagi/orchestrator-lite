#!/usr/bin/env node
/**
 * orchestrator-lite/index.js
 *
 * Main entry point for orchestrator-lite
 * provides unified interface for task orchestration
 */

const { routeIntent, countDistinctDomains } = require('./router');
const { buildContract, generateBrief } = require('./contract-builder');
const { buildContext } = require('./context-builder');
const { checkOutput } = require('./output-check');

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

// Export main functions
module.exports = {
  orchestrate,
  validate,
  routeIntent,
  countDistinctDomains,
  buildContract,
  generateBrief,
  buildContext,
  checkOutput
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
