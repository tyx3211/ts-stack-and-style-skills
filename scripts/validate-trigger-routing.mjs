import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const fixturePath = path.join(import.meta.dirname, "fixtures", "trigger-routing.json");
const errors = [];

async function discoverEnglishSkills() {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.endsWith("-zh")) continue;
    try {
      if ((await stat(path.join(root, entry.name, "SKILL.md"))).isFile()) result.push(entry.name);
    } catch {
      // Ignore root infrastructure directories.
    }
  }
  return result.sort();
}

function validateExamples(skill, kind, language, examples) {
  if (!Array.isArray(examples) || examples.length === 0) {
    errors.push(`${skill}.${kind}.${language} must be a non-empty array`);
    return;
  }
  for (const [index, example] of examples.entries()) {
    if (typeof example !== "string" || example.trim().length < 8) {
      errors.push(`${skill}.${kind}.${language}[${index}] must be a concrete prompt of at least 8 characters`);
    }
  }
}

let fixtures;
try {
  fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
} catch (error) {
  console.error(`Cannot read UTF-8 routing fixtures at ${fixturePath}: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(fixtures.cases)) {
  console.error("Routing fixture must contain a cases array.");
  process.exit(1);
}

const skillNames = await discoverEnglishSkills();
const seen = new Set();
for (const fixture of fixtures.cases) {
  if (!fixture || typeof fixture.skill !== "string") {
    errors.push("every routing fixture must name a skill");
    continue;
  }
  if (seen.has(fixture.skill)) errors.push(`${fixture.skill} has duplicate routing fixtures`);
  seen.add(fixture.skill);
  for (const kind of ["positive", "negative"]) {
    for (const language of ["en", "zh"]) {
      validateExamples(fixture.skill, kind, language, fixture[kind]?.[language]);
    }
  }
}

for (const skillName of skillNames) {
  if (!seen.has(skillName)) errors.push(`${skillName} has no structured trigger-routing fixture`);
}
for (const fixtureSkill of seen) {
  if (!skillNames.includes(fixtureSkill)) errors.push(`${fixtureSkill} fixture has no matching English skill directory`);
}

if (!Array.isArray(fixtures.integratedCases) || fixtures.integratedCases.length === 0) {
  errors.push("routing fixture must contain at least one integratedCases entry");
} else {
  for (const [index, fixture] of fixtures.integratedCases.entries()) {
    for (const language of ["en", "zh"]) {
      if (typeof fixture.prompt?.[language] !== "string" || fixture.prompt[language].trim().length < 20) {
        errors.push(`integratedCases[${index}].prompt.${language} must be a concrete mixed prompt`);
      }
    }
    if (!Array.isArray(fixture.expectedSkills) || fixture.expectedSkills.length < 2) {
      errors.push(`integratedCases[${index}].expectedSkills must contain at least two skills`);
    } else {
      for (const skill of fixture.expectedSkills) {
        if (!skillNames.includes(skill)) errors.push(`integratedCases[${index}] names unknown skill ${skill}`);
      }
    }
    if (!Array.isArray(fixture.expectedReferences) || fixture.expectedReferences.length === 0) {
      errors.push(`integratedCases[${index}].expectedReferences must not be empty`);
    } else {
      for (const reference of fixture.expectedReferences) {
        try {
          if (!(await stat(path.join(root, ...reference.split("/")))).isFile()) throw new Error("not a file");
        } catch {
          errors.push(`integratedCases[${index}] references missing file ${reference}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Trigger-routing fixture validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated positive and negative EN/ZH routing coverage for ${skillNames.length} skills.`);
  console.log(`Validated ${fixtures.integratedCases.length} mixed multi-skill routing contract(s).`);
  console.log("This checks fixture structure only; it does not prove trigger quality or semantic correctness.");
}
