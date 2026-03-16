# orchestrator-lite

**Orquestrador enxuto para multi-agent tasks no OpenClaw**

Transforma rough task descriptions em structured agent briefs com layered context.

Baseado em patterns do [reprompter](https://github.com/AytuncYildizli/reprompter), sem flywheel/telemetry pesada. Com módulos de loop control inspirados no [ralph-claude-code](https://github.com/frankbria/ralph-claude-code).

## Features

- **Router**: Decide execution mode (single/parallel/sequential/ACP)
- **Contract Builder**: Transform rough task into structured brief
- **Context Builder**: Build layered context (contract + facts + references + artifacts)
- **Output Checker**: Validate agent output quality
- **Circuit Breaker**: State machine (CLOSED→HALF_OPEN→OPEN) protege contra loops infinitos
- **Response Analyzer**: Detecta completion, stuck loops, questions, erros no output
- **Exit Detector**: Dual-condition exit gate — evita sair prematuramente

## Quick Start

### Single Task (sem loop)

```javascript
const { orchestrate } = require('./index');

const result = orchestrate('build a REST API with authentication', {
  projectPath: './myproject',
  project: 'myproject'
});

console.log(result.brief);
console.log(result.execution.mode); // 'single' | 'parallel' | 'sequential' | 'acp'
```

### Autonomous Loop (com circuit breaker + exit detection)

```javascript
const { orchestrateLoop } = require('./index');

const plan = orchestrateLoop('implement user dashboard with charts', {
  projectPath: './myproject',
  circuitBreaker: {
    noProgressThreshold: 3,
    cooldownMinutes: 30
  }
});

let loopNumber = 0;

while (true) {
  loopNumber++;

  // Build context for this iteration
  const ctx = plan.loop.buildLoopContext({
    loopNumber,
    remainingTasks: plan.contract.tasks?.filter(t => !t.done).length,
    circuitBreakerState: plan.loop.circuitBreaker.getState().state,
    previousSummary: ''
  });

  // Spawn agent...
  const agentOutput = await spawnAgent({ task: plan.brief + '\n\n' + ctx });

  // Process result
  const control = plan.loopControl.next({
    text: agentOutput,
    filesChanged: await getGitDiffCount('./myproject'),
    loopNumber,
    outputLength: agentOutput.length
  });

  console.log(`Loop #${loopNumber}: CB=${control.cbState}, exit=${control.exitReason || 'continue'}`);

  if (!control.continue) {
    console.log(`Stopped: ${control.exitReason || 'circuit_breaker_open'}`);
    break;
  }
}
```

### Standalone Modules

```javascript
const { CircuitBreaker, STATES } = require('./circuit-breaker');
const { analyzeResponse, buildLoopContext } = require('./response-analyzer');
const { ExitDetector } = require('./exit-detector');

// Circuit Breaker
const cb = new CircuitBreaker({ noProgressThreshold: 3 });
cb.record({ loopNumber: 1, filesChanged: 0, hasErrors: false });
console.log(cb.getState().state); // 'CLOSED'

// Response Analyzer
const analysis = analyzeResponse('All done! Ready for review.', { filesChanged: 2 });
console.log(analysis.exitSignal); // true

// Exit Detector
const ed = new ExitDetector();
ed.update({ hasCompletionSignal: true, exitSignal: true });
console.log(ed.shouldExit()); // { shouldExit: false, reason: null }
ed.update({ hasCompletionSignal: true, exitSignal: true });
console.log(ed.shouldExit()); // { shouldExit: true, reason: 'completion_signals' }
```

## Installation

```bash
git clone https://github.com/agentxagi/orchestrator-lite.git
cd orchestrator-lite
npm install
```

## Testing

```bash
# Test imports
node -e "require('./circuit-breaker'); require('./response-analyzer'); require('./exit-detector'); console.log('✅ All imports OK')"

# Run loop control tests
node test-loop.js
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  index.js (orchestrate / orchestrateLoop)        │
├─────────────────────────────────────────────────┤
│  router.js          - Intent routing             │
│  contract-builder.js - Task contracts            │
│  context-builder.js  - Layered context           │
│  output-check.js     - Quality validation        │
├─────────────────────────────────────────────────┤
│  circuit-breaker.js  - Loop protection (Ralph)   │
│  response-analyzer.js - Pattern detection (Ralph)│
│  exit-detector.js    - Dual-condition gate (Ralph)│
└─────────────────────────────────────────────────┘
```

### Circuit Breaker States

```
CLOSED ──(2 no-progress)──→ HALF_OPEN ──(no recovery)──→ OPEN
   ↑                            │                           │
   └────(progress detected)─────┘                           │
   └────(cooldown elapsed)─────────────────────────────────┘
```

| State | Meaning |
|-------|---------|
| **CLOSED** | Normal operation, everything fine |
| **HALF_OPEN** | Monitoring — 2+ loops without progress |
| **OPEN** | Circuit tripped — stop execution, wait for cooldown |

### Exit Detection Priorities

| Priority | Condition | Reason |
|----------|-----------|--------|
| 1 | N consecutive test-only loops | `test_saturation` |
| 2 | N consecutive done signals | `completion_signals` |
| 3 | N consecutive EXIT_SIGNAL=true | `safety_circuit_breaker` |
| 4 | 2+ completion indicators + explicit exit | `project_complete` |

## Integration with OpenClaw

```javascript
const { orchestrateLoop } = require('./orchestrator-lite');
const { sessions_spawn } = require('openclaw');

async function runAutonomousTask(task, projectPath) {
  const plan = orchestrateLoop(task, {
    projectPath,
    circuitBreaker: { noProgressThreshold: 3, cooldownMinutes: 30 }
  });

  let loop = 0;
  while (true) {
    loop++;
    const ctx = plan.loop.buildLoopContext({
      loopNumber: loop,
      circuitBreakerState: plan.loop.circuitBreaker.getState().state
    });

    const result = await sessions_spawn({
      task: plan.brief + '\n\n' + ctx,
      runtime: 'acp'
    });

    const control = plan.loopControl.next({
      text: result.output,
      filesChanged: 0, // enhance with git diff
      loopNumber: loop,
      outputLength: result.output?.length || 0
    });

    if (!control.continue) break;
  }
}
```

## Design Principles
1. **Simplicity first** - Each module is <200 lines
2. **Practical** - Built for real use, not demonstration
3. **OpenClaw-native** - Integrates with existing tools
4. **No overhead** - No flywheel, heavy telemetry, feature flags
5. **Loop safety** - Circuit breaker prevents infinite loops and token waste

## What we copied from reprompter
- Intent routing logic
- Task contract structure
- Layered context concept
- Output validation approach

## What we copied from ralph-claude-code
- Circuit breaker state machine (CLOSED/HALF_OPEN/OPEN)
- Dual-condition exit gate (prevents premature termination)
- Two-stage error filtering (avoids JSON field false positives)
- Question detection (anti-headless-pattern)
- Test-only loop detection

## What we ignored
- Claude Code coupling (we're agnostic)
- Bash/tooling specifics
- tmux monitor (OpenClaw already has it)
- Rate limiting (via OpenClaw gateway)
- Feature flags, flywheel, heavy telemetry

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

**Returns:** `{ routing, contract, context, brief, execution, metadata }`

### orchestrateLoop(rawTask, options)

Same as `orchestrate()` but adds loop control modules.

**Returns:** Same as `orchestrate()` plus `{ loop, loopControl }`

- `loop.circuitBreaker` — CircuitBreaker instance
- `loop.exitDetector` — ExitDetector instance
- `loop.analyzeResponse` — analyzeResponse function
- `loop.buildLoopContext` — buildLoopContext function
- `loopControl.next(iterationResult)` — Process one iteration, returns `{ continue, exitReason, cbState, analysis }`

### CircuitBreaker

| Method | Description |
|--------|-------------|
| `record(result)` | Record loop result, update state. Returns `true` if can continue |
| `canExecute()` | Check if circuit allows execution |
| `getState()` | Get current state object |
| `getStatus()` | Get human-readable status |
| `reset(reason)` | Manually reset to CLOSED |

### analyzeResponse(text, metadata)

Returns: `{ hasCompletionSignal, isTestOnly, isStuck, hasProgress, exitSignal, confidenceScore, workSummary, askingQuestions, questionCount, filesModified, outputLength }`

### ExitDetector

| Method | Description |
|--------|-------------|
| `update(analysis)` | Feed analysis result, track signals |
| `shouldExit(claudeExitSignal)` | Check if loop should exit |
| `checkPlanCompletion(tasks, isDone)` | Check if all tasks in a plan are done |
| `reset()` | Clear all tracked signals |

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
