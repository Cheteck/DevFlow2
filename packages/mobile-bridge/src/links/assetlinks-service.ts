export interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

export interface AssetLinksConfig {
  packageName: string;
  sha256Fingerprints: string[];
}

/**
 * Service to generate Android Digital Asset Links (RFC & Google Standard)
 * Serves /.well-known/assetlinks.json to verify Android App Links ownership.
 */
export class AssetLinksService {
  private static config: AssetLinksConfig = {
    packageName: "io.mosaix.mobile",
    sha256Fingerprints: [
      // Standard Debug Keystore SHA-256 placeholder
      "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
      // Production Release Keystore SHA-256 placeholder
      "2A:3B:4C:5D:6E:7F:80:91:A2:B3:C4:D5:E6:F7:08:19:2A:3B:4C:5D:6E:7F:80:91:A2:B3:C4:D5:E6:F7:08:19",
    ],
  };

  /**
   * Updates configuration with the real application package name and SHA-256 fingerprints
   */
  public static configure(config: Partial<AssetLinksConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Generates the standard JSON array expected by Android OS
   */
  public static getAssetLinks(): AssetLinkStatement[] {
    return [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: this.config.packageName,
          sha256_cert_fingerprints: this.config.sha256Fingerprints,
        },
      },
    ];
  }
}
