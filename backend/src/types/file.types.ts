export interface UploadedFile {
  mimetype: string;
  size: number;
  name: string;
  data: Buffer;
  encoding: string;
  tempFilePath?: string;
  truncated: boolean;
  md5?: string;
  mv(path: string): Promise<void>;
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as string[];

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as string[];

export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, //10mb
  DOCUMENT: 15 * 1024 * 1024,
} as const;
