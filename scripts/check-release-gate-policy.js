const fs = require("node:fs");
const path = require("node:path");

const policyPath = path.join(__dirname, "..", "docs", "release", "release-gate-policy.json");

function fail(message) {
  console.error(`release:policy FAILED - ${message}`);
  process.exit(1);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value) {
  return isNonEmptyString(value) && /^https?:\/\/.+/i.test(value.trim());
}

function readPolicy() {
  if (!fs.existsSync(policyPath)) {
    fail(`Missing policy file at ${policyPath}`);
  }

  const raw = fs.readFileSync(policyPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON in release policy file: ${String(error)}`);
  }
}

const policy = readPolicy();

if (typeof policy.monetization_enabled !== "boolean") {
  fail("Field `monetization_enabled` must be boolean.");
}

if (policy.legal_profile !== "private_individual" && policy.legal_profile !== "trader") {
  fail("Field `legal_profile` must be `private_individual` or `trader`.");
}

if (typeof policy.legal_migration_complete !== "boolean") {
  fail("Field `legal_migration_complete` must be boolean.");
}

if (typeof policy.submission_ready !== "boolean") {
  fail("Field `submission_ready` must be boolean.");
}

if (typeof policy.rtl_supported_v1 !== "boolean") {
  fail("Field `rtl_supported_v1` must be boolean.");
}

if (policy.rtl_supported_v1 !== false) {
  fail("Field `rtl_supported_v1` must be false for v1.");
}

if (policy.export_content_language_policy !== "app_language_at_generation_time") {
  fail(
    "Field `export_content_language_policy` must be `app_language_at_generation_time`."
  );
}

if (typeof policy.export_filenames_localized !== "boolean") {
  fail("Field `export_filenames_localized` must be boolean.");
}

if (policy.export_filenames_localized !== false) {
  fail("Field `export_filenames_localized` must be false.");
}

if (typeof policy.dictionary_parity_check_passed !== "boolean") {
  fail("Field `dictionary_parity_check_passed` must be boolean.");
}

if (typeof policy.deep_links_localized_verified !== "boolean") {
  fail("Field `deep_links_localized_verified` must be boolean.");
}

if (typeof policy.accessibility_labels_localized_verified !== "boolean") {
  fail("Field `accessibility_labels_localized_verified` must be boolean.");
}

if (typeof policy.legal_text_semantic_sync_verified !== "boolean") {
  fail("Field `legal_text_semantic_sync_verified` must be boolean.");
}

if (typeof policy.language_ready_before_first_render_verified !== "boolean") {
  fail("Field `language_ready_before_first_render_verified` must be boolean.");
}

if (typeof policy.no_localized_flash_verified !== "boolean") {
  fail("Field `no_localized_flash_verified` must be boolean.");
}

if (typeof policy.manual_localization_qa_signed_off !== "boolean") {
  fail("Field `manual_localization_qa_signed_off` must be boolean.");
}

if (policy.monetization_enabled) {
  if (policy.legal_profile !== "trader") {
    fail("Monetization is enabled. `legal_profile` must be `trader`.");
  }
  if (!policy.legal_migration_complete) {
    fail("Monetization is enabled. `legal_migration_complete` must be true.");
  }
}

if (policy.submission_ready) {
  if (!isHttpUrl(policy.support_url)) {
    fail("`support_url` must be a valid http(s) URL when `submission_ready` is true.");
  }
  if (!isHttpUrl(policy.privacy_policy_url)) {
    fail("`privacy_policy_url` must be a valid http(s) URL when `submission_ready` is true.");
  }
  if (!isNonEmptyString(policy.app_review_contact_name)) {
    fail("`app_review_contact_name` is required when `submission_ready` is true.");
  }
  if (!isNonEmptyString(policy.app_review_contact_email)) {
    fail("`app_review_contact_email` is required when `submission_ready` is true.");
  }
  if (!isNonEmptyString(policy.app_review_contact_phone)) {
    fail("`app_review_contact_phone` is required when `submission_ready` is true.");
  }
  if (!policy.dictionary_parity_check_passed) {
    fail("`dictionary_parity_check_passed` must be true when `submission_ready` is true.");
  }
  if (!policy.deep_links_localized_verified) {
    fail("`deep_links_localized_verified` must be true when `submission_ready` is true.");
  }
  if (!policy.accessibility_labels_localized_verified) {
    fail("`accessibility_labels_localized_verified` must be true when `submission_ready` is true.");
  }
  if (!policy.legal_text_semantic_sync_verified) {
    fail("`legal_text_semantic_sync_verified` must be true when `submission_ready` is true.");
  }
  if (!policy.language_ready_before_first_render_verified) {
    fail(
      "`language_ready_before_first_render_verified` must be true when `submission_ready` is true."
    );
  }
  if (!policy.no_localized_flash_verified) {
    fail("`no_localized_flash_verified` must be true when `submission_ready` is true.");
  }
  if (!policy.manual_localization_qa_signed_off) {
    fail("`manual_localization_qa_signed_off` must be true when `submission_ready` is true.");
  }
}

console.log("release:policy PASSED");
