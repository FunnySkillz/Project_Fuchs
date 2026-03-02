import fs from "node:fs";
import path from "node:path";

interface AppConfig {
  expo: {
    version: string;
    runtimeVersion?: { policy?: string };
    updates?: { url?: string };
    extra?: { eas?: { projectId?: string } };
    ios?: { bundleIdentifier?: string; buildNumber?: string };
    android?: { package?: string; versionCode?: number };
  };
}

interface EasConfig {
  cli?: { appVersionSource?: string };
  build?: {
    preview?: {
      distribution?: string;
      channel?: string;
      autoIncrement?: boolean;
      android?: { buildType?: string };
    };
    production?: {
      distribution?: string;
      channel?: string;
      autoIncrement?: boolean;
      android?: { buildType?: string };
    };
  };
}

interface PackageConfig {
  version: string;
  dependencies?: Record<string, string>;
}

function readJson<T>(relativePath: string): T {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as T;
}

describe("Release build config", () => {
  const appConfig = readJson<AppConfig>("app.json");
  const easConfig = readJson<EasConfig>("eas.json");
  const packageConfig = readJson<PackageConfig>("package.json");

  it("keeps stable iOS/Android identifiers", () => {
    expect(appConfig.expo.ios?.bundleIdentifier).toBe("com.funnyskillz.steuerfuchs");
    expect(appConfig.expo.android?.package).toBe("com.funnyskillz.steuerfuchs");
  });

  it("uses runtime/app version strategy for EAS updates and builds", () => {
    expect(easConfig.cli?.appVersionSource).toBe("remote");
    expect(appConfig.expo.runtimeVersion?.policy).toBe("appVersion");
    expect(appConfig.expo.version).toBe(packageConfig.version);
    expect(packageConfig.dependencies?.["expo-updates"]).toBeTruthy();
  });

  it("keeps preview and production build profiles release-ready", () => {
    expect(easConfig.build?.preview?.distribution).toBe("internal");
    expect(easConfig.build?.preview?.channel).toBe("preview");
    expect(easConfig.build?.preview?.autoIncrement).toBe(true);
    expect(easConfig.build?.preview?.android?.buildType).toBe("apk");

    expect(easConfig.build?.production?.distribution).toBe("store");
    expect(easConfig.build?.production?.channel).toBe("production");
    expect(easConfig.build?.production?.autoIncrement).toBe(true);
    expect(easConfig.build?.production?.android?.buildType).toBe("app-bundle");
  });

  it("uses remote native build numbers instead of local static values", () => {
    expect(appConfig.expo.ios?.buildNumber).toBeUndefined();
    expect(appConfig.expo.android?.versionCode).toBeUndefined();
  });

  it("binds updates url to configured EAS project id", () => {
    const projectId = appConfig.expo.extra?.eas?.projectId;
    expect(projectId).toBeTruthy();
    expect(appConfig.expo.updates?.url).toBe(`https://u.expo.dev/${projectId}`);
  });
});
