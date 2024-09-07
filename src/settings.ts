import { exec } from "child_process";
import { BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { startService } from "./background";

let inputWindow = null;

export function updateCronExpression() {
  inputWindow = new BrowserWindow({
    width: 300,
    height: 150,
    frame: false,  // No window frame
    resizable: false,
    webPreferences: {
      nodeIntegration: true,  // Allow use of Node.js in the window
      contextIsolation: false
    }
  });

  // Load the number input HTML file
  inputWindow.loadFile(path.join(__dirname, "..", "html", "cronexpression.html"));

  inputWindow.on('closed', () => {
    inputWindow = null;
  });
}

// Handle cron input from the renderer process
ipcMain.on('new-cron-expression', (event, cronExpression) => {
  console.log(`New cron expression received: ${cronExpression}`);
  updateEnvVariable("CRON_EXPRESSION", cronExpression);
  startService();
  console.log('Task scheduled successfully');
});

export function configureHFKey() {
  inputWindow = new BrowserWindow({
    width: 300,
    height: 150,
    frame: false,  // No window frame
    resizable: false,
    webPreferences: {
      nodeIntegration: true,  // Allow use of Node.js in the window
      contextIsolation: false
    }
  });

  // Load the number input HTML file
  inputWindow.loadFile(path.join(__dirname, "..", "html", "configureHFKey.html"));

  inputWindow.on('closed', () => {
    inputWindow = null;
  });
}
ipcMain.on('configure-hf-api-key', (event, apiKey) => {
  console.log(`Hugging Face API Key received: ${apiKey}`);
  updateEnvVariable("HF_API_KEY", apiKey);
  startService();
  console.log('Task scheduled successfully');
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

export function ChangeBackgroundDirectory() {
  const selectedDir = dialog.showOpenDialogSync({
    properties: ["openDirectory"],
    message: "Select a new background directory",
    defaultPath: process.env.BACKGROUND_DIR,
  });

  if (selectedDir && selectedDir.length > 0) {
    const newDir = selectedDir[0];
    updateEnvVariable("BACKGROUND_DIR", newDir);
  }
}

const envFilePath = path.join(__dirname, "..", ".env");

function updateEnvVariable(key: string, value: string) {
  // Read the .env file
  let envVariables = fs.readFileSync(envFilePath, "utf8").split("\n");

  // Check if the key exists and update its value
  let found = false;
  envVariables = envVariables.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  // If the key was not found, add it to the end of the file
  if (!found) {
    envVariables.push(`${key}=${value}`);
  }

  // Write the updated content back to the .env file
  fs.writeFileSync(envFilePath, envVariables.join("\n"), "utf8");

  // Update process.env with the new value
  process.env[key] = value;
  console.log(JSON.stringify(process.env))

  console.log(`${key} has been updated to ${value}`);
}
