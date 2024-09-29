import { exec } from "child_process";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import { startService } from "./background";
import storage from 'node-persist';

let inputWindow: BrowserWindow | null = null;

export async function updateSettings() {
  const hfApiKey = await storage.get('HF_API_KEY');
  const modelsQuery = await fetch("https://huggingface.co/api/models?filter=text-to-image,diffusers&sort=likes&limit=100000&config=true&full=true", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hfApiKey}`,
    }
  });
  const models = await modelsQuery.json();

  inputWindow = new BrowserWindow({
    width: 475,
    height: 650,
    minWidth:475,
    minHeight:650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  inputWindow.loadFile(path.join(__dirname, "..", "html", "settings.html"));

  // Send the default values to the renderer process
  inputWindow?.webContents.on('did-finish-load', async () => {
    inputWindow?.webContents.send('default-settings', JSON.stringify({
      CRON_EXPRESSION: await storage.get('CRON_EXPRESSION')??"0 * * * *",
      HF_API_KEY: await storage.get('HF_API_KEY'),
      BACKGROUND_DIR: await storage.get('BACKGROUND_DIR')??path.join(__dirname, "../backgrounds"),
      MODEL: await storage.get('MODEL')
    }), 
    models.filter((model:any) => (model.config?.diffusers)&&model.inference!="pipeline-library-pair-not-supported"&&model.inference!="not-popular-enough"&&model.inference!="explicit-opt-out"));
  });

  inputWindow.on('closed', () => {
    inputWindow = null;
  });
}
ipcMain.on('open-directory-dialog', (event) => {
  const selectedDir = dialog.showOpenDialogSync({
    properties: ["openDirectory"],
    message: "Select a new background directory",
    defaultPath: process.env.BACKGROUND_DIR,
  });

  if (selectedDir && selectedDir.length > 0) {
    const newDir = selectedDir[0];
    event.sender.send('selected-directory', newDir);
  }
});
ipcMain.on('save-settings', async (event, settings) => {
  await storage.set("CRON_EXPRESSION",settings.CRON_EXPRESSION);
  await storage.set("HF_API_KEY",settings.HF_API_KEY);
  await storage.set("BACKGROUND_DIR",settings.BACKGROUND_DIR);
  await storage.set("MODEL",settings.MODEL);

  console.log('Settings saved:', settings);

  startService();
});

export function OpenPromptsTxt() {
  const promptsFilePath = path.join(__dirname, "..", "prompts.txt");
  console.log(promptsFilePath);
  if (fs.existsSync(promptsFilePath)) {
    if (process.platform === 'win32') {
      exec(`${promptsFilePath}`, (error) => {
        if (error) {
          console.error("Failed to open prompts.txt:", error);
        }
      });
    }else{
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
    let bgdir = await storage.get('BACKGROUND_DIR');
    if (bgdir) {
      // Open the directory in the system's file explorer
      await shell.openPath(bgdir);
    } else {
      console.error('Background directory is not set.');
    }
  } catch (error) {
    console.error('Error opening directory:', error);
  }
}
