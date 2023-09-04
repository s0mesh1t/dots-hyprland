const { Gdk, Gtk } = imports.gi;
const { App, Service, Widget } = ags;
const { Bluetooth, Hyprland, Network } = ags.Service;
const { execAsync, exec } = ags.Utils;

const RECORD_SCRIPT_DIR = `${App.configDir}/scripts/record-script.sh`;
const RECORDER_PROCESS = 'record-script.sh';
const CLOSE_ANIM_TIME = 150;

const MaterialIcon = (icon, size) => Widget.Label({
    className: `icon-material txt-${size}`,
    label: icon,
})

async function toggleSystemdService(serviceName, button) {
    const serviceState = exec(`systemctl is-enabled ${serviceName}`) == 'enabled';
    // console.log(`pkexec bash -c "systemctl ${serviceState ? 'disable' : 'enable'} ${serviceName}"`)
    exec(`pkexec bash -c "systemctl ${serviceState ? 'disable' : 'enable'} ${serviceName}"`);
    const newServiceState = exec(`systemctl is-enabled ${serviceName}`) == 'enabled';
    button.toggleClassName('sidebar-button-active', newServiceState);
    serviceState.toggleClassName('invisible', newServiceState);
}

// Styles in scss/sidebars.scss
const ModuleNightLight = (props = {}) => Widget.Button({
    ...props,
    className: 'button-minsize sidebar-button-nopad sidebar-button-alone txt-small',
    onPrimaryClick: (button) => {
        // Set the value to 1 - value
        const shaderPath = JSON.parse(exec('hyprctl -j getoption decoration:screen_shader')).str;
        console.log(shaderPath);
        if (shaderPath != "[[EMPTY]]" && shaderPath != "") {
            console.log('disabling');
            execAsync(['bash', '-c', `hyprctl keyword decoration:screen_shader ''`]).catch(print);
            button.toggleClassName('sidebar-button-active', false);
        }
        else {
            console.log('enabling');
            execAsync(['bash', '-c', `hyprctl keyword decoration:screen_shader ~/.config/hypr/shaders/extradark.frag`]).catch(print);
            button.toggleClassName('sidebar-button-active', true);
        }
    },
    child: MaterialIcon('nightlight', 'larger'),
})

const ModuleRecord = (props = {}) => Widget.Button({
    ...props,
    className: 'button-minsize sidebar-button-nopad sidebar-button-alone txt-small',
    onPrimaryClick: () => {
        execAsync(['bash', '-c', RECORD_SCRIPT_DIR]).catch(print);
        setTimeout(() => {
            button.toggleClassName('sidebar-button-active', exec(`pidof ${RECORDER_PROCESS} >/dev/null && echo 1 || echo`) == '1');
        }, CLOSE_ANIM_TIME);
    },
    child: MaterialIcon('screen_record', 'larger'),
    setup: button => {
        button.toggleClassName('sidebar-button-active', exec(`pidof ${RECORDER_PROCESS} >/dev/null && echo 1 || echo`));
    }
})

const SystemdService = (serviceName) => {
    const serviceState = Widget.Label({
        className: `icon-material txt-larger`,
        label: 'check',
        setup: label => {
            // label.toggleClassName('invisible', exec(`bash -c "systemctl is-enabled ${serviceName} >/dev/null && echo ON || echo OFF"`) == 'OFF');
        }
    });
    return Widget.Button({
        className: 'button-minsize sidebar-button sidebar-button-alone txt-small',
        style: `min-width: 10.227rem;`,
        onPrimaryClick: (button) => {
            toggleSystemdService(serviceName, button);
        },
        setup: button => {
            button.toggleClassName('sidebar-button-active', exec(`systemctl is-enabled ${serviceName}`) == 'enabled');
        },
        child: Widget.Box({
            setup: box => {
                box.pack_start(Widget.Label({
                    xalign: 0,
                    label: serviceName,
                }), true, true, 0);
                // box.pack_end(serviceState, false, false, 0);
            }
        })
    });
}

export const ModuleMiscToggles = () => {
    const PowerSavers = Widget.Revealer({
        revealChild: false,
        transition: 'slide_left',
        transitionDuration: 100,
        child: Widget.Box({
            className: 'spacing-v-5 margin-right-10',
            vertical: true,
            children: [
                SystemdService('tlp'),
                SystemdService('auto-cpufreq'),
            ]
        })
    })
    const ModulePowerSavers = Widget.Button({
        className: 'button-minsize sidebar-button-nopad sidebar-button-alone txt-small',
        child: MaterialIcon('energy_savings_leaf', 'larger'),
        onPrimaryClick: () => { PowerSavers.revealChild = !PowerSavers.revealChild; },
    })
    return Widget.Box({
        className: 'sidebar-group spacing-h-10',
        children: [
            PowerSavers,
            Widget.Box({
                vertical: true,
                className: 'spacing-v-5',
                children: [
                    ModulePowerSavers,
                    Widget.Box({
                        className: 'spacing-h-5',
                        children: [
                            ModuleNightLight(),
                            ModuleRecord(),
                        ]
                    })
                ]
            })
        ]
    });
}