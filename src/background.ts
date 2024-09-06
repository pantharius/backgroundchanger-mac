import * as fs from "fs";
import { exec } from "child_process";
import * as dotenv from "dotenv";
import * as path from "path";
import sharp from "sharp";
import { exiftool } from "exiftool-vendored";
import { Notification } from "electron";
import { buildMenu } from "./main";

dotenv.config();

// Show notification
export function showNotification(title: string, body: string) {
  new Notification({ title, body }).show();
}

export const INTERVAL_IN_MS = +(process.env.INTERVAL_IN_S ?? 3600) * 1000;
const API_KEY = process.env.HF_API_KEY;
const API_URL =
  "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";
const PROMPTS_FILE = path.join(__dirname, "../prompts.txt");
const PID_FILE = path.join(__dirname, "../background_changer.pid");
const BACKGROUND_DIR =
  process.env.BACKGROUND_DIR ?? path.join(__dirname, "../backgrounds");

let intervalId: NodeJS.Timeout | null = null;

// Ensure the backgrounds directory exists
if (!fs.existsSync(BACKGROUND_DIR)) {
  fs.mkdirSync(BACKGROUND_DIR);
}

function getRandomPrompt(): string {
  const prompts = fs.readFileSync(PROMPTS_FILE, "utf8").split("\n");
  return prompts[Math.floor(Math.random() * prompts.length)].trim();
}

async function generateImage(prompt: string): Promise<Buffer | null> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!response.ok) {
    console.error(`Error generating image: ${response.statusText}`);
    return null;
  }

  // Use arrayBuffer and convert to Buffer
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function cleanUpOldImages() {
  const files = fs.readdirSync(BACKGROUND_DIR).map((file) => ({
    name: file,
    path: path.join(BACKGROUND_DIR, file),
    stats: fs.statSync(path.join(BACKGROUND_DIR, file)),
  }));

  // Calculate total size of files in bytes
  const totalSize = files.reduce((acc, file) => acc + file.stats.size, 0);
  const fourGB = 4 * 1024 * 1024 * 1024; // 4 GB in bytes
  const twoGB = 2 * 1024 * 1024 * 1024; // 2 GB in bytes

  // If total size is greater than 4 GB, start deleting oldest files
  if (totalSize > fourGB) {
    showNotification("Starting cleanup...", "Total size exceeds 4GB.");

    // Sort files by modification time, oldest first
    files.sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs);

    let currentSize = totalSize;

    for (const file of files) {
      if (currentSize <= twoGB) {
        break; // Stop if size is reduced to 2 GB or less
      }
      fs.unlinkSync(file.path);
      currentSize -= file.stats.size;
      console.log(`Deleted file: ${file.path}`);
    }

    showNotification(
      "Cleanup complete.",
      `Current directory size: ${(currentSize / (1024 * 1024)).toFixed(
        2
      )} MB, ${files.length} files.`
    );
  }
}

async function saveImageWithMetadata(
  imageData: Buffer,
  prompt: string
): Promise<string> {
  const existingFiles = fs.readdirSync(BACKGROUND_DIR);
  const lastNumber = existingFiles
    .map((file) => {
      const match = file.match(/^bg(\d+)\.jpg$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .reduce((max, num) => Math.max(max, num), 0);

  const newFileName = `bg${lastNumber + 1}.jpg`;
  const filePath = path.join(BACKGROUND_DIR, newFileName);

  await sharp(imageData).toFile(filePath);

  // Add the prompt as metadata using exiftool
  await exiftool.write(
    filePath,
    {
      Comment: prompt,
    },
    { writeArgs: ["-overwrite_original"] }
  );

  console.log(`File saved with metadata: ${filePath}`);
  return filePath;
}

async function setDesktopBackground(imagePath: string): Promise<void> {
  // Ensure that the path format is correct for AppleScript
  const script = `
        tell application "System Events"
            set desktopCount to count of desktops
            repeat with desktopNumber from 1 to desktopCount
                tell desktop desktopNumber
                    set picture to POSIX file "${imagePath}"
                end tell
            end repeat
        end tell
    `;

  return new Promise((resolve, reject) => {
    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error setting desktop background: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        reject(stderr);
      } else {
        console.log(`stdout: ${stdout}`);
        resolve();
      }
    });
  });

  // // Use AppleScript to set the desktop background
  // const script = `tell application "System Events" to set picture of every desktop to POSIX file "${tmpFilePath}"`;

  // exec(`osascript -e '${script}'`, (error) => {
  //     if (error) {
  //         console.error(`Error setting desktop background: ${error}`);
  //     }
  // });
}

async function isDuplicate(prompt: string): Promise<string | null> {
  const files = fs.readdirSync(BACKGROUND_DIR);

  for (const file of files) {
    const filePath = path.join(BACKGROUND_DIR, file);
    const metadata = await exiftool.read(filePath);
    if (metadata.Comment === prompt) {
      return filePath;
    }
  }
  return null;
}

async function ServiceLoop() {
  const prompt = getRandomPrompt();
  console.log(`Using prompt: ${prompt}`);
  const cache = await isDuplicate(prompt);
  if (cache === null) {
    const imageData = await generateImage(prompt);
    if (imageData) {
      // Clean up old images after saving a new one
      cleanUpOldImages();

      const imagePath = await saveImageWithMetadata(imageData, prompt);
      await setDesktopBackground(imagePath);

      showNotification("Background changed", `Prompt: "${prompt}"`);
    } else {
      showNotification(
        "Error occured",
        "Failed to generate or set the desktop background."
      );
    }
  } else {
    console.log("Duplicate prompt detected. Loading cache");
    // Clean up old images after saving a new one
    cleanUpOldImages();

    await setDesktopBackground(cache);
  }
}

export function startService(): void {
  if (intervalId) {
    console.log("Service already running.");
    return;
  }

  intervalId = setInterval(ServiceLoop, INTERVAL_IN_MS); // Change every hour

  buildMenu();

  fs.writeFileSync(PID_FILE, process.pid.toString());
  showNotification(
    "Service started.",
    `Your background will change every ${INTERVAL_IN_MS / 1000} seconds.`
  );

  ServiceLoop();
}

export function stopService(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    showNotification("Service stopped.", "We already miss you.");
    buildMenu();
  } else {
    showNotification("Service is not running.", "Start it instead ;)");
  }
}

export function serviceStatus(): boolean {
  return !!intervalId;
}
