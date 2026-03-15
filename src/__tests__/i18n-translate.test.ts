describe("i18n translate safety", () => {
  const originalDev = (globalThis as Record<string, unknown>).__DEV__;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = originalDev;
  });

  it("falls back to EN when a DE key is missing", () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;

    jest.isolateModules(() => {
      jest.doMock("@/i18n/messages/de", () => ({ deMessages: {} }));
      const { translate } = require("@/i18n/translate");
      expect(translate("de", "common.action.save")).toBe("Save");
    });
  });

  it("fails hard in development when interpolation params are missing", () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;

    jest.isolateModules(() => {
      const { translate } = require("@/i18n/translate");
      expect(() => translate("en", "settings.language.activeLabel")).toThrow(
        /Missing interpolation value/
      );
    });
  });

  it("logs and safely falls back in production when interpolation params are missing", () => {
    (globalThis as Record<string, unknown>).__DEV__ = false;

    jest.isolateModules(() => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const { translate } = require("@/i18n/translate");

      expect(translate("en", "settings.language.activeLabel")).toBe(
        "Current language: {{language}}"
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Missing interpolation value"));
    });
  });

  it("fails hard in development when EN key is missing", () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;

    jest.isolateModules(() => {
      const { translate } = require("@/i18n/translate");
      expect(() => translate("en", "missing.key")).toThrow(
        "Missing translation key in English catalog: missing.key"
      );
    });
  });

  it("renders key string in production when EN key is missing", () => {
    (globalThis as Record<string, unknown>).__DEV__ = false;

    jest.isolateModules(() => {
      const { translate } = require("@/i18n/translate");
      expect(translate("en", "missing.key")).toBe("missing.key");
    });
  });
});
