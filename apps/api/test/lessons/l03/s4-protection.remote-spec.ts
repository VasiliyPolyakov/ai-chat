/**
 * L03.S4 — main is protected: the 6 CI checks are required and nobody can bypass them.
 * Accepts either a branch ruleset or classic branch protection.
 * Runs only via `npm run lesson:check -- 3 --full` (needs `gh auth login` and a GitHub origin).
 * Contract: milestone L03.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const REQUIRED_CHECKS = ['lint', 'typecheck', 'test', 'infra', 'gitleaks', 'smoke'];

function ghApi<T>(path: string): T | undefined {
  try {
    const out = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github+json', path], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out) as T;
  } catch {
    return undefined; // 404: no such protection/ruleset
  }
}

type RulesetSummary = { id: number };
type Ruleset = {
  target?: string;
  enforcement?: string;
  bypass_actors?: unknown[];
  conditions?: { ref_name?: { include?: string[]; exclude?: string[] } };
  rules?: {
    type: string;
    parameters?: { required_status_checks?: { context: string }[] };
  }[];
};
type Protection = {
  required_status_checks?: { contexts?: string[]; checks?: { context: string }[] };
  enforce_admins?: { enabled?: boolean };
};

/** Contexts required by an active, bypass-free ruleset that targets main. */
function rulesetContexts(): string[] {
  const summaries = ghApi<RulesetSummary[]>('repos/{owner}/{repo}/rulesets') ?? [];
  const contexts: string[] = [];
  for (const { id } of summaries) {
    const r = ghApi<Ruleset>(`repos/{owner}/{repo}/rulesets/${id}`);
    const include = r?.conditions?.ref_name?.include ?? [];
    const targetsMain =
      include.includes('~DEFAULT_BRANCH') ||
      include.includes('refs/heads/main') ||
      include.includes('~ALL');
    if (r?.target !== 'branch' || r.enforcement !== 'active' || !targetsMain) continue;
    if ((r.bypass_actors ?? []).length > 0) continue;
    for (const rule of r.rules ?? []) {
      if (rule.type !== 'required_status_checks') continue;
      for (const c of rule.parameters?.required_status_checks ?? []) contexts.push(c.context);
    }
  }
  return contexts;
}

/** Contexts required by classic branch protection with enforce_admins. */
function classicContexts(): string[] {
  const p = ghApi<Protection>('repos/{owner}/{repo}/branches/main/protection');
  if (!p?.enforce_admins?.enabled) return [];
  return [
    ...(p.required_status_checks?.contexts ?? []),
    ...(p.required_status_checks?.checks ?? []).map((c) => c.context),
  ];
}

describe('L03.S4 protection of main', () => {
  it('requires all 6 CI checks, without bypass (ruleset or classic protection + enforce_admins)', () => {
    const viaRuleset = REQUIRED_CHECKS.every((c) => rulesetContexts().includes(c));
    const viaClassic = REQUIRED_CHECKS.every((c) => classicContexts().includes(c));
    expect({ required: REQUIRED_CHECKS, protected: viaRuleset || viaClassic }).toEqual({
      required: REQUIRED_CHECKS,
      protected: true,
    });
  });
});
