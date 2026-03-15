# orchestrator-lite Examples

Examples of usage and integration with OpenClaw

## Example 1: Single-agent task
```bash
# Simple task
node /root/clawd/orchestrator-lite/index.js "fix the typo in header.tsx"
```

Result:
- Execution mode: single
- Runtime: openclaw
- Brief generated with contract, context, constraints

```

## Example 2: Multi-agent task
```bash
# Complex task
node /root/clawd/orchestrator-lite/index.js "build a full-stack feature with frontend and backend" --projectPath ./myproject
```

Result:
- Execution mode: parallel
- Runtime: openclaw
- Brief generated with:
  - Task breakdown
  - Domain detection
  - Context from project
```

## Example 3: Use with OpenClaw sessions_spawn
```javascript
const { orchestrate } = require('./orchestrator-lite');

const result = orchestrate('build a REST API with authentication', {
  projectPath: '/root/clawd',
  project: 'openclaw',
  stack: ['node', 'typescript']
});

// Get execution plan
console.log(result.brief);

// Spawn agents based on plan
if (result.execution.mode === 'single') {
  // Use sessions_spawn for single agent
  await sessions_spawn({
    task: result.brief,
    runtime: result.execution.runtime
  });
} else if (result.execution.mode === 'parallel') {
  // Spawn multiple agents
  const agents = splitTask(result.contract);
  for (const agent of agents) {
    await sessions_spawn({
      task: agent.brief,
      runtime: result.execution.runtime,
      label: agent.role
    });
  }
}
```

## Integration with memory
```javascript
const { orchestrate } = require('./orchestrator-lite');
const { memory_search } = require('./memory-tools');

// Build context with memory
const memory = await memory_search('similar tasks');
const result = orchestate('implement feature X', {
  projectPath: '/root/clawd',
  references: memory.map(m => m.snippet)
});

console.log(result.context);
```

## Example 4: Output validation
```javascript
const { orchestrate, validate } = require('./orchestrator-lite');

// Orchestrate task
const result = orchestrate('create API endpoint');

// ... execute agent and get output ...

// Validate output
const validation = validate(agentOutput, result.contract);
console.log(validation.passed ? '✅ Good' : '❌ Needs improvement');
console.log(validation.recommendations);
```
