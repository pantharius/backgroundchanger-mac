import {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./ImageGenerationProvider";
import { getImageGenerationSettings } from "./generationSettings";
import { HuggingFaceImageProvider } from "./providers/HuggingFaceImageProvider";
import { OllamaImageProvider } from "./providers/OllamaImageProvider";

export class ImageGenerationService {
  constructor(private readonly provider: ImageGenerationProvider) {}

  static async fromSettings(): Promise<ImageGenerationService> {
    const settings = await getImageGenerationSettings();

    if (settings.provider === "huggingface") {
      return new ImageGenerationService(
        new HuggingFaceImageProvider(
          settings.huggingFaceModel,
          settings.huggingFaceApiKey
        )
      );
    }

    return new ImageGenerationService(
      new OllamaImageProvider(settings.ollamaModel, settings.ollamaBaseUrl)
    );
  }

  get providerId() {
    return this.provider.id;
  }

  get model() {
    return this.provider.model;
  }

  generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    return this.provider.generateImage(request);
  }
}
