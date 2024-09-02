import * as fs from 'fs';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const INTERVAL_IN_MS = +(process.env.INTERVAL_IN_S??60)*1000;
const API_KEY = process.env.HF_API_KEY;
const API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';
const PROMPTS_FILE = path.join(__dirname, '../prompts.txt');
const PID_FILE = path.join(__dirname, '../background_changer.pid');
const BACKGROUND_DIR = process.env.BACKGROUND_DIR??path.join(__dirname, '../backgrounds');

let intervalId: NodeJS.Timeout | null = null;

// Ensure the backgrounds directory exists
if (!fs.existsSync(BACKGROUND_DIR)) {
    fs.mkdirSync(BACKGROUND_DIR);
}

function getRandomPrompt(): string {
    const prompts = fs.readFileSync(PROMPTS_FILE, 'utf8').split('\n');
    return prompts[Math.floor(Math.random() * prompts.length)].trim();
}

async function generateImage(prompt: string): Promise<Buffer | null> {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
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

function saveImage(imageData: Buffer): string {
    const existingFiles = fs.readdirSync(BACKGROUND_DIR);
    const lastNumber = existingFiles
        .map(file => {
            const match = file.match(/^bg(\d+)\.jpg$/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .reduce((max, num) => Math.max(max, num), 0);

    const newFileName = `bg${lastNumber + 1}.jpg`;
    const filePath = path.join(BACKGROUND_DIR, newFileName);
    fs.writeFileSync(filePath, imageData);
    console.log(`File saved: ${filePath}`);
    return filePath;
}

function setDesktopBackground(imagePath: string): void {
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

    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error setting desktop background: ${error.message}`);
            console.error(`stderr: ${stderr}`);
        } else {
            console.log(`stdout: ${stdout}`);
            console.log("Desktop background successfully set.");
        }
    });

    // // Use AppleScript to set the desktop background
    // const script = `tell application "System Events" to set picture of every desktop to POSIX file "${tmpFilePath}"`;

    // exec(`osascript -e '${script}'`, (error) => {
    //     if (error) {
    //         console.error(`Error setting desktop background: ${error}`);
    //     }
    // });
}

export function startService(): void {
    if (intervalId) {
        console.log("Service already running.");
        return;
    }

    intervalId = setInterval(async () => {
        const prompt = getRandomPrompt();
        console.log(`Using prompt: ${prompt}`);

        
        const imageData = await generateImage(prompt);
        if (imageData) {
            const imagePath = saveImage(imageData);
            setDesktopBackground(imagePath);
        } else {
            console.error("Failed to generate or set the desktop background.");
        }
    }, INTERVAL_IN_MS); // Change every hour

    fs.writeFileSync(PID_FILE, process.pid.toString());
    console.log("Service started.");
}

export function stopService(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
        console.log("Service stopped.");
    } else {
        console.log("Service is not running.");
    }
}

export function serviceStatus(): string {
    return intervalId ? "Running" : "Stopped";
}