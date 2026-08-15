import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromRoot = createRequire(path.join(root, "package.json"));

function runPackageCli(packageJsonSpecifier, executable) {
  let packageJson;
  try {
    packageJson = requireFromRoot.resolve(packageJsonSpecifier);
  } catch (error) {
    throw new Error(`Missing project-local package ${packageJsonSpecifier}. Run npm install.`, {
      cause: error,
    });
  }
  const entryPoint = path.join(path.dirname(packageJson), "bin", executable);
  return execFileSync(process.execPath, [entryPoint, "--version"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

const ts7Cli = runPackageCli("@typescript/native/package.json", "tsc");
const ts6Cli = runPackageCli("typescript/package.json", "tsc6");
const ts6Api = requireFromRoot("typescript").version;

if (!/^Version 7\.0\./u.test(ts7Cli)) {
  throw new Error(`Expected the project-local tsc to be TypeScript 7.0.x, received: ${ts7Cli}`);
}
if (!/^Version 6\.0\./u.test(ts6Cli)) {
  throw new Error(`Expected the project-local tsc6 to be TypeScript 6.0.x, received: ${ts6Cli}`);
}
if (!/^6\.0\./u.test(ts6Api)) {
  throw new Error(`Expected the project-local TypeScript API to be 6.0.x, received: ${ts6Api}`);
}

console.log(`Toolchain baseline validated: ${ts7Cli}; ${ts6Cli}; TypeScript API ${ts6Api}.`);
