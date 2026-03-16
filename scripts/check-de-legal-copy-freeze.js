const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.join(__dirname, "..");
const dePath = path.join(projectRoot, "src", "i18n", "messages", "de.ts");

const expectedLegalStrings = {
  "settings.legal.title": "Rechtliches & Datenschutz",
  "settings.legal.subtitle":
    "Wichtiger Nutzungshinweis und Datenschutz-Zusammenfassung für SteuerFuchs.",
  "settings.legal.disclaimer.title": "Hinweis",
  "settings.legal.disclaimer.estimateOnly": "Keine Steuerberatung, nur Schätzwerte.",
  "settings.legal.disclaimer.body1":
    "SteuerFuchs bietet keine Rechts- oder Steuerberatung. Die App hilft dir beim Organisieren von Belegen, beim Schätzen des absetzbaren Anteils und beim Erstellen von Exportdateien auf Basis deiner lokalen Daten.",
  "settings.legal.disclaimer.body2":
    "Prüfe deine endgültige Steuererklärung immer mit offiziellen Vorgaben oder frage bei Bedarf eine zugelassene Beratung.",
  "settings.legal.privacy.title": "Datenschutzhinweis",
  "settings.legal.privacy.body1":
    "Deine Daten bleiben standardmäßig auf deinem Gerät (local-first). Keine Analytics-SDKs, keine Tracking-Pixel und kein Werbeprofiling.",
  "settings.legal.privacy.body2":
    "Die OneDrive-Integration ist optional und nur für Export gedacht. Dateien werden nur hochgeladen, wenn du Export auslöst und Upload aktiviert ist.",
  "settings.legal.privacy.contact": "Datenschutz/Support Kontakt: {{email}}",
  "settings.legal.permissions.title": "Berechtigungen",
  "settings.legal.permissions.camera": "Kamera: Belegfotos aufnehmen.",
  "settings.legal.permissions.files": "Fotos/Dateien: Belegbilder oder PDFs anhängen.",
  "settings.legal.permissions.noHiddenUploads": "Es gibt keine versteckten Hintergrund-Uploads.",
  "onboarding.welcome.disclaimerTitle": "Hinweis",
  "onboarding.welcome.disclaimerBody":
    "SteuerFuchs bietet keine Steuer- oder Rechtsberatung. Du bleibst für die finale Einreichung verantwortlich.",
};

function fail(message) {
  console.error(`legal:de:freeze FAILED - ${message}`);
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

function extractDeCatalogStrings(filePath) {
  const source = readSourceFile(filePath);
  const catalog = new Map();

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "deMessages") {
        continue;
      }
      if (!declaration.initializer) {
        fail("deMessages has no initializer.");
      }
      const initializer = unwrapExpression(declaration.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) {
        fail("deMessages is not an object literal.");
      }

      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const key = toPropertyNameText(property.name);
        if (!key) {
          continue;
        }
        if (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer)) {
          catalog.set(key, property.initializer.text);
        }
      }
    }
  }

  if (catalog.size === 0) {
    fail("Could not parse deMessages string entries.");
  }

  return catalog;
}

const deCatalog = extractDeCatalogStrings(dePath);

for (const [key, expectedValue] of Object.entries(expectedLegalStrings)) {
  if (!deCatalog.has(key)) {
    fail(`Missing legal key in DE catalog: ${key}`);
  }
  const actual = deCatalog.get(key);
  if (actual !== expectedValue) {
    fail(
      `Unexpected value for "${key}".\nExpected: ${expectedValue}\nActual:   ${actual}\n` +
        "Only orthography-safe updates are allowed in this release pass."
    );
  }
}

console.log(`legal:de:freeze PASSED (${Object.keys(expectedLegalStrings).length} keys locked)`);
