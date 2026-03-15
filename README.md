# orchestrator-lite

**Orquestrador enxuto para multi-agent tasks no OpenClaw**

Transforma rough task descriptions em structured agent briefs com layered context.

Baseado em patterns do [reprompter](https://github.com/AytuncYildizli/reprompter), sem flywheel/telemetry pesada.

## Features

- **Router**: Decide execution mode (single/parallel/sequential/ACP)
- **Contract Builder**: Transform rough task into structured brief
- **Context Builder**: Build layered context (contract + facts + references + artifacts)
- **Output Checker**: Validate agent output quality

## Quick Start

```javascript
const { orchestrate } = require('./index');

const result = orchestrate('build a REST API with authentication', {
  projectPath: './myproject',
  project: 'myproject'
});

console.log(result.brief);
console.log(result.execution.mode); // 'single' | 'parallel' | 'sequential' | 'acp'
```

## Installation

```bash
git clone https://github.com/agentxagi/orchestrator-lite.git
cd orchestrator-lite
npm install
```

## Usage Examples

### Single Agent Task
```javascript
const result = orchestrate('fix the login bug in auth.ts', {
  projectPath: './myproject'
});
// result.execution.mode = 'single'
```

### Multi-Agent Task
```javascript
const result = orchestrate('build frontend + backend + tests for user dashboard', {
  projectPath: './myproject'
});
// result.execution.mode = 'parallel'
```

### Sequential Pipeline
```javascript
const result = orchestrate('fetch data from API, process it, then save to database');
// result.execution.mode = 'sequential'
```

## Integration with OpenClaw

```javascript
const { orchestrate } = require('./orchestrator-lite');
const { sessions_spawn } = require('openclaw');

async function runTask(task, options) {
  const orchestration = orchestrate(task, options);
  
  if (orchestration.execution.mode === 'single') {
    return sessions_spawn({
      task: orchestration.brief,
      runtime: 'acp',
      agentId: 'claude'
    });
  } else if (orchestration.execution.mode === 'parallel') {
    const agents = orchestration.routing.domains.map(domain => ({
      runtime: 'acp',
      agentId: 'claude',
      task: `Handle ${domain} part: ${task}`
    }));
    
    return Promise.all(agents.map(a => sessions_spawn(a)));
  }
}
```

## Design Principles
1. **Simplicity first** - Each module is <200 lines
2. **Practical** - Built for real use, not demonstration
3. **OpenClaw-native** - Integrates with existing tools
4. **No overhead** - No flywheel, heavy telemetry, feature flags

## What we copied from reprompter
- Intent routing logic
- Task contract structure
- Layered context concept
- Output validation approach

## What we ignored from reprompter
- Flywheel engine (too complex)
- Heavy telemetry (premature optimization)
- Feature flags (unnecessary complexity)
- Benchmark harness (not needed for daily use)

## API Reference

### orchestrate(rawTask, options)

Transforms a rough task description into a structured execution plan.

**Parameters:**
- `rawTask` (string): The task description
- `options` (object):
  - `projectPath` (string): Path to project directory
  - `project` (string): Project name
  - `stack` (array): Technology stack
  - `files` (array): Relevant files
  - `constraints` (array): Task constraints
  - `requirements` (array): Task requirements

**Returns:**
- `routing` (object): Execution routing decision
- `contract` (object): Structured task contract
- `context` (object): Layered context
- `brief` (string): Human-readable brief
- `execution` (object): Execution plan
- `metadata` (object): Orchestration metadata

### validate(output, contract)

Validates agent output quality.

**Parameters:**
- `output` (string): Agent output to validate
- `contract` (object): Task contract

**Returns:**
- `passed` (boolean): Whether output meets quality threshold
- `score` (object): Quality scores
- `issues` (array): Issues found
- `recommendations` (array): Improvement suggestions

## Examples in the wild

### Tweet about orchestrator-lite
```
Just open-sourced orchestrator-lite 🎯

Problem: Multi-agent tasks were getting messy
Solution: 4-module system to route + brief + context + validate

orchestrate('build API with auth')
→ mode: single | parallel | sequential
→ brief: structured
→ context: layered

GitHub: https://github.com/agentxagi/orchestrator-lite

What would you add?
```

## Roadmap
- [ ] Integration examples with popular AI tools
- [ ] Brief templates library
- [ ] Performance metrics
- [ ] Multi-language support
- [ ] Web interface

## License
MIT

## Contributing
PRs welcome! Especially:
- Bug fixes
- Documentation improvements
- New templates
- Real-world usage examples

---

Built with ❤️ for the AI agents community
