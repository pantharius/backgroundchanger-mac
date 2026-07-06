# BG Changer

Electron app that picks a random prompt, reuses a cached generated image when
available, generates a new image when needed, and sets it as the desktop
background.

## Image providers

The app supports two image generation providers:

- `ollama`, the default local provider.
- `huggingface`, kept as an optional fallback.

The generated image cache includes the provider and model in its key, so the
same prompt can have separate cached images for Ollama and Hugging Face.

## Use Ollama on macOS

1. Install Ollama from [ollama.com](https://ollama.com/download).
2. Install the default image model:

   ```sh
   ollama pull x/flux2-klein
   ```

3. Start Ollama. The default app/service listens on:

   ```txt
   http://localhost:11434
   ```

4. Open the app settings and use:

   ```txt
   provider: ollama
   base URL: http://localhost:11434
   model: x/flux2-klein
   ```

Ollama image generation is currently exposed through `POST /api/generate` for
image models. If Ollama changes the experimental image response shape, adjust
`src/image-generation/providers/OllamaImageProvider.ts`.

## Use Hugging Face fallback

Open settings and use:

```txt
provider: huggingface
Hugging Face API key: your token
Hugging Face model: black-forest-labs/FLUX.1-schnell
```

The Hugging Face token is optional unless this provider is selected.
