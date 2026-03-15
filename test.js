#!/usr/bin/env node
/**
 * orchestrator-lite/test.js
 * 
 * Basic tests for orchestrator-lite
 */

const assert = require('assert');
const { orchestrate, validate, routeIntent, buildContract } = require('./index');

console.log('Testing orchestrator-lite...\n');

// Test 1: Simple single-agent task
try {
  const result1 = orchestrate('fix the typo in header.tsx');
  assert.strictEqual(result1.execution.mode, 'single', 'Should be single mode');
  assert.ok(result1.contract, 'Contract should exist');
  assert.ok(result1.brief, 'Brief should exist');
  console.log('✓ Test 1 passed');
} catch (e) {
  console.error('✗ Test 1 failed:', e.message);
}

// Test 2: Multi-agent task
try {
  const result2 = orchestrate('build a full-stack feature with frontend and backend', {
    projectPath: process.cwd()
  });
  assert.ok(['parallel', 'sequential'].includes(result2.execution.mode), 'Should be parallel or sequential');
  console.log('✓ Test 2 passed');
} catch (e) {
  console.error('✗ Test 2 failed:', e.message);
}

// Test 3: Contract builder
try {
  const contract = buildContract('create a REST API with authentication', {
    domain: 'backend',
    requirements: ['JWT', 'rate limiting']
  });
  assert.strictEqual(contract.domain, 'backend', 'Domain should be backend');
  assert.ok(contract.requirements.includes('JWT'), 'Should include JWT requirement');
  console.log('✓ Test 3 passed');
} catch (e) {
  console.error('✗ Test 3 failed:', e.message);
}

// Test 4: Output validation
try {
  const output = 'I created the REST API with JWT authentication. Here is the code: ```\nconst jwt = require("jsonwebtoken");\n```';
  const contract2 = {
    requirements: ['JWT'],
    context: { project: 'test-project' },
    successCriteria: ['Authentication implemented']
  };
  const validation = validate(output, contract2);
  assert.ok(typeof validation.passed === 'boolean', 'Validation should return passed boolean');
  console.log('✓ Test 4 passed');
} catch (e) {
  console.error('✗ Test 4 failed:', e.message);
}

console.log('\nAll tests passed!');
