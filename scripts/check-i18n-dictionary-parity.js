const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.join(__dirname, "..");
const enPath = path.join(projectRoot, "src", "i18n", "messages", "en.ts");
const dePath = path.join(projectRoot, "src", "i18n", "messages", "de.ts");

function fail(message) {
  console.error(`i18n:parity FAILED - ${message}`);
  process.exit(1);
}

function readSourceFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing file: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function toPropertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return null;
}

function unwrapExpression(expression) {
  if (ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function extractCatalogKeys(filePath, exportName) {
  const source = readSourceFile(filePath);
  const keys = new Set();

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName) {
        continue;
      }
      if (!declaration.initializer) {
        fail(`${exportName} in ${filePath} is not an object literal.`);
      }
      const initializer = unwrapExpression(declaration.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) {
        fail(`${exportName} in ${filePath} is not an object literal.`);
      }

      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const key = toPropertyNameText(property.name);
        if (key) {
          keys.add(key);
        }
      }
    }
  }

  if (keys.size === 0) {
    fail(`Could not extract keys from ${exportName} in ${filePath}.`);
  }

  return keys;
}

function setDifference(left, right) {
  const out = [];
  for (const value of left) {
    if (!right.has(value)) {
      out.push(value);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

const enKeys = extractCatalogKeys(enPath, "enMessages");
const deKeys = extractCatalogKeys(dePath, "deMessages");

const missingInDe = setDifference(enKeys, deKeys);
const extraInDe = setDifference(deKeys, enKeys);

if (missingInDe.length > 0 || extraInDe.length > 0) {
  if (missingInDe.length > 0) {
    console.error("DE is missing keys:");
    for (const key of missingInDe) {
      console.error(`- ${key}`);
    }
  }
  if (extraInDe.length > 0) {
    console.error("DE has extra keys not in EN:");
    for (const key of extraInDe) {
      console.error(`- ${key}`);
    }
  }
  fail("EN and DE dictionaries are not in key parity.");
}

console.log(`i18n:parity PASSED (${enKeys.size} keys)`);
