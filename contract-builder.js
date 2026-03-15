#!/usr/bin/env node
/**
 * orchestrator-lite/contract-builder.js
 *
 * Transforma rough task into structured brief/contract
 * Used before spawning agents
 */

function buildContract(rawTask, options = {}) {
  const task = {
    raw: rawTask || '',
    domain: options.domain || 'general',
    type: options.type || 'general',
    priority: options.priority || 'medium',
    deadline: options.deadline || null,
    motivation: options.motivation || ''
  };

  const context = {
    project: options.project || 'Unknown',
    stack: options.stack || [],
    files: options.files || [],
    constraints: options.constraints || [],
    dependencies: options.dependencies || []
  };

  const output = {
    format: options.format || 'markdown',
    path: options.path || null,
    deliverable: options.deliverable !== false
  };

  return {
    task,
    context,
    requirements: options.requirements || [],
    constraints: options.constraints || [],
    output,
    successCriteria: options.successCriteria || [],
    raw: rawTask,
    brief: null
  };
}

function generateBrief(rawTask, options = {}) {
  const contract = buildContract(rawTask, options);

  const sections = [];

  // Task Contract header
  sections.push('## Task Contract');
  sections.push(`**Task**: ${contract.task.raw}`);
  sections.push(`**Domain**: ${contract.task.domain}`);
  sections.push(`**Priority**: ${contract.task.priority}`);
  sections.push(`**Motivation**: ${contract.task.motivation || 'Build value for the project'}`);
  sections.push('');

  // Context section
  sections.push('## Context');
  if (contract.context.project) {
    sections.push(`- **Project**: ${contract.context.project}`);
  }
  if (contract.context.stack && contract.context.stack.length > 0) {
    sections.push(`- **Stack**: ${contract.context.stack.join(', ')}`);
  }
  if (contract.context.files && contract.context.files.length > 0) {
    sections.push(`- **Key files**: ${contract.context.files.join(', ')}`);
  }
  sections.push('');

  // Constraints section
  if (contract.context.constraints && contract.context.constraints.length > 0) {
    sections.push('## Constraints');
    contract.context.constraints.forEach(c => sections.push(`- ${c}`));
    sections.push('');
  }

  // Requirements section
  if (contract.requirements && contract.requirements.length > 0) {
    sections.push('## Requirements');
    contract.requirements.forEach(r => sections.push(`- ${r}`));
    sections.push('');
  }

  // Output section
  if (contract.output.format) {
    sections.push(`## Output`);
    sections.push(`- **Format**: ${contract.output.format}`);
    if (contract.output.path) {
      sections.push(`- **Output path**: ${contract.output.path}`);
    }
    sections.push('');
  }

  // Success Criteria section
  if (contract.successCriteria && contract.successCriteria.length > 0) {
    sections.push('## Success Criteria');
    contract.successCriteria.forEach(sc => sections.push(`- ${sc}`));
    sections.push('');
  }

  // Brief summary
  sections.push('---');
  sections.push('');
  sections.push('**Brief**');
  sections.push('');
  sections.push(contract.task.raw);
  sections.push('');

  if (contract.context.project) {
    sections.push(`**Project**: ${contract.context.project}`);
  }
  if (contract.context.stack && contract.context.stack.length > 0) {
    sections.push(`**Stack**: ${contract.context.stack.join(', ')}`);
  }
  if (contract.context.files && contract.context.files.length > 0) {
    sections.push(`**Files**: ${contract.context.files.join(', ')}`);
  }

  return sections.join('\n');
}

module.exports = {
  buildContract,
  generateBrief
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node contract-builder.js "task description"');
    console.log('');
    console.log('Options:');
    console.log('  --domain <string>');
    console.log('  --priority <low|medium|high|critical>');
    console.log('  --project <string>');
    console.log('  --stack <comma-separated>');
    console.log('  --files <comma-separated>');
    console.log('  --requirements <comma-separated>');
    process.exit(0);
  }

  const task = args[0];
  const result = buildContract(task, {
    domain: args.find(a => a.startsWith('--domain='))?.split('=')[1],
    priority: args.find(a => a.startsWith('--priority='))?.split('=')[1],
    project: args.find(a => a.startsWith('--project='))?.split('=')[1]
  });

  result.brief = generateBrief(task, result);
  console.log(JSON.stringify(result, null, 2));
}
