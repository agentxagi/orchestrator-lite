# orchestrator-lite

**Orquestrador enxuto para multi-agent tasks no OpenClaw**

Transforma rough task descriptions em structured agent briefs com layered context.

Baseado em patterns do [reprompter](https://github.com/AytuncYildizli/reprompter), sem flywheel/telemetry pesada.

## Features

- **Router**: Decide execution mode (single/parallel/sequential/ACP)
- **Contract Builder**: Transforma rough task em structured brief
- **Context Builder**: Build layered context (contract + facts + references + artifacts)
- **Output Checker**: Validate agent output quality

## Quick Start

```javascript
const { orchestrate } = require('./orchestrator-lite');

const result = orchestrate('build a REST API with authentication', {
  projectPath: '/path/to/project',
  project: 'myproject',
  stack: ['node', 'typescript']
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
const result = orchestrate('fix the typo in header.tsx');
// result.execution.mode = 'single'
```

### Multi-Agent Task
```javascript
const result = orchestrate('build frontend + backend + tests for user dashboard', {
  projectPath: '/path/to/project'
});
// result.execution.mode = 'parallel'
```

### Sequential Pipeline
```javascript
const result = orchestrate('fetch data from API, process it, then deploy');
// result.execution.mode = 'sequential'
```

## Integration with OpenClaw

```javascript
const { orchestrate } = require('./orchestrator-lite');
const { spawn } = require('openclaw');

async function runTask(task, options) {
  const orchestration = orchestrate(task, options);
  
  if (orchestration.execution.mode === 'single') {
    return spawn({
      task: orchestration.brief,
      runtime: 'acp'
    });
  } else if (orchestration.execution.mode === 'parallel') {
    // Spawn multiple agents in parallel
    const agents = orchestration.routing.domains.map(domain => ({
      task: `Handle ${domain}: ${task}`,
      runtime: 'acp'
    }));
    
    return Promise.all(agents.map(a => spawn(a)));
  }
}
```

## Architecture

```
orchestrator-lite/
├── index.js              # Main entry point
├── router.js             # Decide execution mode
├── contract-builder.js   # Build structured brief
├── context-builder.js    # Build layered context
├── output-check.js       # Validate output quality
└── test.js              # Tests
```

## Design Principles

1. **Simplicity first** - Cada módulo <200 linhas
2. **Practical** - Feito para uso real, não demonstração
3. **OpenClaw-native** - Integra com tools existentes
4. **No overhead** - Sem flywheel, telemetry pesada, feature flags

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

## API

### `orchestrate(rawTask, options)`

**Parameters:**
- `rawTask` (string): Raw task description
- `options` (object):
  - `projectPath` (string): Path to project
  - `project` (string): Project name
  - `stack` (array): Tech stack
  - `forceMultiAgent` (boolean): Force multi-agent mode
  - `forceSingle` (boolean): Force single-agent mode

**Returns:**
- `routing`: Decision details
- `contract`: Structured task
- `context`: Layered context
- `brief`: Ready-to-use brief
- `execution`: Execution plan
- `metadata`: Orchestration metadata

### `validate(output, contract)`

**Parameters:**
- `output` (string): Agent output to validate
- `contract` (object): Task contract

**Returns:**
- `passed` (boolean): Whether output meets quality threshold
- `score` (object): Quality scores
- `recommendations` (array): Improvement suggestions

## Examples in the Wild

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
