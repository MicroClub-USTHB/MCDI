#!/usr/bin/env tsx
/**
 * scripts/generate-issues.ts
 *
 * Reads CI artefacts produced by:
 *   npm run test:ci    → test-results.json  +  coverage/coverage-summary.json
 *   npm run lint:report → eslint-results.json
 *
 * Then writes per-date markdown issue files to docs/issues/YYYY-MM-DD/.
 *
 * Usage:
 *   npm run issues:report
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JestResult {
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTestSuites: number;
  numPassedTests: number;
  numFailedTests: number;
  numTotalTests: number;
  testResults: JestSuiteResult[];
}

interface JestSuiteResult {
  testFilePath: string;
  status: 'passed' | 'failed';
  testResults: JestTestResult[];
}

interface JestTestResult {
  fullName: string;
  status: 'passed' | 'failed' | 'pending';
  failureMessages: string[];
  duration?: number;
}

interface CoverageSummary {
  total: CoverageMetrics;
  [filePath: string]: CoverageMetrics;
}

interface CoverageMetrics {
  lines: CoverageEntry;
  statements: CoverageEntry;
  functions: CoverageEntry;
  branches: CoverageEntry;
}

interface CoverageEntry {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface EslintFile {
  filePath: string;
  errorCount: number;
  warningCount: number;
  messages: EslintMessage[];
}

interface EslintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
}

// ─── Feature map ─────────────────────────────────────────────────────────────

const MVP_FEATURES = ['F1', 'F2', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13'];

const FEATURE_MAP: Record<string, { name: string; pathKeywords: string[] }> = {
  F1:   { name: 'Discord OAuth Login',              pathKeywords: ['auth', 'oauth', 'discord/callback', 'login'] },
  F2:   { name: 'API Key Authentication',           pathKeywords: ['projects', 'api-key', 'api_key'] },
  F4:   { name: 'Member Data Access',               pathKeywords: ['member', 'members'] },
  F5:   { name: 'Member Synchronization',           pathKeywords: ['sync', 'member.factory'] },
  F6:   { name: 'Role-Based Permissions',           pathKeywords: ['permissions', 'role', 'permission'] },
  F7:   { name: 'Permission Checking API',          pathKeywords: ['permissions', 'check-permission', 'scope.util'] },
  F8:   { name: 'Server Registration',              pathKeywords: ['servers', 'server'] },
  F9:   { name: 'Multi-Server Member View',         pathKeywords: ['admin-members', 'cross-server'] },
  F10:  { name: 'Server-Scoped Permissions',        pathKeywords: ['permissions', 'project-scope', 'scope'] },
  F11:  { name: 'Server Synchronization',           pathKeywords: ['sync', 'sync-log', 'sync-change'] },
  F12:  { name: 'Server Access Control',            pathKeywords: ['projects-access', 'project-server', 'access'] },
  F13:  { name: 'Server Statistics & Dashboard',    pathKeywords: ['sync', 'stats', 'dashboard'] },
  F14:  { name: 'Session Management',               pathKeywords: ['session', 'auth/session'] },
  F15:  { name: 'Member Statistics',                pathKeywords: ['member', 'stats', 'statistics'] },
  F16:  { name: 'Role Management',                  pathKeywords: ['role', 'project-role'] },
  F17:  { name: 'Send Messages to Channels',        pathKeywords: ['discord', 'message', 'channel'] },
  F18:  { name: 'Read Channel Information',         pathKeywords: ['discord', 'channel'] },
  F19:  { name: 'Channel Message History',          pathKeywords: ['discord', 'history', 'messages'] },
  F20:  { name: 'Create Webhooks',                  pathKeywords: ['webhook', 'create'] },
  F21:  { name: 'Execute Webhooks',                 pathKeywords: ['webhook', 'execute'] },
  F22:  { name: 'Manage Webhooks',                  pathKeywords: ['webhook', 'manage'] },
  F23:  { name: 'Event Subscriptions',              pathKeywords: ['event', 'subscription', 'subscribe'] },
  F24:  { name: 'Event Delivery',                   pathKeywords: ['event', 'delivery', 'webhook'] },
  F25:  { name: 'Monitor System Usage',             pathKeywords: ['monitor', 'usage', 'metrics'] },
  F26:  { name: 'Audit Logging',                    pathKeywords: ['audit', 'log', 'project-server-access-audit'] },
  F27:  { name: 'API Documentation',                pathKeywords: ['swagger', 'openapi', 'docs'] },
  F28:  { name: 'Integration Packages',             pathKeywords: ['sdk', 'package', 'integration'] },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectFeatures(filePath: string, testName: string): string[] {
  const needle = (filePath + ' ' + testName).toLowerCase();
  const matched: string[] = [];

  for (const [featureId, { pathKeywords }] of Object.entries(FEATURE_MAP)) {
    if (pathKeywords.some((kw) => needle.includes(kw.toLowerCase()))) {
      matched.push(featureId);
    }
  }

  // Fallback: if nothing matched, tag as unclassified
  return matched.length > 0 ? [...new Set(matched)] : ['UNCLASSIFIED'];
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function formatPct(pct: number | undefined): string {
  if (pct === undefined || pct === null) return 'N/A';
  return `${pct.toFixed(1)}%`;
}

function coverageBadge(pct: number | undefined): string {
  if (pct === undefined) return '⚪';
  if (pct >= 80) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..');
const OUTPUT_DATE = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR  = join(ROOT, 'docs', 'issues', OUTPUT_DATE);

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Load artefacts
const jestResult = readJsonSafe<JestResult>(join(ROOT, 'test-results.json'));
const coverage   = readJsonSafe<CoverageSummary>(join(ROOT, 'coverage', 'coverage-summary.json'));
const eslintData = readJsonSafe<EslintFile[]>(join(ROOT, 'eslint-results.json'));

// ─── 2. Test failure report ───────────────────────────────────────────────────

function buildTestReport(): string {
  if (!jestResult) {
    return '# Test Failure Report\n\n> `test-results.json` not found. Run `npm run test:ci` first.\n';
  }

  const failedSuites = jestResult.testResults.filter((s) => s.status === 'failed');
  const featureIssues: Map<string, { featureId: string; tests: string[] }> = new Map();

  for (const suite of failedSuites) {
    const failedTests = suite.testResults.filter((t) => t.status === 'failed');
    for (const test of failedTests) {
      const features = detectFeatures(suite.testFilePath, test.fullName);
      for (const fid of features) {
        if (!featureIssues.has(fid)) featureIssues.set(fid, { featureId: fid, tests: [] });
        const entry = featureIssues.get(fid)!;
        const relPath = suite.testFilePath.replace(ROOT, '').replace(/^[\\/]/, '');
        entry.tests.push(`- **[${relPath}]** \`${test.fullName}\``);
      }
    }
  }

  const lines: string[] = [
    '# Test Failure Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total suites | ${jestResult.numTotalTestSuites} |`,
    `| Passed suites | ${jestResult.numPassedTestSuites} |`,
    `| Failed suites | ${jestResult.numFailedTestSuites} |`,
    `| Total tests | ${jestResult.numTotalTests} |`,
    `| Passed tests | ${jestResult.numPassedTests} |`,
    `| Failed tests | ${jestResult.numFailedTests} |`,
    '',
  ];

  if (featureIssues.size === 0) {
    lines.push('## ✅ All tests passed — no issues to report.');
    return lines.join('\n');
  }

  // MVP failures
  const mvpIssues = [...featureIssues.entries()].filter(([k]) => MVP_FEATURES.includes(k));
  const postMvpIssues = [...featureIssues.entries()].filter(([k]) => !MVP_FEATURES.includes(k));
  const unclassified = featureIssues.get('UNCLASSIFIED');

  if (mvpIssues.length > 0) {
    lines.push('## 🚨 MVP Failures');
    lines.push('');
    for (const [fid, { tests }] of mvpIssues) {
      const feat = FEATURE_MAP[fid];
      lines.push(`### ${fid}${feat ? ` — ${feat.name}` : ''}`);
      lines.push('');
      lines.push(...tests);
      lines.push('');
    }
  }

  if (postMvpIssues.length > 0) {
    lines.push('## ⚠️ Post-MVP Failures');
    lines.push('');
    for (const [fid, { tests }] of postMvpIssues) {
      const feat = FEATURE_MAP[fid];
      lines.push(`### ${fid}${feat ? ` — ${feat.name}` : ''}`);
      lines.push('');
      lines.push(...tests);
      lines.push('');
    }
  }

  if (unclassified) {
    lines.push('## ❓ Unclassified Failures');
    lines.push('');
    lines.push('These test failures could not be mapped to a known feature:');
    lines.push('');
    lines.push(...unclassified.tests);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── 3. Coverage report ───────────────────────────────────────────────────────

function buildCoverageReport(): string {
  if (!coverage) {
    return '# Code Coverage Report\n\n> `coverage/coverage-summary.json` not found. Run `npm run test:ci` first.\n';
  }

  const total = coverage.total;

  const lines: string[] = [
    '# Code Coverage Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Overall Coverage',
    '',
    `| Metric | Coverage | Status |`,
    `|--------|----------|--------|`,
    `| Lines | ${formatPct(total.lines.pct)} (${total.lines.covered}/${total.lines.total}) | ${coverageBadge(total.lines.pct)} |`,
    `| Statements | ${formatPct(total.statements.pct)} | ${coverageBadge(total.statements.pct)} |`,
    `| Functions | ${formatPct(total.functions.pct)} (${total.functions.covered}/${total.functions.total}) | ${coverageBadge(total.functions.pct)} |`,
    `| Branches | ${formatPct(total.branches.pct)} | ${coverageBadge(total.branches.pct)} |`,
    '',
    '## Low Coverage Files (< 50% line coverage)',
    '',
  ];

  const fileEntries = Object.entries(coverage)
    .filter(([key]) => key !== 'total')
    .filter(([, metrics]) => metrics.lines.pct < 50)
    .sort(([, a], [, b]) => a.lines.pct - b.lines.pct);

  if (fileEntries.length === 0) {
    lines.push('> ✅ All files meet the 50% minimum threshold.');
  } else {
    lines.push('| File | Lines | Functions | Branches |');
    lines.push('|------|-------|-----------|----------|');
    for (const [filePath, metrics] of fileEntries) {
      const rel = filePath.replace(ROOT, '').replace(/^[\\/]/, '');
      lines.push(
        `| \`${rel}\` | ${coverageBadge(metrics.lines.pct)} ${formatPct(metrics.lines.pct)} | ${formatPct(metrics.functions.pct)} | ${formatPct(metrics.branches.pct)} |`,
      );
    }
  }

  lines.push('');
  lines.push('## Coverage Threshold Status');
  lines.push('');

  const thresholds = [
    { label: 'Lines ≥ 80%',     pass: total.lines.pct >= 80,     actual: formatPct(total.lines.pct) },
    { label: 'Functions ≥ 80%', pass: total.functions.pct >= 80, actual: formatPct(total.functions.pct) },
    { label: 'Branches ≥ 70%',  pass: total.branches.pct >= 70,  actual: formatPct(total.branches.pct) },
  ];

  for (const t of thresholds) {
    lines.push(`- ${t.pass ? '✅' : '❌'} ${t.label}: **${t.actual}**`);
  }

  return lines.join('\n');
}

// ─── 4. ESLint report ─────────────────────────────────────────────────────────

function buildLintReport(): string {
  if (!eslintData) {
    return '# ESLint Report\n\n> `eslint-results.json` not found. Run `npm run lint:report` first.\n';
  }

  const filesWithIssues = eslintData.filter(
    (f) => f.errorCount > 0 || f.warningCount > 0,
  );

  const totalErrors   = filesWithIssues.reduce((sum, f) => sum + f.errorCount, 0);
  const totalWarnings = filesWithIssues.reduce((sum, f) => sum + f.warningCount, 0);

  const lines: string[] = [
    '# ESLint Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Files with issues | ${filesWithIssues.length} |`,
    `| Total errors | ${totalErrors} |`,
    `| Total warnings | ${totalWarnings} |`,
    '',
  ];

  if (filesWithIssues.length === 0) {
    lines.push('## ✅ No ESLint issues found.');
    return lines.join('\n');
  }

  // Group by rule
  const byRule: Map<string, { file: string; line: number; message: string }[]> = new Map();
  for (const file of filesWithIssues) {
    const rel = file.filePath.replace(ROOT, '').replace(/^[\\/]/, '');
    for (const msg of file.messages) {
      const rule = msg.ruleId ?? 'unknown';
      if (!byRule.has(rule)) byRule.set(rule, []);
      byRule.get(rule)!.push({ file: rel, line: msg.line, message: msg.message });
    }
  }

  lines.push('## Issues by Rule');
  lines.push('');

  for (const [rule, occurrences] of [...byRule.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### \`${rule}\` (${occurrences.length} occurrence${occurrences.length !== 1 ? 's' : ''})`);
    lines.push('');
    for (const o of occurrences.slice(0, 10)) {
      lines.push(`- \`${o.file}:${o.line}\` — ${o.message}`);
    }
    if (occurrences.length > 10) {
      lines.push(`- … and ${occurrences.length - 10} more`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── 5. Index / summary ──────────────────────────────────────────────────────

function buildIndex(): string {
  const lines: string[] = [
    `# MCDI Issue Report — ${OUTPUT_DATE}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Quick Status',
    '',
  ];

  if (jestResult) {
    const allPass = jestResult.numFailedTests === 0;
    lines.push(`### Tests ${allPass ? '✅ All passing' : '❌ Failures detected'}`);
    lines.push('');
    lines.push(`- ${jestResult.numPassedTests} / ${jestResult.numTotalTests} tests passed`);
    lines.push(`- ${jestResult.numPassedTestSuites} / ${jestResult.numTotalTestSuites} suites passed`);
    lines.push('');
  }

  if (coverage) {
    const t = coverage.total;
    lines.push('### Coverage');
    lines.push('');
    lines.push(`- Lines: ${coverageBadge(t.lines.pct)} **${formatPct(t.lines.pct)}**`);
    lines.push(`- Functions: ${coverageBadge(t.functions.pct)} **${formatPct(t.functions.pct)}**`);
    lines.push(`- Branches: ${coverageBadge(t.branches.pct)} **${formatPct(t.branches.pct)}**`);
    lines.push('');
  }

  if (eslintData) {
    const errors   = eslintData.reduce((s, f) => s + f.errorCount, 0);
    const warnings = eslintData.reduce((s, f) => s + f.warningCount, 0);
    const ok = errors === 0 && warnings === 0;
    lines.push(`### Lint ${ok ? '✅ Clean' : errors > 0 ? '❌ Errors' : '⚠️ Warnings'}`);
    lines.push('');
    lines.push(`- Errors: ${errors}`);
    lines.push(`- Warnings: ${warnings}`);
    lines.push('');
  }

  lines.push('## Reports');
  lines.push('');
  lines.push('| Report | File |');
  lines.push('|--------|------|');
  lines.push(`| Test Failures | [test-failures.md](test-failures.md) |`);
  lines.push(`| Coverage | [coverage.md](coverage.md) |`);
  lines.push(`| ESLint | [lint.md](lint.md) |`);

  return lines.join('\n');
}

// ─── Write files ─────────────────────────────────────────────────────────────

const reports: Record<string, string> = {
  'test-failures.md': buildTestReport(),
  'coverage.md':      buildCoverageReport(),
  'lint.md':          buildLintReport(),
  'index.md':         buildIndex(),
};

for (const [filename, content] of Object.entries(reports)) {
  const dest = join(OUTPUT_DIR, filename);
  writeFileSync(dest, content, 'utf8');
  console.log(`✅ Written: docs/issues/${OUTPUT_DATE}/${filename}`);
}

console.log(`\n📋 Reports saved to docs/issues/${OUTPUT_DATE}/`);
console.log('   Open docs/issues/' + OUTPUT_DATE + '/index.md to view the summary.');
