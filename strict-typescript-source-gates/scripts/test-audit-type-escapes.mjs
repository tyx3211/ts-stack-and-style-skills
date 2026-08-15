#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const audit = join(here, "audit-type-escapes.mjs");
const fixtures = join(here, "fixtures", "audit-type-escapes");

function run(files, ...options) {
  return spawnSync(process.execPath, [audit, "--json", "--deny-unreviewed", ...options, ...files.map((file) => join(fixtures, file))], {
    encoding: "utf8",
  });
}

const reviewed = run(["reviewed.ts"], "--compatibility-heuristics");
if (reviewed.status !== 0) throw new Error(`reviewed fixture failed:\n${reviewed.stdout}\n${reviewed.stderr}`);
const reviewedReport = JSON.parse(reviewed.stdout);
if (!/^6\.0\./.test(reviewedReport.parserVersion)) throw new Error("escape audit must report the pinned TypeScript 6 parser API");
const reviewedAssertions = reviewedReport.findings.filter((finding) => finding.category === "type-assertion");
if (reviewedAssertions.length !== 1) throw new Error("both as const assertion forms must be exempt");

const unreviewed = run(["unreviewed.ts", "unreviewed.d.mts"]);
if (unreviewed.status !== 1) throw new Error(`unreviewed fixture should exit 1:\n${unreviewed.stdout}\n${unreviewed.stderr}`);
const unreviewedReport = JSON.parse(unreviewed.stdout);
const categories = new Set(unreviewedReport.findings.map((finding) => finding.category));
for (const category of ["type-assertion", "non-null-assertion", "definite-assignment", "type-predicate", "assertion-signature", "overload-group", "generic-construct-signature", "generic-runtime-claim", "ts-directive", "lint-disable", "lint-disable-policy", "monkey-patch-clue", "ambient-declare", "module-or-global-augmentation", "declaration-merging", "declaration-file"]) {
  if (!categories.has(category)) throw new Error(`missing fixture category: ${category}`);
}

const heuristic = run(["unreviewed.ts"], "--compatibility-heuristics");
if (heuristic.status !== 1) throw new Error(`compatibility heuristic fixture should exit 1:\n${heuristic.stdout}\n${heuristic.stderr}`);
const heuristicCategories = new Set(JSON.parse(heuristic.stdout).findings.map((finding) => finding.category));
for (const category of ["method-bivariance-boundary", "open-arity-function-type"]) {
  if (!heuristicCategories.has(category)) throw new Error(`missing opt-in heuristic fixture category: ${category}`);
}
if (unreviewedReport.findings.filter((finding) => finding.category === "overload-group").length < 2) {
  throw new Error("fixtures must cover both function and call-signature overload groups");
}
if (!unreviewedReport.findings.some((finding) => finding.category === "monkey-patch-clue" && finding.summary.includes("global"))) {
  throw new Error("fixtures must cover Node global mutation");
}
if (!unreviewedReport.findings.some((finding) => finding.category === "monkey-patch-clue" && finding.summary.includes("safetyCannotApprovePatch") && !finding.reviewed)) {
  throw new Error("[SAFETY]: must not approve [TRUSTME]:-only global mutation");
}
if (!unreviewedReport.findings.some((finding) => finding.category === "type-assertion" && !finding.reviewed)) {
  throw new Error("[SAFETY]: text inside a string must not mark an assertion reviewed");
}
if (!unreviewedReport.findings.some((finding) => finding.category === "type-assertion" && finding.summary.includes("source as number") && !finding.reviewed)) {
  throw new Error("legacy unbracketed SAFETY labels must not mark an assertion reviewed");
}

console.log("audit-type-escapes self-test passed");
