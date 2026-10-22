/**
 * L01 «Підготовка» — налаштування публічного GitHub-репозиторію.
 * Запускається лише через `npm run lesson:check -- 1 --full` (потрібні `gh auth login` і remote origin).
 * Контракт: course/lesson-01/README.md, розділи «Підготовка» і «Контракт».
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const SOLUTION_PATTERN = 'refs/heads/lesson-*-solution';

/** `gh api <path>` з плейсхолдерами {owner}/{repo}, які gh бере з remote поточного репо. */
function ghApi<T>(path: string): T {
  const out = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github+json', path], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out) as T;
}

type Repo = {
  private: boolean;
  security_and_analysis?: Record<string, { status?: string } | undefined>;
};
type RulesetSummary = { id: number };
type Ruleset = {
  target?: string;
  enforcement?: string;
  bypass_actors?: unknown[];
  conditions?: { ref_name?: { include?: string[] } };
  rules?: { type: string }[];
};

describe('L01.S0 GitHub-репозиторій', () => {
  let repo: Repo;

  beforeAll(() => {
    repo = ghApi<Repo>('repos/{owner}/{repo}');
  });

  it('репозиторій публічний', () => {
    expect(repo.private).toBe(false);
  });

  it('secret scanning увімкнено', () => {
    expect(repo.security_and_analysis?.secret_scanning?.status).toBe('enabled');
  });

  it('push protection увімкнено', () => {
    expect(repo.security_and_analysis?.secret_scanning_push_protection?.status).toBe('enabled');
  });

  it(`ruleset забороняє створення ${SOLUTION_PATTERN} (активний, без bypass)`, () => {
    const summaries = ghApi<RulesetSummary[]>('repos/{owner}/{repo}/rulesets');
    const rulesets = summaries.map((s) => ghApi<Ruleset>(`repos/{owner}/{repo}/rulesets/${s.id}`));

    const matching = rulesets.filter(
      (r) =>
        r.target === 'branch' &&
        r.enforcement === 'active' &&
        (r.conditions?.ref_name?.include ?? []).includes(SOLUTION_PATTERN) &&
        (r.rules ?? []).some((rule) => rule.type === 'creation') &&
        (r.bypass_actors ?? []).length === 0,
    );

    expect(matching.length).toBeGreaterThanOrEqual(1);
  });
});
