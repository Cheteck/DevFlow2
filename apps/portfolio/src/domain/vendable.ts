export type VendableType =
  | "Product"
  | "Service"
  | "DigitalProduct"
  | "Experience";

export type WorkflowStatus =
  "Draft" | "In Review" | "Validated" | "Published" | "Archived";

export interface VendableIdentity {
  id: string;
  reference: string;
  type: VendableType;
  status: WorkflowStatus;
}

export interface LocalizedContent {
  name: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  keywords?: string[] | undefined;
}

export type VendableContent = Record<string, LocalizedContent>;

export interface VendableCharacteristics {
  attributes: Record<string, unknown>;
  specifications?: Record<string, unknown> | undefined;
}

export interface VendableClassification {
  categories?: string[] | undefined;
  tags?: string[] | undefined;
  collections?: string[] | undefined;
}

export interface MediaItem {
  id: string;
  type: "image" | "video" | "pdf" | "document";
  url: string;
  metadata?: Record<string, unknown> | undefined;
}

export type VendableMedia = MediaItem[];

export interface VariantItem {
  id: string;
  reference: string;
  content?: VendableContent | undefined;
  characteristics?: VendableCharacteristics | undefined;
  media?: VendableMedia | undefined;
}

export type VendableVariants = VariantItem[];

export type RelationType =
  | "compatible_with"
  | "complement_of"
  | "alternative_to"
  | "variant_of"
  | "replaces";

export interface RelationItem {
  targetId: string;
  type: RelationType;
  metadata?: Record<string, unknown> | undefined;
}

export type VendableRelations = RelationItem[];

export interface InformationQuality {
  completeness: number; // Percentage, e.g., 78
  missingFields: string[];
}

export interface Vendable {
  identity: VendableIdentity;
  content: VendableContent;
  characteristics: VendableCharacteristics;
  classification: VendableClassification;
  media: VendableMedia;
  variants: VendableVariants;
  relations: VendableRelations;
  quality?: InformationQuality | undefined;
}
