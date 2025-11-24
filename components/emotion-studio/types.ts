
export type ImageQuality = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface EmotionOption {
  id: string;
  label: string;
  tags: string;
}

export interface GeneratedImage {
  id: string;
  emotionLabel: string;
  imageUrl: string | null;
  loading: boolean;
  error?: string;
}

export interface ReferenceImage {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

// Define window augmentation for AI Studio authentication
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}