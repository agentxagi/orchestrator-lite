#!/usr/bin/env node
/**
 * orchestrator-lite/context-builder.js
 *
 * Build layered context for agent execution
 * layers: contract -> repo facts -> references -> prior artifacts
 *
 * Integrates with OpenClaw tools: read, memory_search, memory_get
 */

const fs = require('fs');
const path = require('path');

function approxTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function buildContext(options = {}) {
  const totalBudget = options.totalTokens || 4000;
  const contract = options.contract || {};
  
  // Layer 1: Task Contract (already provided)
  const contractTokens = approxTokens(JSON.stringify(contract));
  
  // Layer 2: Repo Facts
  const repoFacts = [];
  if (options.projectPath && fs.existsSync(options.projectPath)) {
    try {
      const packageJsonPath = path.join(options.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        repoFacts.push(`Package: ${pkg.name || 'unknown'}`);
        if (pkg.dependencies) {
          const deps = Object.keys(pkg.dependencies);
          if (deps.length > 0) {
            repoFacts.push(`Dependencies: ${deps.slice(0, 5).join(', ')}`);
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Layer 3: References (optional)
  const references = options.references || [];
  
  // Layer 4: Prior Artifacts (optional)
  const priorArtifacts = [];
  if (options.outputPath && fs.existsSync(options.outputPath)) {
    try {
      const files = fs.readdirSync(options.outputPath);
      const recentFiles = files
        .filter(f => {
          const fullPath = path.join(options.outputPath, f);
          const stat = fs.statSync(fullPath);
          const oneHourAgo = Date.now() - 3600000;
          return stat.mtime > oneHourAgo;
        })
        .slice(0, 3)
        .map(f => path.basename(f));
      
      priorArtifacts.push(...recentFiles);
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Build context object
  const context = {
    contract,
    repoFacts,
    references,
    priorArtifacts
  };
  
  const manifest = {
    totalBudgetTokens: totalBudget,
    usedTokens: contractTokens + approxTokens(repoFacts.join('\n')) + approxTokens(references.join('\n')) + approxTokens(priorArtifacts.join('\n')),
    layers: [
      {
        name: 'contract',
        tokens: contractTokens,
        truncated: false
      },
      {
        name: 'repo_facts',
        tokens: approxTokens(repoFacts.join('\n')),
        truncated: false,
        count: repoFacts.length
      },
      {
        name: 'references',
        tokens: approxTokens(references.join('\n')),
        truncated: false,
        count: references.length
      },
      {
        name: 'prior_artifacts',
        tokens: approxTokens(priorArtifacts.join('\n')),
        truncated: false,
        count: priorArtifacts.length
      }
    ]
  };
  
  return {
    context,
    manifest
  };
}

module.exports = {
  buildContext,
  approxTokens
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node context-builder.js "task"');
    console.log('');
    console.log('Options:');
    console.log('  --projectPath <path>');
    console.log('  --totalTokens <number>');
    console.log('  --references <comma-separated>');
    console.log('  --outputPath <path>');
    process.exit(0);
  }
  
  const result = buildContext({
    projectPath: args[0],
    totalTokens: parseInt(args[1]) || 4000
  });
  console.log(JSON.stringify(result, null, 2));
}
