const { Gdk, Gtk } = imports.gi;
import App from "resource:///com/github/Aylur/ags/app.js";
import Hyprland from "resource:///com/github/Aylur/ags/service/hyprland.js";
import Mpris from "resource:///com/github/Aylur/ags/service/mpris.js";
import Variable from "resource:///com/github/Aylur/ags/variable.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { exec, execAsync } = Utils;
import { init as i18n_init, getString } from "./i18n/i18n.js";
import userOptions from "./modules/.configuration/user_options.js";

//init i18n, Load language file
i18n_init();
Gtk.IconTheme.get_default().append_search_path(`${App.configDir}/assets/icons`);

// Global vars for external control (through keybinds)
export const showMusicControls = Variable(false, {});
export const showColorScheme = Variable(false, {});
globalThis["openMusicControls"] = showMusicControls;
globalThis["openColorScheme"] = showColorScheme;
globalThis["mpris"] = Mpris;
globalThis["getString"] = getString;

// load monitor shell modes from userOptions
const initialMonitorShellModes = () => {
  const numberOfMonitors = Gdk.Display.get_default()?.get_n_monitors() || 1;
  const monitorBarConfigs = [];
  for (let i = 0; i < numberOfMonitors; i++) {
    monitorBarConfigs.push(1); // Start with mode1 (floating)
  }
  return monitorBarConfigs;
};

export const currentShellMode = Variable(initialMonitorShellModes(), {});

// Mode switching
const updateMonitorShellMode = (monitorShellModes, monitor, mode) => {
  const newValue = [...monitorShellModes.value];
  newValue[monitor] = mode;
  monitorShellModes.value = newValue;
};

globalThis["currentMode"] = currentShellMode;
globalThis["cycleMode"] = () => {
  const monitor = Hyprland.active.monitor.id || 0;
  const currentMode = currentShellMode.value[monitor];
  
  // Cycle through modes 1-6
  const nextMode = (currentMode % 9) + 1;
  updateMonitorShellMode(currentShellMode, monitor, nextMode);
};

// Window controls
const range = (length, start = 1) =>
  Array.from({ length }, (_, i) => i + start);
globalThis["toggleWindowOnAllMonitors"] = (name) => {
  range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach((id) => {
    App.toggleWindow(`${name}${id}`);
  });
};
globalThis["closeWindowOnAllMonitors"] = (name) => {
  range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach((id) => {
    App.closeWindow(`${name}${id}`);
  });
};
globalThis["openWindowOnAllMonitors"] = (name) => {
  range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach((id) => {
    App.openWindow(`${name}${id}`);
  });
};

globalThis["closeEverything"] = () => {
  const numMonitors = Gdk.Display.get_default()?.get_n_monitors() || 1;
  for (let i = 0; i < numMonitors; i++) {
    App.closeWindow(`cheatsheet${i}`);
    App.closeWindow(`session${i}`);
  }
  App.closeWindow("sideleft");
  App.closeWindow("sideright");
  App.closeWindow("overview");
};
