import { exec } from "child_process";
import { BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { startService } from "./background";
import storage from 'node-persist';

let inputWindow: BrowserWindow | null = null;


export function updateSettings() {
  inputWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  inputWindow.loadFile(path.join(__dirname, "..", "html", "settings.html"));
  // Send the default values to the renderer process
  inputWindow?.webContents.on('did-finish-load', async () => {
    inputWindow?.webContents.send('default-settings', JSON.stringify({
      CRON_EXPRESSION: await storage.get('CRON_EXPRESSION'),
      HF_API_KEY: await storage.get('HF_API_KEY'),
      BACKGROUND_DIR: await storage.get('BACKGROUND_DIR')??path.join(__dirname, "../backgrounds"),
      MODEL: await storage.get('MODEL'),
    }));
  });

  inputWindow.on('closed', () => {
    inputWindow = null;
  });
}
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
