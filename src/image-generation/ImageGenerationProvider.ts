export type ImageGenerationProviderId = "ollama" | "huggingface";

export type ImageGenerationRequest = {
  prompt: string;
};

export type ImageGenerationResult = {
  imageData: Buffer;
  providerId: ImageGenerationProviderId;
  model: string;
};

export interface ImageGenerationProvider {
  readonly id: ImageGenerationProviderId;
  readonly model: string;

  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
