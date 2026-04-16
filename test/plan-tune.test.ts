/**
 * /plan-tune tests (gate tier)
 *
 * Covers the foundation of /plan-tune v1:
 *   - Question registry schema validation
 *   - Registry completeness (every AskUserQuestion pattern has an id)
 *   - Id uniqueness (no duplicates)
 *   - One-way door safety declarations
 *   - Signal map references valid registry ids
 *
 * Binary-level tests (question-log, question-preference, developer-profile)
 * and migration tests live in sibling files created as those binaries ship.
 */

import { describe, test, expect } from 'bun:test';
import {
  QUESTIONS,
  getQuestion,
  getOneWayDoorIds,
  getAllRegisteredIds,
  getRegistryStats,
  type QuestionDef,
} from '../scripts/question-registry';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

// -----------------------------------------------------------------------
// Schema validation
// -----------------------------------------------------------------------

describe('question-registry schema', () => {
  test('every entry has required fields', () => {
    for (const [key, q] of Object.entries(QUESTIONS as Record<string, QuestionDef>)) {
      expect(q.id).toBeDefined();
      expect(q.skill).toBeDefined();
      expect(q.category).toBeDefined();
      expect(q.door_type).toBeDefined();
      expect(q.description).toBeDefined();
      expect(q.description.length).toBeGreaterThan(0);
      expect(q.id).toBe(key); // key and id must match
    }
  });

  test('all ids are kebab-case and start with skill name', () => {
    for (const q of Object.values(QUESTIONS as Record<string, QuestionDef>)) {
      expect(q.id).toMatch(/^[a-z0-9-]+$/);
      expect(q.id.startsWith(q.skill + '-')).toBe(true);
      expect(q.id.length).toBeLessThanOrEqual(64);
    }
  });

  test('no duplicate ids (keys and id fields are 1:1 by construction)', () => {
    const ids = Object.values(QUESTIONS as Record<string, QuestionDef>).map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('category is one of the allowed values', () => {
    const ALLOWED = new Set(['approval', 'clarification', 'routing', 'cherry-pick', 'feedback-loop']);
    for (const q of Object.values(QUESTIONS as Record<string, QuestionDef>)) {
      expect(ALLOWED.has(q.category)).toBe(true);
    }
  });

  test('door_type is one-way or two-way', () => {
    for (const q of Object.values(QUESTIONS as Record<string, QuestionDef>)) {
      expect(q.door_type === 'one-way' || q.door_type === 'two-way').toBe(true);
    }
  });

  test('options (if present) are non-empty arrays of strings', () => {
    for (const q of Object.values(QUESTIONS as Record<string, QuestionDef>)) {
      if (q.options) {
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThan(0);
        for (const opt of q.options) {
          expect(typeof opt).toBe('string');
          expect(opt.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('descriptions are short and informative (<= 200 chars, no newlines)', () => {
    for (const q of Object.values(QUESTIONS as Record<string, QuestionDef>)) {
      expect(q.description.length).toBeLessThanOrEqual(200);
      expect(q.description.includes('\n')).toBe(false);
    }
  });
});

// -----------------------------------------------------------------------
// Runtime helpers
// -----------------------------------------------------------------------

describe('question-registry helpers', () => {
  test('getQuestion returns entry for known id', () => {
    const q = getQuestion('ship-test-failure-triage');
    expect(q).toBeDefined();
    expect(q?.skill).toBe('ship');
    expect(q?.door_type).toBe('one-way');
  });

  test('getQuestion returns undefined for unknown id', () => {
    expect(getQuestion('this-is-not-registered')).toBeUndefined();
  });

  test('getOneWayDoorIds returns Set of one-way ids', () => {
    const ids = getOneWayDoorIds();
    expect(ids.has('ship-test-failure-triage')).toBe(true);
    expect(ids.has('review-sql-safety')).toBe(true);
    expect(ids.has('land-and-deploy-merge-confirm')).toBe(true);
    // And does NOT include a known two-way door:
    expect(ids.has('ship-changelog-voice-polish')).toBe(false);
  });

  test('getAllRegisteredIds count matches QUESTIONS keys', () => {
    expect(getAllRegisteredIds().size).toBe(Object.keys(QUESTIONS).length);
  });

  test('getRegistryStats totals are consistent', () => {
    const stats = getRegistryStats();
    expect(stats.total).toBe(Object.keys(QUESTIONS).length);
    expect(stats.one_way + stats.two_way).toBe(stats.total);
    const bySkillSum = Object.values(stats.by_skill).reduce((a, b) => a + b, 0);
    expect(bySkillSum).toBe(stats.total);
    const byCategorySum = Object.values(stats.by_category).reduce((a, b) => a + b, 0);
    expect(byCategorySum).toBe(stats.total);
  });
});

// -----------------------------------------------------------------------
// Safety contract — one-way doors
// -----------------------------------------------------------------------

describe('one-way door safety', () => {
  test('every destructive/security question is declared one-way', () => {
    // Safety-critical question ids must exist and be one-way.
    const mustBeOneWay = [
      'ship-test-failure-triage',         // shipping broken tests
      'review-sql-safety',                 // SQL injection path
      'review-llm-trust-boundary',         // LLM trust boundary
      'cso-global-scan-approval',          // scans outside branch
      'cso-finding-fix',                   // security finding
      'land-and-deploy-merge-confirm',     // actual merge
      'land-and-deploy-rollback',          // rollback decision
      'investigate-fix-apply',             // applying a fix
      'plan-ceo-review-premise-revise',    // changing agreed premise
      'plan-eng-review-arch-finding',      // architecture change
      'office-hours-landscape-privacy-gate',// sending data to search provider
      'autoplan-user-challenge',           // scope direction change
    ];
    const oneWayIds = getOneWayDoorIds();
    for (const id of mustBeOneWay) {
      expect(getQuestion(id)).toBeDefined();
      expect(oneWayIds.has(id)).toBe(true);
    }
  });

  test('at least 10 one-way doors are declared', () => {
    // Sanity check — if we lose one-way classification on critical questions,
    // this fails before safety bugs ship.
    expect(getOneWayDoorIds().size).toBeGreaterThanOrEqual(10);
  });
});

// -----------------------------------------------------------------------
// Coverage breadth — make sure we span the high-volume skills
// -----------------------------------------------------------------------

describe('registry breadth', () => {
  test('high-volume skills have at least one registered question', () => {
    const stats = getRegistryStats();
    const highVolume = [
      'ship',
      'review',
      'office-hours',
      'plan-ceo-review',
      'plan-eng-review',
      'plan-design-review',
      'plan-devex-review',
      'qa',
      'investigate',
      'land-and-deploy',
      'cso',
    ];
    for (const skill of highVolume) {
      expect(stats.by_skill[skill] ?? 0).toBeGreaterThan(0);
    }
  });

  test('preamble one-time prompts are registered (telemetry, proactive, routing)', () => {
    expect(getQuestion('preamble-telemetry-consent')).toBeDefined();
    expect(getQuestion('preamble-proactive-behavior')).toBeDefined();
    expect(getQuestion('preamble-routing-injection')).toBeDefined();
  });

  test('/plan-tune itself registers its enable + setup + mutation-confirm', () => {
    expect(getQuestion('plan-tune-enable-setup')).toBeDefined();
    expect(getQuestion('plan-tune-declared-dimension')).toBeDefined();
    expect(getQuestion('plan-tune-confirm-mutation')).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// Signal map consistency (created alongside registry)
// -----------------------------------------------------------------------

describe('psychographic signal map references', () => {
  test('signal_keys in registry are typed strings', () => {
    for (const q of Object.values(QUESTIONS as Record<string, QuestionDef>)) {
      if (q.signal_key !== undefined) {
        expect(typeof q.signal_key).toBe('string');
        expect(q.signal_key.length).toBeGreaterThan(0);
        expect(q.signal_key).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  // When scripts/psychographic-signals.ts ships, add a test that every
  // signal_key referenced in QUESTIONS has a matching entry in the signal map.
});

// -----------------------------------------------------------------------
// Registry completeness — warn about SKILL.md.tmpl AskUserQuestion calls
// that don't appear to map to any registry entry.
//
// This is NOT a strict CI failure. Many AskUserQuestion invocations are
// dynamic (agent generates question text at runtime), which is fine — the
// agent picks the best-fitting registry id or generates an ad-hoc id.
//
// The test reports a count for visibility. A future enhancement will scan
// for specific question_id references in template prose and require those
// referenced ids to exist in the registry.
// -----------------------------------------------------------------------

describe('AskUserQuestion template coverage (informational)', () => {
  test('count of templates using AskUserQuestion is non-trivial', () => {
    const templates = findAllTemplates();
    const usingAsk = templates.filter((p) =>
      fs.readFileSync(p, 'utf-8').includes('AskUserQuestion'),
    );
    // At the time of writing, ~35 templates reference AskUserQuestion.
    // This sanity check catches an accidental global removal.
    expect(usingAsk.length).toBeGreaterThan(20);
  });

  test('registry covers >= 10 skills from template files', () => {
    const stats = getRegistryStats();
    expect(Object.keys(stats.by_skill).length).toBeGreaterThanOrEqual(10);
  });
});

function findAllTemplates(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and dotfiles
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (entry.isFile() && entry.name === 'SKILL.md.tmpl') {
        results.push(full);
      }
    }
  }
  walk(ROOT);
  return results;
}
