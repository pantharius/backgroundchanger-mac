import { app, Menu, Tray } from "electron";
import path from "path";
import { menubar } from "menubar";
import {
  serviceStatus,
  showNotification,
  startService,
  stopService,
} from "./background";
import { ChangeBackgroundDirectory, configureHFKey, OpenPromptsTxt, updateCronExpression } from "./settings";

// Path to your tray icon
const iconPath = path.join(__dirname, "..", "IconTemplate.png");
let tray: Tray;

export const buildMenu = () => {

  const isStartServiceEnabled = !!process.env.HF_API_KEY && !serviceStatus()
  const isStopServiceEnabled =  !!process.env.HF_API_KEY && serviceStatus();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Start Service",
      click: () => startService(),
      enabled: isStartServiceEnabled,
      toolTip: isStartServiceEnabled?"":(!process.env.HF_API_KEY ? "HFKey Needed" : "Service already started.")
    },
    {
      label: "Stop Service",
      click: () => stopService(),
      enabled: !!process.env.HF_API_KEY && serviceStatus(),
      toolTip: isStopServiceEnabled?"":(!process.env.HF_API_KEY ? "HFKey Needed" : "Service already stopped.")
    },
    { type: "separator" },
    {
      type:"submenu",
      label:"Paramètres",
      submenu:[
        {
          label: "Update cron expression",
          click: () => updateCronExpression(),
        },
        {
          label: "Configure HF Key",
          click: () => configureHFKey(),
        },
        {
          label: "Change background directory",
          click: () => ChangeBackgroundDirectory(),
        },
      ]
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
app.on("ready", () => {
  tray = new Tray(iconPath);
  buildMenu();

  const mb = menubar({
    tray,
  });

  mb.on("ready", () => {
    tray?.removeAllListeners(); // Prevents white screen issue on macOS
    showNotification(
      "BG Changer is ready",
      `I'm up to change when you want to !`
    );
  });
});
// Prevent the app from quitting when all windows are closed
app.on('window-all-closed', (event:any) => {
  if (process.platform !== 'darwin') {  // For Windows/Linux, allow the app to quit
    app.quit();
  }
});