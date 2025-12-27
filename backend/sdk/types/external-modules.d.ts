/**
 * Type declarations for external modules not yet installed
 * These are placeholders for future functionality
 */

declare module 'jszip' {
  interface JSZip {
    file(name: string, data: string | Buffer | ArrayBuffer | Uint8Array): JSZip;
    folder(name: string): JSZip | null;
    generateAsync(options: { type: string; compression?: string }): Promise<Buffer>;
  }

  interface JSZipConstructor {
    new (): JSZip;
  }

  const JSZip: JSZipConstructor;
  export default JSZip;
}

declare module 'sharp' {
  interface Sharp {
    resize(width?: number, height?: number, options?: object): Sharp;
    toFormat(format: string, options?: object): Sharp;
    toBuffer(): Promise<Buffer>;
    metadata(): Promise<{ width?: number; height?: number; format?: string }>;
    png(options?: object): Sharp;
    jpeg(options?: object): Sharp;
    webp(options?: object): Sharp;
  }

  function sharp(input?: Buffer | string): Sharp;
  export default sharp;
}

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: {
      region: string;
      endpoint?: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
    });
    send(command: unknown): Promise<unknown>;
  }

  export class PutObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
      Body: Buffer | string;
      ContentType?: string;
      CacheControl?: string;
    });
  }

  export class DeleteObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
    });
  }

  export class HeadObjectCommand {
    constructor(input: {
      Bucket: string;
      Key: string;
    });
  }
}
