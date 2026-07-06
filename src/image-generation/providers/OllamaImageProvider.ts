import {
  ImageGenerationProvider,
  ImageGenerationProviderId,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../ImageGenerationProvider";

type OllamaGenerateResponse = {
  image?: string;
  response?: string;
  error?: string;
};

export class OllamaImageProvider implements ImageGenerationProvider {
  readonly id: ImageGenerationProviderId = "ollama";

  constructor(
    readonly model: string,
    private readonly baseUrl: string
  ) {}

  async generateImage(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const response = await this.callGenerate(request.prompt);

    if (!response.ok) {
      await this.throwHttpError(response);
    }

    const payload = (await response.json()) as OllamaGenerateResponse;
    const image = payload.image ?? payload.response;

    if (!image) {
      throw new Error(
        `Ollama did not return an image for model "${this.model}". The image-generation API is experimental; adjust OllamaImageProvider if this model's response shape changed.`
      );
    }

    return {
      imageData: Buffer.from(stripDataUrlPrefix(image), "base64"),
      providerId: this.id,
      model: this.model,
    };
  }

  private async callGenerate(prompt: string): Promise<Response> {
    try {
      return await fetch(`${this.normalizedBaseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          width: 1024,
          height: 1024,
        }),
      });
    } catch (error) {
      throw new Error(
        `Ollama is not reachable at ${this.normalizedBaseUrl}. Start Ollama and check the configured base URL. ${formatUnknownError(
          error
        )}`
      );
    }
  }

  private async throwHttpError(response: Response): Promise<never> {
    const message = await readOllamaError(response);

    if (response.status === 404 || message.toLowerCase().includes("not found")) {
      throw new Error(
        `Ollama model "${this.model}" is not available. Install it with: ollama pull ${this.model}`
      );
    }

    throw new Error(
      `Ollama image generation failed at ${this.normalizedBaseUrl}: ${message}`
    );
  }

  private get normalizedBaseUrl(): string {
    return this.baseUrl.replace(/\/+$/, "");
  }
}

async function readOllamaError(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const payload = JSON.parse(text) as OllamaGenerateResponse;
    return payload.error ?? text;
  } catch {
    return text;
  }
}

function stripDataUrlPrefix(image: string): string {
  return image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
