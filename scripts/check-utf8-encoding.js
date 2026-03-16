const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const rootsToScan = [
  path.join(projectRoot, "src"),
  path.join(projectRoot, "docs"),
  path.join(projectRoot, "scripts"),
];

const rootFilesToScan = [
  path.join(projectRoot, "app.json"),
  path.join(projectRoot, "package.json"),
  path.join(projectRoot, "tsconfig.json"),
  path.join(projectRoot, "README.md"),
  path.join(projectRoot, ".editorconfig"),
];

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".json", ".md", ".css", ".yml", ".yaml"]);
const ignoredDirectoryNames = new Set(["node_modules", ".git", ".expo", "dist"]);
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function fail(message) {
  console.error(`encoding:check FAILED - ${message}`);
  process.exit(1);
}

function isTextFile(filePath) {
  return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const out = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        out.push(...collectFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile() && isTextFile(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function validateUtf8File(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (hasUtf8Bom(bytes)) {
    fail(`UTF-8 BOM is not allowed: ${path.relative(projectRoot, filePath)}`);
  }

  let text;
  try {
    text = utf8Decoder.decode(bytes);
  } catch {
    fail(`Invalid UTF-8 byte sequence: ${path.relative(projectRoot, filePath)}`);
  }

  if (text.includes("\uFFFD")) {
    fail(
      `Replacement character (U+FFFD) found, possible mojibake: ${path.relative(projectRoot, filePath)}`
    );
  }
}

const filesFromRoots = rootsToScan.flatMap((root) => collectFiles(root));
const rootTextFiles = rootFilesToScan.filter((filePath) => fs.existsSync(filePath) && isTextFile(filePath));
const allFiles = [...new Set([...filesFromRoots, ...rootTextFiles])];

if (allFiles.length === 0) {
  fail("No files found to validate.");
}

for (const filePath of allFiles) {
  validateUtf8File(filePath);
}

console.log(`encoding:check PASSED (${allFiles.length} files)`);
