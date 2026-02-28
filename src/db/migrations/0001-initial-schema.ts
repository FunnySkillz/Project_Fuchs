export const MIGRATION_0001_INITIAL_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ProfileSettings (
  Id TEXT PRIMARY KEY,
  TaxYearDefault INTEGER NOT NULL,
  MarginalRateBps INTEGER NOT NULL,
  DefaultWorkPercent INTEGER NOT NULL,
  GwgThresholdCents INTEGER NOT NULL,
  ApplyHalfYearRule INTEGER NOT NULL,
  Currency TEXT NOT NULL DEFAULT 'EUR',
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  DeletedAt TEXT NULL
);

CREATE TRIGGER IF NOT EXISTS TR_ProfileSettings_UpdatedAt
AFTER UPDATE ON ProfileSettings
FOR EACH ROW
WHEN NEW.UpdatedAt = OLD.UpdatedAt
BEGIN
  UPDATE ProfileSettings
  SET UpdatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE Id = OLD.Id;
END;

CREATE TABLE IF NOT EXISTS Category (
  Id TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  SortOrder INTEGER NOT NULL DEFAULT 0,
  IsPreset INTEGER NOT NULL DEFAULT 0,
  DefaultUsefulLifeMonths INTEGER NULL,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  DeletedAt TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS UX_Category_Name_NotDeleted
ON Category(Name)
WHERE DeletedAt IS NULL;

CREATE INDEX IF NOT EXISTS IX_Category_SortOrder
ON Category(SortOrder);

CREATE TRIGGER IF NOT EXISTS TR_Category_UpdatedAt
AFTER UPDATE ON Category
FOR EACH ROW
WHEN NEW.UpdatedAt = OLD.UpdatedAt
BEGIN
  UPDATE Category
  SET UpdatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE Id = OLD.Id;
END;

CREATE TABLE IF NOT EXISTS Item (
  Id TEXT PRIMARY KEY,
  Title TEXT NOT NULL,
  PurchaseDate TEXT NOT NULL,
  TotalCents INTEGER NOT NULL,
  Currency TEXT NOT NULL DEFAULT 'EUR',
  UsageType TEXT NOT NULL,
  WorkPercent INTEGER NULL,
  CategoryId TEXT NULL,
  Vendor TEXT NULL,
  WarrantyMonths INTEGER NULL,
  Notes TEXT NULL,
  UsefulLifeMonthsOverride INTEGER NULL,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  DeletedAt TEXT NULL,
  CONSTRAINT FK_Item_Category
    FOREIGN KEY (CategoryId) REFERENCES Category(Id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT CK_Item_UsageType
    CHECK (UsageType IN ('WORK','PRIVATE','MIXED','OTHER')),
  CONSTRAINT CK_Item_WorkPercent_Range
    CHECK (WorkPercent IS NULL OR (WorkPercent >= 0 AND WorkPercent <= 100)),
  CONSTRAINT CK_Item_TotalCents_Positive
    CHECK (TotalCents > 0)
);

CREATE INDEX IF NOT EXISTS IX_Item_PurchaseDate
ON Item(PurchaseDate);

CREATE INDEX IF NOT EXISTS IX_Item_CategoryId
ON Item(CategoryId);

CREATE INDEX IF NOT EXISTS IX_Item_UsageType
ON Item(UsageType);

CREATE INDEX IF NOT EXISTS IX_Item_NotDeleted
ON Item(DeletedAt);

CREATE TRIGGER IF NOT EXISTS TR_Item_UpdatedAt
AFTER UPDATE ON Item
FOR EACH ROW
WHEN NEW.UpdatedAt = OLD.UpdatedAt
BEGIN
  UPDATE Item
  SET UpdatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE Id = OLD.Id;
END;

CREATE TABLE IF NOT EXISTS Attachment (
  Id TEXT PRIMARY KEY,
  ItemId TEXT NOT NULL,
  Type TEXT NOT NULL,
  MimeType TEXT NOT NULL,
  FilePath TEXT NOT NULL,
  OriginalFileName TEXT NULL,
  FileSizeBytes INTEGER NULL,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  DeletedAt TEXT NULL,
  CONSTRAINT FK_Attachment_Item
    FOREIGN KEY (ItemId) REFERENCES Item(Id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT CK_Attachment_Type
    CHECK (Type IN ('RECEIPT','PHOTO'))
);

CREATE INDEX IF NOT EXISTS IX_Attachment_ItemId
ON Attachment(ItemId);

CREATE INDEX IF NOT EXISTS IX_Attachment_NotDeleted
ON Attachment(DeletedAt);

CREATE TRIGGER IF NOT EXISTS TR_Attachment_UpdatedAt
AFTER UPDATE ON Attachment
FOR EACH ROW
WHEN NEW.UpdatedAt = OLD.UpdatedAt
BEGIN
  UPDATE Attachment
  SET UpdatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE Id = OLD.Id;
END;

CREATE TABLE IF NOT EXISTS ExportRun (
  Id TEXT PRIMARY KEY,
  TaxYear INTEGER NOT NULL,
  ItemCount INTEGER NOT NULL,
  TotalDeductibleCents INTEGER NOT NULL,
  EstimatedRefundCents INTEGER NOT NULL,
  OutputType TEXT NOT NULL,
  OutputFilePath TEXT NULL,
  CreatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UpdatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  DeletedAt TEXT NULL,
  CONSTRAINT CK_ExportRun_OutputType
    CHECK (OutputType IN ('PDF','ZIP','PDF+ZIP'))
);

CREATE INDEX IF NOT EXISTS IX_ExportRun_TaxYear
ON ExportRun(TaxYear);

CREATE TRIGGER IF NOT EXISTS TR_ExportRun_UpdatedAt
AFTER UPDATE ON ExportRun
FOR EACH ROW
WHEN NEW.UpdatedAt = OLD.UpdatedAt
BEGIN
  UPDATE ExportRun
  SET UpdatedAt = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  WHERE Id = OLD.Id;
END;
`;
