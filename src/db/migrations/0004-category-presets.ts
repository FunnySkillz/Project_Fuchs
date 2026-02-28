export const MIGRATION_0004_CATEGORY_PRESETS = `
INSERT OR IGNORE INTO Category (
  Id,
  Name,
  SortOrder,
  IsPreset,
  DefaultUsefulLifeMonths
) VALUES
  ('preset-laptop-computer', 'Laptop/Computer', 10, 1, 36),
  ('preset-monitor', 'Monitor', 20, 1, NULL),
  ('preset-phone', 'Phone', 30, 1, NULL),
  ('preset-office-chair', 'Office Chair', 40, 1, NULL),
  ('preset-tools', 'Tools', 50, 1, NULL),
  ('preset-other', 'Other', 60, 1, NULL);
`;
