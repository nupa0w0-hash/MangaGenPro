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
  renderMode: RenderMode = 'overlay'
): Promise<Storyboard> => {
  const ai = getAiClient();

  const characterContext = characters
    .map((c) => `- Name: "${c.name}", Description: ${c.description}`)
    .join("\n");

  const styleInstruction = styleMode === 'bw' 
    ? "Japanese Manga Style (Black and White, Screen Tones, High Contrast)" 
    : "Korean Webtoon Style (Full Color, Vibrant, Digital Art, Clean Lines)";

  const prompt = `
    당신은 세계 최고의 만화 콘티 작가입니다.
    
    임무: 제공된 스토리 로그와 캐릭터를 바탕으로, 작화가(AI)가 완벽한 그림을 그릴 수 있도록 **매우 상세하고 구체적인** 만화 콘티(Name/Storyboard)를 작성하세요.
    
    [등록된 캐릭터 목록]
    ${characterContext}
    
    [스토리 로그]
    ${storyLog}
    
    [절대 규칙]
    1. **캐릭터 이름 유지:** 캐릭터의 이름은 등록된 목록의 텍스트(한국어/영어 등)를 **글자 그대로(EXACTLY)** 사용해야 합니다.
    2. **배경 필수 (Background Mandatory):** 모든 컷에는 구체적인 배경 묘사가 필수입니다. 절대 "배경 없음"이나 "흰색 배경"을 만들지 마세요. 장소(교실, 거리, 우주선 등)를 반드시 묘사하세요.
    3. **의상 및 스타일 유연성:** 스토리 로그에 캐릭터의 의상이나 헤어스타일 변경에 대한 언급이 있다면 반드시 반영하세요. 그러나 언급이 없다면 과도하게 강제하지 말고, 해당 장르(학교, 판타지 등)에 어울리는 자연스러운 복장을 유지하거나 기본 외형을 따르세요.
    
    [지시사항]
    1. 스토리를 6~10컷의 역동적인 만화 패널로 구성하세요.
    2. **${styleInstruction}**의 연출을 사용하세요.
    3. **Visual Prompt Detail:** visualPromptEn은 AI가 이미지를 생성하는 유일한 정보입니다. 조명, 앵글, 배경 디테일, 분위기를 포함해 50단어 이상으로 아주 자세히 쓰세요.
    4. 표지(Cover) 프롬프트 작성: 제목과 어울리는 임팩트 있는 표지 일러스트 프롬프트를 작성하세요.
    
    각 패널 출력 항목:
       - description: (한국어) 현재 상황 설명.
       - visualPromptEn: (영어) 이미지 생성 AI를 위한 **초고해상도 묘사**. 
         * 필수: 구체적 배경 (Background), 시간대 (Time), 조명 (Lighting), 카메라 앵글 (Low angle, Fish-eye, Close-up).
         * 스타일: "${styleInstruction}".
       - dialogues: (Array) 대사 목록. 각 대사는 화자(speaker), 내용(text), 타입(type)을 포함.
       - panelSize: 'square', 'wide', 'tall'.
       - charactersInPanel: 해당 컷에 등장하는 캐릭터 이름 배열.
    
    출력 형식: JSON.
  `;

  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: STORY_MODEL,
      contents: prompt,
      config: {
        systemInstruction: "You are a manga director. You provide EXTREMELY DETAILED visual prompts for AI image generation. You NEVER change character names provided by the user. You ALWAYS include detailed background descriptions.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "만화 제목" },
            coverImagePrompt: { type: Type.STRING, description: "표지를 위한 매우 상세한 영어 시각적 프롬프트" },
            panels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  description: { type: Type.STRING, description: "한국어 장면 설명" },
                  visualPromptEn: { type: Type.STRING, description: "영어 이미지 생성 프롬프트 (50단어 이상, 배경 필수 포함)" },
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
    구도는 바꾸거나 유지할 수 있습니다. 
    스타일 지침: ${styleInstruction}
    
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

     // Maintain status/id from original unless changed by AI (AI keeps ID usually)
     return {
         ...newPanelData,
         id: panel.id,
         status: 'pending',
         imageUrl: undefined // Reset image since script changed
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
  styleMode: StyleMode
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
      : "Style: Masterpiece Korean Webtoon Cover Art (Full Color). Technique: Incredible detail, Dynamic composition, Cinematic Lighting, Digital Illustration, Vibrant Colors, High Saturation.";

  const mainPrompt = `
    ${stylePrompt}
    
    Prompt: ${prompt}
    
    Ensure: High contrast, clean lines. Looks like a published volume cover.
    NO TEXT (Title/Credits) should be in the image.
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
      : "Style: Professional Korean Webtoon (Full Color). Technique: Digital Art, Cel Shading, Vibrant Colors, Clean lines.";

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

  // 2. Main Prompt
  const mainPrompt = `
    ${stylePrompt}
    
    IMPORTANT: FULLY DETAILED BACKGROUND REQUIRED. NO WHITE VOID.
    Scene Description: ${panel.visualPromptEn}
    
    Characters: ${panel.charactersInPanel.join(", ")}.
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