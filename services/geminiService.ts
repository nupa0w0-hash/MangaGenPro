import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Character, Panel, Storyboard, StyleMode, RenderMode } from "../types";

// We need to initialize the client dynamically to ensure we pick up the user-selected key
const getAiClient = () => {
  const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key is missing. Please set it in the settings.");
    // Fallback or throw error, but throwing allows the UI to handle it if caught
    // However, in this app flow, we check for key before calling service usually.
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

// Helper for retry logic with exponential backoff
async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 2000): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check for 503 Service Unavailable or "overloaded" message
      // The error object structure can vary, checking common paths
      const errorCode = error?.status || error?.code || error?.error?.code;
      const errorMessage = error?.message || error?.error?.message || "";
      
      const isOverloaded = 
        errorCode === 503 || 
        errorMessage.includes("overloaded") || 
        errorMessage.includes("UNAVAILABLE");

      if (isOverloaded) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`Model overloaded (Attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not an overloaded error, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

// Model Constants
const STORY_MODEL = "gemini-3-pro-preview";
const IMAGE_MODEL = "gemini-3-pro-image-preview"; // Nano Banana Pro

export const generateStoryboard = async (
  storyLog: string,
  characters: Character[],
  coverAspectRatio: 'landscape' | 'portrait',
  styleMode: StyleMode,
  customStyle: string,
  renderMode: RenderMode = 'overlay',
  panelCount: number | 'unlimited' = 8
): Promise<Storyboard> => {
  const ai = getAiClient();

  const characterContext = characters
    .map((c) => `- Name: "${c.name}", Description: ${c.description}`)
    .join("\n");

  const styleInstruction = styleMode === 'bw' 
    ? "Japanese Manga Style (Black and White, Screen Tones, High Contrast)" 
    : styleMode === 'color'
    ? "Korean Webtoon Style (Full Color, Vibrant, Digital Art, Clean Lines)"
    : customStyle;

  const panelCountInstruction = panelCount === 'unlimited'
    ? "스토리를 아주 상세하게 표현하여 **최소 31컷 이상**으로 구성하세요. 컷 수에 상한선은 없습니다."
    : `스토리를 정확히 **${panelCount}컷**으로 구성하세요.`;

  const prompt = `
    You are a genius comic director. Your task is to adapt the provided story into a visually compelling manga storyboard, focusing on professional manga techniques for narrative pacing, emotional emphasis, and cinematic camera work.

    [Character List]
    ${characterContext}
    
    [Story Log]
    ${storyLog}
    
    [Directing Guidelines]
    1.  **Narrative Pacing & Flow:** Analyze the story's rising action, climax, and resolution. Allocate panels to build tension, linger on emotional moments, and deliver impactful revelations. Ensure a smooth, logical flow from one panel to the next, avoiding abrupt jumps.
    2.  **Emotional Emphasis:** Use panel size and camera angles to amplify the characters' emotions. For instance, use a large, tall panel with a low-angle shot for a triumphant moment, or a series of small, tight close-ups for a rapidly escalating argument.
    3.  **Cinematic Camera Work:** Employ a variety of camera angles to create a dynamic and immersive experience. Do not just use straight-on shots.
        *   **Establishing Shots (Wide Angle):** Introduce new locations or show the scale of an event.
        *   **Medium Shots:** For neutral dialogue and standard interaction.
        *   **Close-ups / Extreme Close-ups:** To focus on a character's facial expression, a key object, or a subtle action.
        *   **High-angle / Low-angle Shots:** To convey power dynamics (e.g., low-angle makes a character look powerful, high-angle makes them look vulnerable).
        *   **Point-of-View (POV) Shots:** To show the scene from a character's perspective.
        *   **Dutch Angles:** To create a sense of unease or disorientation.

    [Absolute Rules]
    1.  **Maintain Character Names:** Character names must be used EXACTLY as they appear in the Character List.
    2.  **Backgrounds by Default:** Every panel should generally have a detailed background to establish the setting. However, for dramatic emphasis on a character's emotion or a specific action, you can intentionally use a simple, solid color, an abstract background, or even leave it blank. Use this technique sparingly and purposefully.
    3.  **Strict Costume & Hairstyle Adherence:**
        *   Do not describe any costume or hairstyle changes unless EXPLICITLY mentioned in the Story Log (e.g., "puts on a coat," "ties up hair").
        *   If there are no costume/hair changes, the \`costumeOverride\` field must be left empty (null/empty).

    [Instructions]
    1.  ${panelCountInstruction}
    2.  Use the following art style: **${styleInstruction}**.
    3.  **Visual Prompt Detail:** The 'visualPromptEn' is the information the AI will use to generate the image.
        *   **Important:** Describe costumes or hairstyles ONLY in the \`costumeOverride\` field. 'visualPromptEn' should focus on composition, lighting, facial expressions, background, and action.
    4.  **Cover Prompt:** Write an impactful cover illustration prompt that matches the title.

    [Output Schema for Each Panel]
       - description: (Korean) Description of the current situation.
       - location: (English) The place (e.g., Classroom, Street).
       - time: (English) The time of day (e.g., Night, Sunset).
       - costumeOverride: (English) ONLY fill this if explicitly mentioned in the story log. Otherwise, empty string.
       - visualPromptEn: (English) Description for the image generation AI (action, composition, expression, etc.), excluding costume details.
         * Required: Specific Background, Lighting, Camera Angle (e.g., Low angle, Fish-eye, Close-up).
         * Style: "${styleInstruction}".
       - dialogues: (Array) List of dialogues.
       - panelSize: 'square', 'wide', or 'tall'.
       - charactersInPanel: Array of character names appearing in the panel.

    Output Format: JSON.
  `;

  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: STORY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are a manga director. You provide EXTREMELY DETAILED visual prompts. You NEVER change character names. You NEVER hallucinate costume changes unless explicitly in the story.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A Creative and Impactful Title for the Manga (Korean)" },
            coverImagePrompt: { type: Type.STRING, description: "표지 프롬프트" },
            panels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  location: { type: Type.STRING },
                  time: { type: Type.STRING },
                  costumeOverride: { type: Type.STRING, description: "Leave empty if not changed in story" },
                  visualPromptEn: { type: Type.STRING, description: "Visual description excluding costume unless changed" },
                  dialogues: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            speaker: { type: Type.STRING },
                            text: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["speech", "shout", "thought", "narration"] }
                        },
                        required: ["speaker", "text", "type"]
                    }
                  },
                  charactersInPanel: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  panelSize: { type: Type.STRING, enum: ["square", "wide", "tall"] }
                },
                required: ["id", "description", "visualPromptEn", "dialogues", "charactersInPanel", "panelSize"],
              },
            },
          },
          required: ["title", "coverImagePrompt", "panels"],
        },
      },
    }));

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const jsonString = text.replace(/```json\n?|```/g, "");
    const data = JSON.parse(jsonString);
    
    // Automatically append title instruction to cover prompt so it's baked in
    if (data.title && data.coverImagePrompt) {
        data.coverImagePrompt += `\n\nTitle Text: Include the title "${data.title}" prominently in the image. The typography should be stylized to match the genre (e.g., bold, metallic, or calligraphic) and integrated into the composition.`;
    }

    return {
      ...data,
      coverAspectRatio: coverAspectRatio,
      styleMode: styleMode,
      renderMode: renderMode,
      panels: data.panels.map((p: any) => ({ ...p, status: 'pending' }))
    };

  } catch (error) {
    console.error("Storyboard generation failed:", error);
    throw error;
  }
};

export const generateReferenceImage = async (
  prompt: string,
  imageData: string | null,
  aspectRatio: '1:1' | '16:9' | '3:4',
  resolution: '1K' | '2K' | '4K'
): Promise<string> => {
  const ai = getAiClient();
  const parts: any[] = [];

  if (imageData) {
    const [header, data] = imageData.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    parts.push({ inlineData: { mimeType, data } });
    parts.push({ text: "Use the uploaded image as a primary reference for style and content." });
  }

  const mainPrompt = `
    Generate a high-quality reference image based on the following prompt.
    Style: Digital Painting, Concept Art, High Detail.
    Prompt: ${prompt}
  `;
  parts.push({ text: mainPrompt });

  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution,
        }
      }
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Reference image generation failed:", error);
    throw error;
  }
};

// New Function: Regenerate cover prompt
export const regenerateCoverPrompt = async (
  storyLog: string,
  characters: Character[],
  styleMode: StyleMode
): Promise<string> => {
  const ai = getAiClient();

  const characterContext = characters
    .map((c) => `- Name: "${c.name}", Description: ${c.description}`)
    .join("\n");

  const prompt = `
    Based on the story log and characters, generate a NEW, Creative, and Impactful Cover Art Prompt for the manga.

    [Story Log]
    ${storyLog}

    [Characters]
    ${characterContext}

    Output Format: JSON with a single field "coverImagePrompt".
    The prompt should be in English, describing the visual elements, composition, and mood.
  `;

  try {
      const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
          model: STORY_MODEL,
          contents: prompt,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      coverImagePrompt: { type: Type.STRING, description: "Detailed cover art description" }
                  },
                  required: ["coverImagePrompt"]
              }
          }
      }));

      const text = response.text;
      if (!text) throw new Error("Failed to regenerate cover prompt");
      const json = JSON.parse(text.replace(/```json\n?|```/g, ""));
      return json.coverImagePrompt;
  } catch (error) {
      console.error("Cover prompt regeneration failed", error);
      throw error;
  }
};

// New Function: Regenerate a single panel's script (Reroll)
export const regeneratePanelScript = async (
  panel: Panel,
  storyLog: string,
  characters: Character[],
  styleMode: StyleMode
): Promise<Panel> => {
  const ai = getAiClient();
  
  const characterContext = characters
    .map((c) => `- Name: "${c.name}", Description: ${c.description}`)
    .join("\n");

  const styleInstruction = styleMode === 'bw' 
    ? "Japanese Manga Style (Black and White, Screen Tones)" 
    : "Korean Webtoon Style (Full Color, Digital Art)";

  const prompt = `
    현재 만화 스토리보드의 특정 컷(Panel ${panel.id})이 마음에 들지 않아 다시 작성(Reroll)하려 합니다.
    
    [전체 스토리 로그]
    ${storyLog}

    [캐릭터]
    ${characterContext}

    [현재 패널 정보 (수정 전)]
    설명: ${panel.description}
    
    요청: 위 패널의 내용을 기반으로 하되, 더 극적이거나 자연스러운 연출로 **새롭게** 다시 작성해주세요.
    **배경(Background)**은 필수입니다. 절대 비워두지 마세요.

    [중요: 의상 유지]
    - 스토리상 의상 변경이 없다면 costumeOverride는 비워두세요.
    
    출력 형식: JSON (단일 Panel 객체)
  `;

  try {
     const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: STORY_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.INTEGER },
                description: { type: Type.STRING },
                location: { type: Type.STRING },
                time: { type: Type.STRING },
                costumeOverride: { type: Type.STRING },
                visualPromptEn: { type: Type.STRING },
                dialogues: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        speaker: { type: Type.STRING },
                        text: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ["speech", "shout", "thought", "narration"] }
                    },
                    required: ["speaker", "text", "type"]
                }
                },
                charactersInPanel: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                },
                panelSize: { type: Type.STRING, enum: ["square", "wide", "tall"] }
            },
            required: ["id", "description", "visualPromptEn", "dialogues", "charactersInPanel", "panelSize"],
        }
      }
     }));

     const text = response.text;
     if (!text) throw new Error("Failed to regenerate panel");
     
     const jsonString = text.replace(/```json\n?|```/g, "");
     const newPanelData = JSON.parse(jsonString);

     return {
         ...newPanelData,
         id: panel.id,
         status: 'pending',
         imageUrl: undefined
     };

  } catch (error) {
      console.error("Panel regeneration failed", error);
      throw error;
  }
};

export const generateCoverImage = async (
  prompt: string,
  characters: Character[],
  aspectRatio: 'landscape' | 'portrait',
  styleMode: StyleMode,
  customStyle: string
): Promise<string> => {
  const ai = getAiClient();
  const parts: any[] = [];

  // Add all characters as reference for the cover
  characters.forEach((char) => {
    if (char.imageBase64) {
      const [header, data] = char.imageBase64.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      parts.push({ inlineData: { mimeType, data } });
      parts.push({ text: `Character Reference: ${char.name}.` });
    }
  });

  const stylePrompt = styleMode === 'bw'
      ? "Style: Masterpiece Japanese Manga Cover Art (Black and White). Technique: Incredible detail, Dynamic composition, Dramatic Lighting, Ink textures, Screen tones."
      : styleMode === 'color'
      ? "Style: Masterpiece Korean Webtoon Cover Art (Full Color). Technique: Incredible detail, Dynamic composition, Cinematic Lighting, Digital Illustration, Vibrant Colors, High Saturation."
      : `Style: ${customStyle}. Technique: Incredible detail, Dynamic composition, Cinematic Lighting.`;

  const mainPrompt = `
    ${stylePrompt}
    
    Prompt: ${prompt}
    
    Ensure: High contrast, clean lines. Looks like a published volume cover.
    IMPORTANT: If the prompt specifies a Title Text, ensure it is drawn clearly and artistically in the image.
  `;
  parts.push({ text: mainPrompt });

  const ratioConfig = aspectRatio === 'landscape' ? '16:9' : '3:4';

  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: ratioConfig,
          imageSize: "1K",
        }
      }
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Cover generation failed:", error);
    throw error;
  }
};

export const generatePanelImage = async (
  panel: Panel,
  allCharacters: Character[],
  styleMode: StyleMode,
  customStyle: string,
  renderMode: RenderMode
): Promise<string> => {
  const ai = getAiClient();

  const activeCharacters = allCharacters.filter(c => 
    panel.charactersInPanel.includes(c.name) && c.imageBase64
  );

  const parts: any[] = [];

  // 1. Add Character References
  activeCharacters.forEach((char) => {
    if (char.imageBase64) {
      const [header, data] = char.imageBase64.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: data,
        },
      });
      parts.push({
        text: `Character Reference: ${char.name}.`
      });
    }
  });

  const stylePrompt = styleMode === 'bw'
      ? "Style: Professional Japanese Manga (Black and White). Technique: Detailed Ink lines, Screen tones (Ben-Day dots), High Contrast."
      : styleMode === 'color'
      ? "Style: Professional Korean Webtoon (Full Color). Technique: Digital Art, Cel Shading, Vibrant Colors, Clean lines."
      : `Style: ${customStyle}.`;

  // Construct Dialogue Text for AI Native Mode
  let dialoguePrompt = "";
  const hasDialogue = panel.dialogues && panel.dialogues.length > 0;

  if (renderMode === 'native' && hasDialogue) {
      dialoguePrompt = "\n\nDIALOGUE & BUBBLES:\nDraw the speech bubbles and text directly in the image as described:\n";
      panel.dialogues.forEach(d => {
          dialoguePrompt += `- ${d.speaker}: "${d.text}" (${d.type})\n`;
      });
      dialoguePrompt += "\nEnsure the speech bubbles are placed naturally near the speakers and text is legible.";
  }

  // Construct Location/Time/Costume Prompt
  const locationInfo = panel.location ? `Location: ${panel.location}.` : "";
  const timeInfo = panel.time ? `Time: ${panel.time}.` : "";

  // Only add costume prompt if override exists. Otherwise, emphasize strict adherence to reference.
  let costumePrompt = "";
  if (panel.costumeOverride && panel.costumeOverride.trim().length > 0) {
      costumePrompt = `Costume Change: ${panel.costumeOverride}.`;
  } else {
      costumePrompt = "Costume: Use EXACTLY the appearance from the Character Reference images. Do NOT add hats, coats, or accessories unless in reference.";
  }

  // 2. Main Prompt
  const mainPrompt = `
    ${stylePrompt}
    
    IMPORTANT: FULLY DETAILED BACKGROUND REQUIRED. NO WHITE VOID.
    ${locationInfo} ${timeInfo}

    Scene Action: ${panel.visualPromptEn}
    
    Characters: ${panel.charactersInPanel.join(", ")}.
    ${costumePrompt}

    Composition: Dynamic manga composition. 
    ${renderMode === 'native' && hasDialogue
       ? `INCLUDE TEXT AND SPEECH BUBBLES based on the dialogue provided below. ${dialoguePrompt}`
       : "NO TEXT OR SPEECH BUBBLES IN IMAGE."
    }
  `;
  parts.push({ text: mainPrompt });

  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: { parts },
      config: {
        imageConfig: {
          // Note: We use '4:3' for wide panels usually because 16:9 is too wide for typical manga cells unless double spread.
          // But for this grid, 16:9 or 3:2 works well for 'wide'.
          aspectRatio: panel.panelSize === 'wide' ? '16:9' : panel.panelSize === 'tall' ? '3:4' : '1:1', 
          imageSize: "1K", 
        }
      }
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response");

  } catch (error) {
    console.error(`Panel ${panel.id} generation failed:`, error);
    throw error;
  }
};