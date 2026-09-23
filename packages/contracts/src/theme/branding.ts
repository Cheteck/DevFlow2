/**
 * Theme branding & assets.
 */

export interface ThemeAssets {
  /** Preview image or screenshot url. */
  preview?: string;
  fonts?: Array<{
    family: string;
    url: string;
    format?: string;
    weight?: number;
  }>;
  icons?: Array<{
    name: string;
    url: string;
  }>;
}

export interface BrandingProfile {
  logo?: string;
  colors?: {
    brand?: string;
    accent?: string;
    neutral?: string;
  };
}
