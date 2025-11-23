export interface Character {
  id: string;
  name: string;
  description: string;
  imageBase64: string | null;
}

export interface Dialogue {
  speaker: string;
  text: string;
  type: 'speech' | 'shout' | 'thought' | 'narration';
}

export interface Panel {
  id: number;
  description: string; // Korean description for display
  visualPromptEn: string; // English visual prompt for the image generator
  dialogues: Dialogue[]; // List of dialogues
  charactersInPanel: string[]; // Names of characters in this panel
  panelSize: 'square' | 'wide' | 'tall'; // Layout hint
  imageUrl?: string; // The generated image URL
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export type StyleMode = 'bw' | 'color';
export type RenderMode = 'overlay' | 'native';

export interface Storyboard {
  title: string;
  coverImagePrompt: string; // Prompt for the cover/title image
  coverImageUrl?: string; // Generated cover image URL
  coverAspectRatio: 'landscape' | 'portrait'; // Aspect ratio for the cover
  panels: Panel[];
  styleMode: StyleMode;
  renderMode: RenderMode;
}

export interface ApiKeyStatus {
  hasKey: boolean;
  checking: boolean;
}

export type PageTemplate = 'dynamic' | 'webtoon' | 'four_koma';

export interface Bookmark {
  id: number;
  title: string;
  storyLog: string;
  characters: Character[];
  storyboard: Storyboard | null;
  date: string;
  styleMode: StyleMode;
  coverRatio: 'landscape' | 'portrait';
  pageTemplate: PageTemplate;
  renderMode?: RenderMode;
}

// Extend Window interface for AI Studio specific methods and html2canvas
declare global {
  interface Window {
    // aistudio is defined elsewhere with type AIStudio. 
    // We define interface AIStudio above to ensure methods exist via interface merging.
    html2canvas: (element: HTMLElement, options?: any) => Promise<HTMLCanvasElement>;
  }
}