import {
  ImageGenerationProvider,
  ImageGenerationProviderId,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../ImageGenerationProvider";

const API_URL = "https://api-inference.huggingface.co/models/";

export class HuggingFaceImageProvider implements ImageGenerationProvider {
  readonly id: ImageGenerationProviderId = "huggingface";

  constructor(
    readonly model: string,
    private readonly apiKey?: string
  ) {}

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    if (!this.apiKey) {
      throw new Error(
        "Hugging Face API key is missing. Add a token in settings or switch to Ollama."
      );
    }

    const response = await fetch(API_URL + this.model, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ inputs: request.prompt }),
    });

    if (!response.ok) {
      const message = await readResponseMessage(response);
      throw new Error(
        `Hugging Face image generation failed for model "${this.model}": ${message}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      imageData: Buffer.from(arrayBuffer),
      providerId: this.id,
      model: this.model,
    };
  }
}

async function readResponseMessage(response: Response): Promise<string> {
  const text = await response.text();
  return text || `${response.status} ${response.statusText}`;
}
