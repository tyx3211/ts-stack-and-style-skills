import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const errors = [];
const textCache = new Map();
const textExtensions = new Set([".md", ".yaml", ".yml", ".json", ".mjs", ".js", ".ts"]);
const mojibakePattern = /\uFFFD|\u00C3[\u0080-\u00FF]|\u00C2[\u0080-\u00FF]|\u00E2[\u0080-\u00BF]{2}|\u00EF\u00BB\u00BF|\u951F\u65A4\u62F7|\u70EB\u70EB\u70EB/u;

function fail(location, message) {
  errors.push(`${location}: ${message}`);
}

async function readStrictUtf8(absolute, location) {
  if (textCache.has(absolute)) return textCache.get(absolute);
  try {
    const bytes = await readFile(absolute);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (mojibakePattern.test(text)) {
      fail(location, "contains a Unicode replacement character or a high-confidence mojibake marker");
    }
    textCache.set(absolute, text);
    return text;
  } catch (error) {
    fail(location, `is not valid UTF-8: ${error.message}`);
    textCache.set(absolute, null);
    return null;
  }
}

function countLines(text) {
  return text.length === 0 ? 0 : text.replace(/\r\n/g, "\n").split("\n").length;
}

function parseFrontmatter(text, location) {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    fail(location, "SKILL.md must start with YAML frontmatter");
    return new Map();
  }

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    fail(location, "frontmatter is not terminated by ---");
    return new Map();
  }

  const fields = new Map();
  for (const [index, rawLine] of normalized.slice(4, end).split("\n").entries()) {
    if (rawLine.trim() === "") continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.+)$/.exec(rawLine);
    if (!match) {
      fail(location, `unsupported frontmatter syntax on line ${index + 2}`);
      continue;
    }
    fields.set(match[1], match[2].trim().replace(/^(["'])(.*)\1$/, "$2"));
  }
  return fields;
}

function parseQuotedYamlField(text, field, location) {
  const match = new RegExp(`^\\s{2}${field}:\\s*(["'])(.*?)\\1\\s*$`, "m").exec(text);
  if (!match) {
    fail(location, `interface.${field} must exist and use a quoted scalar`);
    return "";
  }
  return match[2];
}

async function listFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      result.push(...await listFiles(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      result.push(relative);
    }
  }
  return result.sort();
}

async function scanRepositoryText(directory = root, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      await scanRepositoryText(absolute, relative);
    } else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const text = await readStrictUtf8(absolute, relative);
      if (text !== null && path.extname(entry.name).toLowerCase() === ".md") {
        const fenceCount = [...text.matchAll(/^```/gm)].length;
        if (fenceCount % 2 !== 0) fail(relative, `has an unbalanced fenced code block count: ${fenceCount}`);

        for (const match of text.matchAll(/\]\((?:<)?([^)>]+)(?:>)?\)/g)) {
          const rawTarget = match[1].split(/[?#]/, 1)[0];
          if (rawTarget === "" || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) continue;
          const target = rawTarget.replaceAll("/", path.sep);
          try {
            await stat(path.resolve(path.dirname(absolute), target));
          } catch {
            fail(relative, `linked local file does not exist: ${rawTarget}`);
          }
        }
      }
    }
  }
}

async function discoverSkills() {
  const skills = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(root, entry.name, "SKILL.md");
    try {
      if ((await stat(skillFile)).isFile()) skills.push(entry.name);
    } catch {
      // Root infrastructure directories are intentionally ignored.
    }
  }
  return skills.sort();
}

function validateReferenceLinks(skillName, text) {
  const linkPattern = /\]\((?:<)?([^)>]+)(?:>)?\)/g;
  const checks = [];
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1].split(/[?#]/, 1)[0].replaceAll("\\", "/");
    if (!target.startsWith("references/")) continue;
    const parts = target.split("/");
    if (parts.length !== 2 || parts.some((part) => part === "" || part === "." || part === "..")) {
      fail(`${skillName}/SKILL.md`, `reference links must be exactly one level below references/: ${target}`);
      continue;
    }
    checks.push({ target, absolute: path.join(root, skillName, ...parts) });
  }
  return checks;
}

await scanRepositoryText();

const skillNames = await discoverSkills();
if (skillNames.length === 0) fail("repository", "no top-level skill directories found");

for (const skillName of skillNames) {
  const skillPath = path.join(root, skillName);
  const skillLocation = `${skillName}/SKILL.md`;
  const skillText = await readStrictUtf8(path.join(skillPath, "SKILL.md"), skillLocation);
  if (skillText === null) continue;
  const lines = countLines(skillText);
  if (lines > 500) fail(skillLocation, `has ${lines} lines; maximum is 500`);

  const frontmatter = parseFrontmatter(skillText, skillLocation);
  const keys = [...frontmatter.keys()].sort();
  if (keys.join(",") !== "description,name") {
    fail(skillLocation, `frontmatter must contain only name and description; found: ${keys.join(", ") || "none"}`);
  }
  if (frontmatter.get("name") !== skillName) {
    fail(skillLocation, `frontmatter name must equal directory name ${skillName}`);
  }
  if (!frontmatter.get("description")) fail(skillLocation, "description must not be empty");

  for (const reference of validateReferenceLinks(skillName, skillText)) {
    try {
      if (!(await stat(reference.absolute)).isFile()) throw new Error("not a file");
    } catch {
      fail(skillLocation, `linked reference does not exist: ${reference.target}`);
    }
  }

  const metadataLocation = `${skillName}/agents/openai.yaml`;
  const metadataPath = path.join(skillPath, "agents", "openai.yaml");
  try {
    if (!(await stat(metadataPath)).isFile()) throw new Error("not a file");
  } catch {
    fail(metadataLocation, "required metadata file is missing or unreadable as UTF-8");
    continue;
  }
  const metadata = await readStrictUtf8(metadataPath, metadataLocation);
  if (metadata === null) continue;
  if (!/^interface:\s*$/m.test(metadata)) fail(metadataLocation, "top-level interface mapping is required");
  const displayName = parseQuotedYamlField(metadata, "display_name", metadataLocation);
  const shortDescription = parseQuotedYamlField(metadata, "short_description", metadataLocation);
  const defaultPrompt = parseQuotedYamlField(metadata, "default_prompt", metadataLocation);
  if ([...displayName].length === 0) fail(metadataLocation, "display_name must not be empty");
  const shortLength = [...shortDescription].length;
  if (shortLength < 25 || shortLength > 64) {
    fail(metadataLocation, `short_description must contain 25-64 characters; found ${shortLength}`);
  }
  if (!defaultPrompt.includes(`$${skillName}`)) {
    fail(metadataLocation, `default_prompt must mention $${skillName}`);
  }
}

const skillSet = new Set(skillNames);
for (const skillName of skillNames) {
  const counterpart = skillName.endsWith("-zh") ? skillName.slice(0, -3) : `${skillName}-zh`;
  if (!skillSet.has(counterpart)) {
    fail(skillName, `missing bilingual counterpart directory: ${counterpart}`);
    continue;
  }
  if (skillName.endsWith("-zh")) continue;
  const englishFiles = await listFiles(path.join(root, skillName));
  const chineseFiles = await listFiles(path.join(root, counterpart));
  if (englishFiles.join("\n") !== chineseFiles.join("\n")) {
    const englishOnly = englishFiles.filter((file) => !chineseFiles.includes(file));
    const chineseOnly = chineseFiles.filter((file) => !englishFiles.includes(file));
    fail(`${skillName} <-> ${counterpart}`, `file structures differ; EN-only=[${englishOnly.join(", ")}], ZH-only=[${chineseOnly.join(", ")}]`);
  }
  for (const relative of englishFiles.filter((file) => path.extname(file).toLowerCase() === ".md")) {
    const english = await readStrictUtf8(path.join(root, skillName, ...relative.split("/")), `${skillName}/${relative}`);
    const chinese = await readStrictUtf8(path.join(root, counterpart, ...relative.split("/")), `${counterpart}/${relative}`);
    if (english === null || chinese === null) continue;
    const englishFences = [...english.matchAll(/^```/gm)].length;
    const chineseFences = [...chinese.matchAll(/^```/gm)].length;
    if (englishFences !== chineseFences) {
      fail(`${skillName}/${relative} <-> ${counterpart}/${relative}`, `fenced code-block counts differ: ${englishFences} vs ${chineseFences}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Skill structure validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${skillNames.length} skill directories (${skillNames.length / 2} bilingual pairs).`);
}
