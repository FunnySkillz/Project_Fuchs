const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const roots = [
  path.join(projectRoot, 'src', 'app'),
  path.join(projectRoot, 'src', 'components'),
];

const ignorePathPattern = /(__tests__|__mocks__|\/i18n\/messages\/|\\i18n\\messages\\|\/db\/migrations\/|\\db\\migrations\\)/;
const attrNames = new Set(['placeholder', 'title']);

function collectFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (ignorePathPattern.test(fullPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      out.push(...collectFiles(fullPath));
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

function hasLetters(text) {
  return /[A-Za-z]/.test(text);
}

function shouldIgnoreText(text) {
  const normalized = text.trim();
  if (!normalized) {
    return true;
  }

  if (!hasLetters(normalized)) {
    return true;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return true;
  }

  if (/^[A-Z0-9_]+$/.test(normalized)) {
    return true;
  }

  return false;
}

function lineOf(sourceFile, pos) {
  const line = sourceFile.getLineAndCharacterOfPosition(pos).line;
  return line + 1;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  function pushFinding(node, type, text) {
    const value = text.trim();
    if (shouldIgnoreText(value)) {
      return;
    }

    findings.push({
      line: lineOf(sourceFile, node.getStart(sourceFile)),
      type,
      text: value,
    });
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      pushFinding(node, 'jsx-text', node.getText(sourceFile));
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (attrNames.has(name) && node.initializer && ts.isStringLiteral(node.initializer)) {
        pushFinding(node.initializer, `attr:${name}`, node.initializer.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function main() {
  const failOnFindings = process.argv.includes('--fail-on-findings');
  const files = roots.flatMap((root) => collectFiles(root));
  const report = [];

  for (const file of files) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      report.push({ file, findings });
    }
  }

  if (report.length === 0) {
    console.log('No hardcoded UI string findings.');
    return;
  }

  console.log('Potential hardcoded UI strings found:');
  for (const entry of report) {
    const relative = path.relative(projectRoot, entry.file).replace(/\\/g, '/');
    console.log(`\n- ${relative}`);
    const sample = entry.findings.slice(0, 20);
    for (const finding of sample) {
      console.log(`  L${finding.line} [${finding.type}] ${finding.text}`);
    }
    if (entry.findings.length > sample.length) {
      console.log(`  ... ${entry.findings.length - sample.length} more`);
    }
  }

  const total = report.reduce((sum, entry) => sum + entry.findings.length, 0);
  console.log(`\nTotal findings: ${total}`);

  if (failOnFindings) {
    process.exitCode = 1;
  }
}

main();
