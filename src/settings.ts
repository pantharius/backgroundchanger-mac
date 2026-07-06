import { exec } from "child_process";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import { startService } from "./background";
import storage from "node-persist";
import {
  DEFAULT_HUGGING_FACE_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  getImageGenerationSettings,
} from "./image-generation/generationSettings";

let inputWindow: BrowserWindow | null = null;

type HuggingFaceModel = {
  modelId: string;
  config?: {
    diffusers?: unknown;
  };
  inference?: string;
};

export async function updateSettings() {
  const imageGenerationSettings = await getImageGenerationSettings();
  const models = await loadHuggingFaceModels(
    imageGenerationSettings.huggingFaceApiKey
  );

  inputWindow = new BrowserWindow({
    width: 475,
    height: 800,
    minWidth: 475,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  inputWindow.loadFile(path.join(__dirname, "..", "html", "settings.html"));

  // Send the default values to the renderer process
  inputWindow?.webContents.on("did-finish-load", async () => {
    inputWindow?.webContents.send(
      "default-settings",
      JSON.stringify({
        CRON_EXPRESSION: (await storage.get("CRON_EXPRESSION")) ?? "0 * * * *",
        IMAGE_PROVIDER: imageGenerationSettings.provider,
        OLLAMA_BASE_URL: imageGenerationSettings.ollamaBaseUrl,
        OLLAMA_MODEL: imageGenerationSettings.ollamaModel,
        HF_API_KEY: imageGenerationSettings.huggingFaceApiKey,
        HF_MODEL: imageGenerationSettings.huggingFaceModel,
        BACKGROUND_DIR:
          (await storage.get("BACKGROUND_DIR")) ??
          path.join(__dirname, "../backgrounds"),
      }),
      models.filter(
        (model) =>
          model.config?.diffusers &&
          model.inference != "pipeline-library-pair-not-supported" &&
          model.inference != "not-popular-enough" &&
          model.inference != "explicit-opt-out"
      )
    );
  });

  inputWindow.on("closed", () => {
    inputWindow = null;
  });
}
ipcMain.on("open-directory-dialog", (event) => {
  const selectedDir = dialog.showOpenDialogSync({
    properties: ["openDirectory"],
    message: "Select a new background directory",
    defaultPath: process.env.BACKGROUND_DIR,
  });

  if (selectedDir && selectedDir.length > 0) {
    const newDir = selectedDir[0];
    event.sender.send("selected-directory", newDir);
  }
});
ipcMain.on("save-settings", async (event, settings) => {
  await storage.set("CRON_EXPRESSION", settings.CRON_EXPRESSION);
  await storage.set("IMAGE_PROVIDER", settings.IMAGE_PROVIDER);
  await storage.set(
    "OLLAMA_BASE_URL",
    settings.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL
  );
  await storage.set(
    "OLLAMA_MODEL",
    settings.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
  );
  await storage.set("HF_API_KEY", settings.HF_API_KEY);
  await storage.set(
    "HF_MODEL",
    settings.HF_MODEL || DEFAULT_HUGGING_FACE_MODEL
  );
  await storage.set("BACKGROUND_DIR", settings.BACKGROUND_DIR);
  await storage.set("MODEL", settings.HF_MODEL || DEFAULT_HUGGING_FACE_MODEL);

  console.log("Settings saved:", settings);

  startService();
});

async function loadHuggingFaceModels(
  apiKey?: string
): Promise<HuggingFaceModel[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const modelsQuery = await fetch(
      "https://huggingface.co/api/models?filter=text-to-image,diffusers&sort=likes&limit=100000&config=true&full=true",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!modelsQuery.ok) {
      console.error(
        `Unable to load Hugging Face models: ${modelsQuery.statusText}`
      );
      return [];
    }

    return (await modelsQuery.json()) as HuggingFaceModel[];
  } catch (error) {
    console.error("Unable to load Hugging Face models:", error);
    return [];
  }
}

export function OpenPromptsTxt() {
  const promptsFilePath = path.join(__dirname, "..", "prompts.txt");
  console.log(promptsFilePath);
  if (fs.existsSync(promptsFilePath)) {
    if (process.platform === "win32") {
      exec(`${promptsFilePath}`, (error) => {
        if (error) {
          console.error("Failed to open prompts.txt:", error);
        }
      });
    } else {
      exec(`open ${promptsFilePath}`, (error) => {
        if (error) {
          console.error("Failed to open prompts.txt:", error);
        }
      });
    }
  } else {
    console.error("prompts.txt does not exist.");
  }
}

export async function openImageDirectory() {
  try {
    // Retrieve the background directory path from storage
    let bgdir = await storage.get("BACKGROUND_DIR");
    if (bgdir) {
      // Open the directory in the system's file explorer
      await shell.openPath(bgdir);
    } else {
      console.error("Background directory is not set.");
    }
  } catch (error) {
    console.error("Error opening directory:", error);
  }
}
