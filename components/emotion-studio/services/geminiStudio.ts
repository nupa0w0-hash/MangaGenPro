
import { GoogleGenAI } from "@google/genai";
import { ImageQuality, AspectRatio } from "../types";

// Helper to ensure we get a fresh client with the latest key
const getClient = () => {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    throw new Error("API Key not available. Please connect your account.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateCharacterVariant = async (
  referenceBase64: string,
  mimeType: string,
  emotionLabel: string,
  promptTags: string,
  additionalPrompt: string = "",
  imageSize: ImageQuality = '1K',
  aspectRatio: AspectRatio = '1:1',
  additionalRefBase64?: string | null,
  additionalRefMimeType?: string
): Promise<string> => {
  const ai = getClient();

  // Nano Banana Pro (Gemini 3 Pro Image Preview)
  const modelId = 'gemini-3-pro-image-preview';

  // Construct a prompt that heavily emphasizes consistency and distinguishes between inputs
  let prompt = `
    ROLE: You are a master character concept artist. Your task is to create a consistent character expression sheet.

    INPUTS:
    - IMAGE 1 (Primary): The CHARACTER REFERENCE. You must maintain this character's exact identity, facial features, hair style, hair color, and most importantly, the ART STYLE (line weight, shading, coloring technique).
    ${additionalRefBase64 ? '- IMAGE 2 (Secondary): REFERENCE for clothing/outfit or specific details. Apply these elements to the character from IMAGE 1.' : ''}

    TASK:
    Draw the character from IMAGE 1 with the following expression: "${emotionLabel}".

    VISUAL CUES FOR EXPRESSION:
    ${promptTags}

    ADDITIONAL INSTRUCTIONS (Priority):
    ${additionalPrompt ? additionalPrompt : "Keep the original outfit and appearance unless the expression requires movement."}

    STRICT CONSTRAINTS:
    1. CONSISTENCY IS KEY: The output must look like it belongs on the same character sheet as IMAGE 1.
    2. ART STYLE: Do not change the art style. If the reference is anime, keep it anime. If it's thick lines, keep thick lines.
    3. COMPOSITION: Solo character, high-quality illustration.
    4. BACKGROUND: Keep it simple or white unless instructed otherwise.

    NEGATIVE PROMPT (Avoid):
    Different art style, realistic photo (if reference is illustration), bad anatomy, distorted face, extra fingers, missing limbs, text, speech bubbles, comic panels, collage, blurry, watermark, signature, cropped head, low resolution.
  `;

  const parts: any[] = [
    { text: prompt },
    {
      inlineData: {
        mimeType: mimeType,
        data: referenceBase64
      }
    }
  ];

  // Add secondary image if provided
  if (additionalRefBase64 && additionalRefMimeType) {
    parts.push({
      inlineData: {
        mimeType: additionalRefMimeType,
        data: additionalRefBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize,
        },
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image data found in response");

  } catch (error: any) {
    console.error("Gemini generation error:", error);
    throw new Error(error.message || "Failed to generate image");
  }
};
