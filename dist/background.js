"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERVAL_IN_MS = void 0;
exports.showNotification = showNotification;
exports.startService = startService;
exports.stopService = stopService;
exports.serviceStatus = serviceStatus;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const exiftool_vendored_1 = require("exiftool-vendored");
const electron_1 = require("electron");
const main_1 = require("./main");
dotenv.config();
// Show notification
function showNotification(title, body) {
    new electron_1.Notification({ title, body }).show();
}
exports.INTERVAL_IN_MS = +(process.env.INTERVAL_IN_S ?? 3600) * 1000;
const API_KEY = process.env.HF_API_KEY;
const API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell';
const PROMPTS_FILE = path.join(__dirname, '../prompts.txt');
const PID_FILE = path.join(__dirname, '../background_changer.pid');
const BACKGROUND_DIR = process.env.BACKGROUND_DIR ?? path.join(__dirname, '../backgrounds');
let intervalId = null;
// Ensure the backgrounds directory exists
if (!fs.existsSync(BACKGROUND_DIR)) {
    fs.mkdirSync(BACKGROUND_DIR);
}
function getRandomPrompt() {
    const prompts = fs.readFileSync(PROMPTS_FILE, 'utf8').split('\n');
    return prompts[Math.floor(Math.random() * prompts.length)].trim();
}
async function generateImage(prompt) {
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
function cleanUpOldImages() {
    const files = fs.readdirSync(BACKGROUND_DIR).map(file => ({
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
        showNotification("Cleanup complete.", `Current directory size: ${(currentSize / (1024 * 1024)).toFixed(2)} MB, ${files.length} files.`);
    }
}
async function saveImageWithMetadata(imageData, prompt) {
    const existingFiles = fs.readdirSync(BACKGROUND_DIR);
    const lastNumber = existingFiles
        .map(file => {
        const match = file.match(/^bg(\d+)\.jpg$/);
        return match ? parseInt(match[1], 10) : 0;
    })
        .reduce((max, num) => Math.max(max, num), 0);
    const newFileName = `bg${lastNumber + 1}.jpg`;
    const filePath = path.join(BACKGROUND_DIR, newFileName);
    await (0, sharp_1.default)(imageData).toFile(filePath);
    // Add the prompt as metadata using exiftool
    await exiftool_vendored_1.exiftool.write(filePath, {
        Comment: prompt
    }, { writeArgs: ['-overwrite_original'] });
    console.log(`File saved with metadata: ${filePath}`);
    return filePath;
}
async function setDesktopBackground(imagePath) {
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
        (0, child_process_1.exec)(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error setting desktop background: ${error.message}`);
                console.error(`stderr: ${stderr}`);
                reject(stderr);
            }
            else {
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
async function isDuplicate(prompt) {
    const files = fs.readdirSync(BACKGROUND_DIR);
    for (const file of files) {
        const filePath = path.join(BACKGROUND_DIR, file);
        const metadata = await exiftool_vendored_1.exiftool.read(filePath);
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
        }
        else {
            showNotification("Error occured", "Failed to generate or set the desktop background.");
        }
    }
    else {
        console.log("Duplicate prompt detected. Loading cache");
        // Clean up old images after saving a new one
        cleanUpOldImages();
        await setDesktopBackground(cache);
    }
}
function startService() {
    if (intervalId) {
        console.log("Service already running.");
        return;
    }
    intervalId = setInterval(ServiceLoop, exports.INTERVAL_IN_MS); // Change every hour
    (0, main_1.buildMenu)();
    fs.writeFileSync(PID_FILE, process.pid.toString());
    showNotification("Service started.", `Your background will change every ${exports.INTERVAL_IN_MS / 1000}`);
    ServiceLoop();
}
function stopService() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        if (fs.existsSync(PID_FILE))
            fs.unlinkSync(PID_FILE);
        showNotification("Service stopped.", "We already miss you.");
        (0, main_1.buildMenu)();
    }
    else {
        showNotification("Service is not running.", "Start it instead ;)");
    }
}
function serviceStatus() {
    return !!intervalId;
}
