/**
 * Image Generation Module - Stub
 * Original module was removed during cleanup. These are minimal stubs
 * to satisfy imports from photoUpload modules.
 */

export interface ExtractProductInput {
  base64: string;
  mimeType: string;
}

export interface ExtractProductResult {
  imageBase64?: string;
  imageUrl?: string;
}

export interface ImageGenerator {
  extractProduct(input: ExtractProductInput): Promise<ExtractProductResult>;
}

export function createImageGenerator(): ImageGenerator {
  return {
    async extractProduct(_input: ExtractProductInput): Promise<ExtractProductResult> {
      throw new Error('Image generation module not configured. Set up OpenAI or equivalent provider.');
    },
  };
}
