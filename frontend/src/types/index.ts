export interface BrandTag {
  id: string;
  brandName: string;
  productUrl: string;
  tags: string[];
  productName?: string;
  price?: string;
  currency?: string;
  notes?: string;
  source?: string;
}

export interface ImageBrandData {
  imageId: string;
  brandTag: BrandTag;
  createdAt: number;
}

export interface AppElementData {
  type: 'branded-image';
  brandTag: BrandTag;
}
