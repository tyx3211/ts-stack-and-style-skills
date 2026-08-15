#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

const TRUSTME_CATEGORIES = new Set([
  "ambient-declare",
  "declaration-file",
  "declaration-merging",
  "module-or-global-augmentation",
  "monkey-patch-clue",
]);
const SOURCE_RE = /(?:\.d)?\.(?:[cm]?ts|tsx)$/i;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage"]);
const GENERIC_RUNTIME_CLAIM_NAMES = new Set([
  "decode", "deserialize", "fromJSON", "getItem", "invoke", "json", "parse",
  "query", "querySelector", "querySelectorAll", "raw", "request",
]);

function parseArgs(argv) {
  const options = { compatibilityHeuristics: false, denyUnreviewed: false, json: false, paths: [] };
  for (const arg of argv) {
    if (arg === "--deny-unreviewed") options.denyUnreviewed = true;
    else if (arg === "--compatibility-heuristics") options.compatibilityHeuristics = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--")) throw new Error(`unknown option: ${arg}`);
    else options.paths.push(arg);
  }
  if (options.paths.length === 0) options.paths.push("src");
  return options;
}

function printHelp() {
  console.log(`Usage: audit-type-escapes.mjs [--json] [--deny-unreviewed] [--compatibility-heuristics] <path...>

Inventories TypeScript trust/escape syntax. A nearby [SAFETY]:, [TRUSTME]:,
or [INDEX INVARIANT]: comment marks a finding as reviewed. Brackets and colon are required.
Compatibility heuristics report potentially risky declaration shapes with expected false positives.
This is not a proof.`);
}

function loadTypeScript() {
  let requireFromProject;
  try {
    requireFromProject = createRequire(join(process.cwd(), "package.json"));
  } catch (error) {
    throw new Error(`cannot create project-local module resolver: ${error.message}`);
  }

  let ts;
  try {
    ts = requireFromProject("typescript");
  } catch {
    throw new Error(
      "project-local TypeScript 6 compiler API not found; install " +
      '"typescript": "npm:@typescript/typescript6@6.0.2" (TS7 itself has no programmatic API)',
    );
  }
  if (!/^6\.0\./.test(ts.version ?? "")) {
    throw new Error(
      `unsupported project-local parser ${ts.version ?? "unknown"}; ` +
      "pin the TypeScript 6 compatibility API as the package named typescript",
    );
  }
  return ts;
}

function collectFiles(inputPaths) {
  const files = [];
  const visit = (item) => {
    const absolute = resolve(item);
    if (!existsSync(absolute)) throw new Error(`path not found: ${item}`);
    const stat = statSync(absolute);
    if (stat.isFile()) {
      if (SOURCE_RE.test(absolute)) files.push(absolute);
      return;
    }
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      visit(join(absolute, entry.name));
    }
  };
  inputPaths.forEach(visit);
  return [...new Set(files)].sort();
}

function auditFile(ts, file, options) {
  const text = readFileSync(file, "utf8");
  const kind = extname(file).toLowerCase() === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const findings = [];

  const comments = [];
  const reviewComments = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const position = scanner.getTokenPos();
    const lc = source.getLineAndCharacterOfPosition(position);
    const comment = scanner.getTokenText();
    const end = scanner.getTextPos();
    const endLine = source.getLineAndCharacterOfPosition(end).line;
    const labels = new Set(
      [...comment.matchAll(/\[(SAFETY|TRUSTME|INDEX\s+INVARIANT)\]\s*:/gi)].map((match) =>
        match[1].replace(/\s+/g, "").toUpperCase() === "INDEXINVARIANT"
          ? "INDEX"
          : match[1].replace(/\s+/g, "").toUpperCase().startsWith("TRUST")
            ? "TRUSTME"
            : "SAFETY"),
    );
    comments.push({ text: comment, start: position, end, line: lc.line, endLine, column: lc.character, labels });
    if (labels.size > 0) reviewComments.push({ start: position, end, startLine: lc.line, endLine, labels });
  }

  const labelAllows = (category, labels) => {
    if (TRUSTME_CATEGORIES.has(category)) return labels.has("TRUSTME");
    if (category === "non-null-assertion") return labels.has("INDEX") || labels.has("SAFETY");
    return labels.has("SAFETY") || labels.has("TRUSTME");
  };
  const reviewedAt = (pos, category) => {
    const line = source.getLineAndCharacterOfPosition(pos).line;
    return reviewComments.some((comment) => {
      if (!labelAllows(category, comment.labels)) return false;
      const leading = comment.end <= pos && (
        line === comment.endLine + 1 ||
        (line === comment.endLine && /^\s*$/.test(text.slice(comment.end, pos)))
      );
      const trailing = comment.start >= pos && comment.startLine === line;
      const contained = comment.start <= pos && pos <= comment.end;
      return leading || trailing || contained;
    });
  };
  const addAt = (category, pos, summary) => {
    const lc = source.getLineAndCharacterOfPosition(Math.max(0, pos));
    findings.push({
      file,
      line: lc.line + 1,
      column: lc.character + 1,
      category,
      summary,
      reviewed: reviewedAt(pos, category),
    });
  };

  const overloads = new Map();
  const overloadCandidate = (node) => {
    if (!(ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
          ts.isMethodSignature(node) || ts.isConstructorDeclaration(node) ||
          ts.isConstructSignatureDeclaration(node) || ts.isCallSignatureDeclaration(node))) return;
    const name = ts.isCallSignatureDeclaration(node)
      ? "<call>"
      : node.name?.getText(source) ?? "constructor";
    const owner = node.parent?.pos ?? 0;
    const key = `${node.kind}:${owner}:${name}`;
    const group = overloads.get(key) ?? [];
    group.push(node);
    overloads.set(key, group);
  };

  const declarations = new Map();
  const declarationCandidate = (node) => {
    if (!(ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node) ||
          ts.isFunctionDeclaration(node) || ts.isEnumDeclaration(node) ||
          ts.isModuleDeclaration(node)) || !node.name) return;
    const name = node.name.getText(source);
    const owner = node.parent?.pos ?? 0;
    const key = `${owner}:${name}`;
    const group = declarations.get(key) ?? [];
    group.push(node);
    declarations.set(key, group);
  };

  const isConstAssertion = (node) =>
    (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
    node.type.getText(source).trim() === "const";

  const assignmentOperator = (kindValue) => [
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
  ].includes(kindValue);

  const declarationFile = /\.d\.[cm]?ts$/i.test(file);
  const visit = (node) => {
    overloadCandidate(node);
    declarationCandidate(node);

    if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !isConstAssertion(node)) {
      addAt("type-assertion", node.getStart(source), node.getText(source).slice(0, 120));
    }
    if (ts.isNonNullExpression(node)) {
      addAt("non-null-assertion", node.getStart(source), node.getText(source).slice(0, 120));
    }
    if ((ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) && node.exclamationToken) {
      addAt("definite-assignment", node.exclamationToken.getStart(source), node.name.getText(source));
    }
    if (node.type && ts.isTypePredicateNode(node.type)) {
      addAt(node.type.assertsModifier ? "assertion-signature" : "type-predicate",
        node.type.getStart(source), node.type.getText(source));
    }
    if (options.compatibilityHeuristics && ts.isMethodSignature(node) && node.parameters.length > 0) {
      addAt("method-bivariance-boundary", node.getStart(source), node.getText(source).slice(0, 120));
    }
    if (options.compatibilityHeuristics && ts.isFunctionTypeNode(node) && node.parameters.some((parameter) =>
      parameter.questionToken ||
      (parameter.dotDotDotToken && parameter.type && !ts.isTupleTypeNode(parameter.type)))) {
      addAt("open-arity-function-type", node.getStart(source), node.getText(source).slice(0, 120));
    }
    if (ts.isConstructSignatureDeclaration(node) && (node.typeParameters?.length ?? 0) > 0) {
      addAt("generic-construct-signature", node.getStart(source), node.getText(source).slice(0, 120));
    }
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword) && !declarationFile) {
      addAt("ambient-declare", node.getStart(source), node.getText(source).split(/\r?\n/, 1)[0].slice(0, 120));
    }
    if (ts.isModuleDeclaration(node) &&
        (node.flags & ts.NodeFlags.GlobalAugmentation || ts.isStringLiteral(node.name))) {
      addAt("module-or-global-augmentation", node.getStart(source), node.name.getText(source));
    }
    if (ts.isBinaryExpression(node) && assignmentOperator(node.operatorToken.kind)) {
      const target = node.left.getText(source);
      if (/\.prototype\b|\[['"]prototype['"]\]/.test(target) || /^(?:globalThis|window|global|self)\b/.test(target)) {
        addAt("monkey-patch-clue", node.left.getStart(source), target.slice(0, 120));
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      const calleeName = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : ts.isIdentifier(node.expression)
          ? node.expression.text
          : "";
      if ((node.typeArguments?.length ?? 0) > 0 && GENERIC_RUNTIME_CLAIM_NAMES.has(calleeName)) {
        addAt("generic-runtime-claim", node.getStart(source), node.getText(source).slice(0, 120));
      }
      const target = node.arguments[0]?.getText(source) ?? "";
      if ((callee === "Object.setPrototypeOf" && target.length > 0) ||
          (["Object.assign", "Object.defineProperty", "Object.defineProperties", "Reflect.defineProperty", "Reflect.set"].includes(callee) &&
           (/\.prototype\b|\[['"]prototype['"]\]/.test(target) || /^(?:globalThis|window|global|self)\b/.test(target)))) {
        addAt("monkey-patch-clue", node.getStart(source), `${callee}(${target})`.slice(0, 120));
      }
    }
    ts.forEachChild(node, visit);
  };

  if (declarationFile) addAt("declaration-file", 0, "handwritten or generated declaration-file boundary");
  visit(source);

  for (const group of overloads.values()) {
    const withoutBody = group.filter((node) => !node.body);
    if (group.length > 1 && withoutBody.length > 0) {
      addAt("overload-group", group[0].getStart(source), `${group.length} related signatures/declarations`);
    }
  }

  for (const group of declarations.values()) {
    if (group.length < 2 || group.every((node) => ts.isFunctionDeclaration(node))) continue;
    const kinds = [...new Set(group.map((node) => ts.SyntaxKind[node.kind]))].join("+");
    addAt("declaration-merging", group[0].getStart(source), `${group.length} declarations (${kinds}) share one name`);
  }

  for (const comment of comments) {
    const directives = [...comment.text.matchAll(/@ts-(?:ignore|nocheck|expect-error)\b/gi)];
    for (const match of directives) {
      const pos = comment.start + (match.index ?? 0);
      findings.push({ file, line: comment.line + 1, column: comment.column + (match.index ?? 0) + 1,
        category: "ts-directive", summary: match[0], reviewed: reviewedAt(pos, "ts-directive") });
    }
    const lint = /(?:eslint|oxlint)-(disable-next-line|disable-line|disable)\b([^\r\n*]*)/i.exec(comment.text);
    if (lint) {
      const pos = comment.start + (lint.index ?? 0);
      findings.push({ file, line: comment.line + 1, column: comment.column + (lint.index ?? 0) + 1,
        category: "lint-disable", summary: comment.text.trim().slice(0, 160), reviewed: reviewedAt(pos, "lint-disable") });
      const rulesText = lint[2].split(/\s+--\s+/, 1)[0].trim();
      const rules = rulesText === "" ? [] : rulesText.split(/[\s,]+/).filter(Boolean);
      if (lint[1].toLowerCase() === "disable" || rules.length !== 1) {
        findings.push({ file, line: comment.line + 1, column: comment.column + (lint.index ?? 0) + 1,
          category: "lint-disable-policy", summary: "disable must be one exact rule on one line", reviewed: false });
      }
    }
    const inlineLint = /\beslint\s+[^:\r\n*]+:\s*(?:off|0)\b/i.exec(comment.text);
    if (inlineLint) {
      findings.push({ file, line: comment.line + 1, column: comment.column + (inlineLint.index ?? 0) + 1,
        category: "lint-disable-policy", summary: "inline ESLint severity override is not a one-line exact-rule exception", reviewed: false });
    }
  }

  return findings;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  const ts = loadTypeScript();
  const files = collectFiles(options.paths);
  const findings = files.flatMap((file) => auditFile(ts, file, options));
  const unreviewed = findings.filter((finding) => !finding.reviewed);

  if (options.json) {
    console.log(JSON.stringify({ parserVersion: ts.version, compatibilityHeuristics: options.compatibilityHeuristics, files: files.length, findings, unreviewed: unreviewed.length }, null, 2));
  } else {
    for (const finding of findings) {
      console.log(`${finding.reviewed ? "REVIEWED" : "UNREVIEWED"} ${finding.category} ${finding.file}:${finding.line}:${finding.column} ${finding.summary}`);
    }
    console.log(`Parser TypeScript ${ts.version}; scanned ${files.length} file(s); ${findings.length} finding(s); ${unreviewed.length} unreviewed.`);
  }
  if (options.denyUnreviewed && unreviewed.length > 0) process.exitCode = 1;
}

try { main(); } catch (error) {
  console.error(`audit-type-escapes: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
