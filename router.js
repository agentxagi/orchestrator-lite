#!/usr/bin/env node
/**
 * orchestrator-lite/router.js
 * 
 * Decide execution mode: single / parallel / sequential / ACP
 * Based on task complexity, dependencies, and domain signals
 */

const MULTI_AGENT_TRIGGERS = [
  'parallel', 'in parallel', 'simultaneously', 'at the same time',
  'multiple agents', 'team of agents', 'swarm',
  'audit', 'review', 'analyze', 'comprehensive', 'end-to-end',
  'frontend + backend', 'api + database', 'infra + app',
  'campaign', 'launch', 'growth', 'multi-channel',
  'architecture', 'migration', 'refactor', 'test coverage'
];

const DOMAIN_KEYWORD_SETS = [
  { domain: 'frontend', keywords: ['frontend', 'ui', 'react', 'nextjs', 'next.js', 'vue', 'svelte'] },
  { domain: 'backend', keywords: ['backend', 'server', 'service', 'api', 'endpoint'] },
  { domain: 'database', keywords: ['database', 'db', 'schema', 'sql', 'postgres', 'mysql', 'mongodb'] },
  { domain: 'infrastructure', keywords: ['infra', 'infrastructure', 'deployment', 'kubernetes', 'docker', 'ci/cd'] },
  { domain: 'security', keywords: ['security', 'auth', 'authentication', 'vulnerability', 'pentest'] },
  { domain: 'testing', keywords: ['test', 'testing', 'unit test', 'integration test', 'coverage'] },
  { domain: 'devops', keywords: ['devops', 'pipeline', 'automation', 'monitoring', 'alerting'] },
  { domain: 'marketing', keywords: ['marketing', 'campaign', 'growth', 'seo', 'content', 'funnel'] },
  { domain: 'research', keywords: ['research', 'analysis', 'benchmark', 'compare', 'tradeoff'] }
];

const PIPELINE_TRIGGERS = [
  'then', 'after', 'followed by', 'pipeline', 'workflow',
  'step 1', 'step 2', 'first', 'second', 'finally',
  'fetch then', 'analyze then', 'build then deploy'
];

const ACP_TRIGGERS = [
  'codex', 'claude code', 'gemini', 'pi', 'acp',
  'coding agent', 'code agent', 'dev agent'
];

function normalize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasTerm(text, term) {
  const normalized = normalize(term);
  if (normalized.includes(' ')) {
    return text.includes(normalized);
  }
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return re.test(text);
}

function countDistinctDomains(text) {
  let count = 0;
  const domains = [];
  for (const set of DOMAIN_KEYWORD_SETS) {
    if (set.keywords.some(keyword => hasTerm(text, keyword))) {
      count++;
      domains.push(set.domain);
    }
  }
  return { count, domains };
}

function hasMultiAgentSignal(text) {
  return MULTI_AGENT_TRIGGERS.some(trigger => hasTerm(text, trigger));
}

function hasPipelineSignal(text) {
  return PIPELINE_TRIGGERS.some(trigger => hasTerm(text, trigger));
}

function hasACPsignal(text) {
  return ACP_TRIGGERS.some(trigger => hasTerm(text, trigger));
}

function routeIntent(rawTask, options = {}) {
  const text = normalize(rawTask);
  const { count: domainCount, domains } = countDistinctDomains(text);
  
  const hasMulti = hasMultiAgentSignal(text);
  const hasPipeline = hasPipelineSignal(text);
  const hasACP = hasACPsignal(text);
  
  // ACP routing (Codex, Claude Code, etc.)
  if (hasACP || options.forceACP) {
    return {
      mode: 'acp',
      runtime: options.runtime || 'acp',
      reason: 'acp-trigger-detected',
      domains,
      domainCount,
      confidence: 'high'
    };
  }
  
  // Single-agent: simple task, single domain, no complexity signals
  if (domainCount <= 1 && !hasMulti && !hasPipeline) {
    return {
      mode: 'single',
      runtime: options.runtime || 'openclaw',
      reason: 'simple-single-domain-task',
      domains,
      domainCount,
      confidence: 'high'
    };
  }
  
  // Pipeline: explicit sequential signals
  if (hasPipeline && !options.forceParallel) {
    return {
      mode: 'sequential',
      runtime: options.runtime || 'openclaw',
      reason: 'pipeline-dependencies-detected',
      domains,
      domainCount,
      confidence: 'medium'
    };
  }
  
  // Multi-agent parallel: 2+ domains or explicit multi signals
  if (domainCount >= 2 || hasMulti) {
    return {
      mode: 'parallel',
      runtime: options.runtime || 'openclaw',
      reason: domainCount >= 2 ? 'multi-domain-task' : 'multi-agent-keywords',
      domains,
      domainCount,
      confidence: 'high'
    };
  }
  
  // Default to single
  return {
    mode: 'single',
    runtime: options.runtime || 'openclaw',
    reason: 'default-single',
    domains,
    domainCount,
    confidence: 'low'
  };
}

module.exports = {
  routeIntent,
  countDistinctDomains,
  hasMultiAgentSignal,
  hasPipelineSignal,
  hasACPsignal
};

if (require.main === module) {
  const args = process.argv.slice(2).join(' ');
  if (!args) {
    console.log('Usage: node router.js "task description"');
    process.exit(1);
  }
  const result = routeIntent(args);
  console.log(JSON.stringify(result, null, 2));
}
