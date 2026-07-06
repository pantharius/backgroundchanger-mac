import path from "path";
import storage from "node-persist";
import { ImageGenerationProviderId } from "./ImageGenerationProvider";

export const DEFAULT_GENERATION_PROVIDER: ImageGenerationProviderId = "ollama";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "x/flux2-klein";
export const DEFAULT_HUGGING_FACE_MODEL = "black-forest-labs/FLUX.1-schnell";

export type ImageGenerationSettings = {
  provider: ImageGenerationProviderId;
  ollamaBaseUrl: string;
  ollamaModel: string;
  huggingFaceApiKey?: string;
  huggingFaceModel: string;
};

function isImageGenerationProviderId(
  value: unknown
): value is ImageGenerationProviderId {
  return value === "ollama" || value === "huggingface";
}

export async function getBackgroundDirectory(): Promise<string> {
  const backgroundDir = await storage.get("BACKGROUND_DIR");
  return backgroundDir ?? path.join(__dirname, "../backgrounds");
}

export async function getImageGenerationSettings(): Promise<ImageGenerationSettings> {
  const storedProvider = await storage.get("IMAGE_PROVIDER");
  const legacyModel = await storage.get("MODEL");

  return {
    provider: isImageGenerationProviderId(storedProvider)
      ? storedProvider
      : DEFAULT_GENERATION_PROVIDER,
    ollamaBaseUrl:
      (await storage.get("OLLAMA_BASE_URL")) ?? DEFAULT_OLLAMA_BASE_URL,
    ollamaModel: (await storage.get("OLLAMA_MODEL")) ?? DEFAULT_OLLAMA_MODEL,
    huggingFaceApiKey: await storage.get("HF_API_KEY"),
    huggingFaceModel:
      (await storage.get("HF_MODEL")) ??
      legacyModel ??
      DEFAULT_HUGGING_FACE_MODEL,
  };
}

export function buildImageCacheKey(
  providerId: ImageGenerationProviderId,
  model: string,
  prompt: string
): string {
  return JSON.stringify({
    provider: providerId,
    model,
    prompt,
  });
}
