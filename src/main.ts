import { app, Menu, Tray } from "electron";
import path from "path";
import { menubar } from "menubar";
import {
  createIfNotExistsBackgroundDir,
  generateNow,
  serviceStatus,
  showNotification,
  startService,
  stopService,
} from "./background";
import { updateSettings, OpenPromptsTxt, openImageDirectory } from "./settings";
import storage from "node-persist";
import { getImageGenerationSettings } from "./image-generation/generationSettings";

// Path to your tray icon
const iconPath = path.join(__dirname, "..", "IconTemplate.png");
let tray: Tray;

export const buildMenu = async () => {
  const imageGenerationSettings = await getImageGenerationSettings();
  const isProviderConfigured =
    imageGenerationSettings.provider === "ollama" ||
    !!imageGenerationSettings.huggingFaceApiKey;
  const isStartServiceEnabled = isProviderConfigured && !serviceStatus();
  const isStopServiceEnabled = isProviderConfigured && serviceStatus();
  const renderTooltip = (state: string) =>
    isProviderConfigured
      ? `Service already ${state}.`
      : "Configure an image provider first";
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Start Service",
      click: () => {
        startService();
      },
      enabled: isStartServiceEnabled,
      toolTip: isStartServiceEnabled ? "" : renderTooltip("started"),
    },
    {
      label: "Generate now",
      click: () => {
        generateNow();
      },
    },
    {
      label: "Stop Service",
      click: () => stopService(),
      enabled: isStopServiceEnabled,
      toolTip: isStopServiceEnabled ? "" : renderTooltip("stopped"),
    },
    { type: "separator" },
    {
      label: "Paramètres",
      click: () => updateSettings(),
    },
    {
      label: "Open BG Dir",
      click: () => openImageDirectory(),
    },
    {
      label: "Open prompts.txt",
      click: () => OpenPromptsTxt(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
};

// Create Tray Menu
app.on("ready", async () => {
  await storage.init();
  tray = new Tray(iconPath);
  buildMenu();

  await createIfNotExistsBackgroundDir();

  const mb = menubar({
    tray,
  });

  mb.on("ready", () => {
    tray?.removeAllListeners(); // Prevents white screen issue on macOS
    showNotification(
      "BG Changer is ready",
      `I'm up to change when you want to !`,
    );
  });
});
// Prevent the app from quitting when all windows are closed
app.on("window-all-closed", () => {
  console.log("preventing closing app");
});
