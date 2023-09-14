
const { Audio, Mpris } = ags.Service;
const { App, Service, Widget } = ags;
const { exec, execAsync, CONFIG_DIR } = ags.Utils;
import { ModuleNotification } from "./notification.js";
import { StatusIcons } from "./statusicons.js";
import { RoundedCorner } from "./lib/roundedcorner.js";

export const ModuleRightSpace = () => Widget.EventBox({
    onScrollUp: () => {
        if (Audio.speaker == null) return;
        Audio.speaker.volume += 0.03;
        Service.Indicator.speaker();
    },
    onScrollDown: () => {
        if (Audio.speaker == null) return;
        Audio.speaker.volume -= 0.03;
        Service.Indicator.speaker();
    },
    onPrimaryClick: () => Service.MenuService.toggle('sideright'),
    onSecondaryClick: () => Mpris.getPlayer('')?.next(),
    onMiddleClick: () => Mpris.getPlayer('')?.playPause(),
    child: Widget.Box({
        homogeneous: false,
        children: [
            Widget.Box({
                hexpand: true,
                className: 'spacing-h-5 txt',
                children: [
                    ModuleNotification(),
                    Widget.Box(),
                    StatusIcons(),
                ]
            }),
            RoundedCorner('topright', { className: 'corner-black' })
        ]
    })
});
