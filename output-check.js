#!/usr/bin/env node
/**
 * orchestrator-lite/output-check.js
 *
 * Evaluate agent output quality
 * Simple checks: completeness, relevance, actionability
 */

function checkOutput(output, contract) {
  if (!output || output.trim().length === 0) {
    return {
      passed: false,
      issues: ['Empty output'],
      score: { total: 0 },
      recommendations: []
    };
  }

  const score = {
    completeness: 0,
    relevance: 0,
    actionability: 0,
    total: 0
  };

  // Check completeness
  if (contract.requirements) {
    contract.requirements.forEach(req => {
      const hasRequirement = output.toLowerCase().includes(req.toLowerCase());
      if (hasRequirement) {
        score.completeness += 20;
      }
    });
  }

  // Check relevance
  if (contract.context && contract.context.project) {
    const hasProject = output.includes(contract.context.project);
    if (hasProject) {
      score.relevance += 20;
    }
  }

  // Check actionability
  const hasActionableItems = /```/.test(output) ||
    /TODO|FIXME|IMPLEMENT|CREATE|UPDATE|DELETE|ADD|FIX/.test(output);
  const hasCodeBlocks = /```[\s\S]*```/.test(output);
  const hasFiles = /\.(ts|js|tsx|py|json|md|yaml)/.test(output);

  if (hasActionableItems && hasCodeBlocks && hasFiles) {
    score.actionability += 20;
  }

  // Calculate total
  score.total = (score.completeness + score.relevance + score.actionability) / 3;

  // Generate recommendations
  const recommendations = [];

  if (score.total < 5) {
    recommendations.push('Low quality output - consider retry');
  } else if (score.total < 7) {
    recommendations.push('Medium quality - minor improvements needed');
  } else if (score.total >= 7) {
    recommendations.push('Good quality output');
  }

  return {
    passed: score.total >= 6,
    score,
    issues: [],
    recommendations
  };
}

module.exports = {
  checkOutput
};

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node output-check.js "output" "contract"');
    console.log('');
    console.log('Example:');
    console.log('  node output-check.js "Created API endpoint" \'{"requirements":["API"]}\'');
    process.exit(0);
  }

  const output = args[0];
  const contractJson = args[1];

  try {
    const contract = JSON.parse(contractJson);
    const result = checkOutput(output, contract);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Invalid JSON contract:', e.message);
    process.exit(1);
  }
}
