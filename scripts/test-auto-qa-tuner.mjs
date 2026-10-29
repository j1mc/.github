#!/usr/bin/env node
/**
 * Tests for auto-qa-tuner.mjs (tuna-os/.github#56).
 *
 * Dependency-free: uses only the node:test runner and node:assert/strict.
 * Run with: `node --test scripts/test-auto-qa-tuner.mjs`
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { EXIT_ATTENTION, EXIT_ERROR, EXIT_STEADY, formatReport, loadJson, tune, tuneGate, validateConfig } from "./auto-qa-tuner.mjs";

const TUNER = join(dirname(fileURLToPath(import.meta.url)), "auto-qa-tuner.mjs");

function gate(overrides = {}) {
  return {
    name: "example",
    workflow: "example-check.yml",
    alert_threshold: 0.2,
    min_threshold: 0.05,
    max_threshold: 0.5,
    ...overrides,
  };
}

function config(gates = [gate()]) {
  return { version: 1, window_days: 30, min_sample_runs: 5, step: 0.05, gates };
}

describe("tuneGate", () => {
  it("tightens one step when the gate is comfortably healthy", () => {
    const out = tuneGate(gate(), { runs: 20, failures: 0 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "tighten");
    assert.equal(out.proposed, 0.15);
    assert.equal(out.rate, 0);
  });

  it("never tightens by more than one step per run", () => {
    const out = tuneGate(gate({ alert_threshold: 0.5 }), { runs: 100, failures: 0 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "tighten");
    assert.equal(out.proposed, 0.45);
  });

  it("is steady when the observed rate sits at the threshold headroom", () => {
    // rate + step == threshold -> candidate == threshold -> no change.
    const out = tuneGate(gate(), { runs: 20, failures: 3 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.rate, 0.15);
    assert.equal(out.status, "steady");
    assert.equal(out.proposed, 0.2);
  });

  it("holds the threshold and reports a breach when the rate exceeds it", () => {
    const out = tuneGate(gate(), { runs: 10, failures: 5 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "breach");
    assert.equal(out.proposed, 0.2);
  });

  it("treats a rate exactly at the threshold as steady, not a breach", () => {
    const out = tuneGate(gate(), { runs: 10, failures: 2 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "steady");
  });

  it("never tightens below min_threshold", () => {
    const g = gate({ alert_threshold: 0.06, min_threshold: 0.05 });
    const out = tuneGate(g, { runs: 20, failures: 0 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "tighten");
    assert.equal(out.proposed, 0.05);
    const again = tuneGate({ ...g, alert_threshold: out.proposed }, { runs: 20, failures: 0 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(again.status, "steady");
    assert.equal(again.proposed, 0.05);
  });

  it("reports insufficient-data below the sample minimum", () => {
    const out = tuneGate(gate(), { runs: 4, failures: 4 }, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "insufficient-data");
    assert.equal(out.proposed, 0.2);
  });

  it("treats a missing observation as zero runs", () => {
    const out = tuneGate(gate(), undefined, { minSampleRuns: 5, step: 0.05 });
    assert.equal(out.status, "insufficient-data");
    assert.equal(out.rate, 0);
  });
});

describe("tune", () => {
  it("ignores observations for gates the config no longer tracks", () => {
    const result = tune(config(), { example: { runs: 10, failures: 0 }, retired: { runs: 10, failures: 10 } });
    assert.equal(result.gates.length, 1);
  });

  it("flags needsAttention on breach or tighten, but not when steady", () => {
    assert.equal(tune(config(), { example: { runs: 10, failures: 5 } }).needsAttention, true);
    assert.equal(tune(config(), { example: { runs: 10, failures: 0 } }).needsAttention, true);
    assert.equal(tune(config(), { example: { runs: 2, failures: 0 } }).needsAttention, false);
  });

  it("rejects configs with inverted bounds", () => {
    assert.throws(() => validateConfig(config([gate({ alert_threshold: 0.6, max_threshold: 0.5 })])), /min_threshold <= alert_threshold <= max_threshold/);
  });

  it("rejects duplicate gate names", () => {
    assert.throws(() => validateConfig(config([gate(), gate()])), /duplicate gate name/);
  });

  it("rejects observations where failures exceed runs", () => {
    assert.throws(() => tune(config(), { example: { runs: 1, failures: 2 } }), /cannot exceed runs/);
  });

  it("rejects non-object observations", () => {
    assert.throws(() => tune(config(), []), /must be a JSON object/);
  });
});

describe("formatReport", () => {
  it("renders a markdown table with one row per gate", () => {
    const result = tune(config([gate(), gate({ name: "other" })]), {
      example: { runs: 10, failures: 0 },
      other: { runs: 1, failures: 0 },
    });
    const report = formatReport(result, config());
    assert.match(report, /\| example \| 10 \| 0 \| 0\.00 \| 0\.20 \| 0\.15 \| tighten \|/);
    assert.match(report, /\| other \| 1 \| 0 .*\| insufficient-data \|/);
  });
});

describe("CLI", () => {
  function runCli({ cfg, obs, extra = [] }) {
    const dir = mkdtempSync(join(tmpdir(), "auto-qa-"));
    const cfgPath = join(dir, "tuning.json");
    const obsPath = join(dir, "observations.json");
    writeFileSync(cfgPath, JSON.stringify(cfg));
    writeFileSync(obsPath, JSON.stringify(obs));
    const proc = spawnSync(process.execPath, [TUNER, "--config", cfgPath, "--observations", obsPath, ...extra], {
      encoding: "utf8",
    });
    return { proc, cfgPath };
  }

  it("exits steady with no changes when all gates are quiet", () => {
    const { proc } = runCli({ cfg: config(), obs: { example: { runs: 2, failures: 0 } } });
    assert.equal(proc.status, EXIT_STEADY);
    assert.match(proc.stdout, /no tuning change proposed/);
  });

  it("exits attention and --apply rewrites thresholds in place", () => {
    const { proc, cfgPath } = runCli({
      cfg: config(),
      obs: { example: { runs: 20, failures: 0 } },
      extra: ["--apply"],
    });
    assert.equal(proc.status, EXIT_ATTENTION);
    const updated = loadJson(cfgPath);
    assert.equal(updated.gates[0].alert_threshold, 0.15);
    assert.match(proc.stdout, /updated example: 0\.20 -> 0\.15/);
    // The rewritten file stays valid for the next run.
    assert.doesNotThrow(() => validateConfig(updated));
  });

  it("exits error on missing input files", () => {
    const proc = spawnSync(process.execPath, [TUNER, "--config", "/nonexistent/a.json", "--observations", "/nonexistent/b.json"], {
      encoding: "utf8",
    });
    assert.equal(proc.status, EXIT_ERROR);
    assert.match(proc.stderr, /cannot read JSON/);
  });

  it("exits error on unknown flags", () => {
    const proc = spawnSync(process.execPath, [TUNER, "--frobnicate"], { encoding: "utf8" });
    assert.equal(proc.status, EXIT_ERROR);
  });

  it("writes a --report file matching stdout", () => {
    const dir = mkdtempSync(join(tmpdir(), "auto-qa-"));
    const reportPath = join(dir, "report.md");
    const { proc } = runCli({ cfg: config(), obs: { example: { runs: 10, failures: 5 } }, extra: ["--report", reportPath] });
    assert.equal(proc.status, EXIT_ATTENTION);
    assert.equal(readFileSync(reportPath, "utf8"), proc.stdout);
  });
});
