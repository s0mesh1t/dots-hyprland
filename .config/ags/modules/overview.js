const { Gdk, Gtk } = imports.gi;
const { App, Widget } = ags;
const { Applications, Hyprland } = ags.Service;
const { execAsync, exec } = ags.Utils;
import { addTodoItem } from "./calendar.js";
import { setupCursorHover, setupCursorHoverAim } from "./lib/cursorhover.js";
import { MaterialIcon } from './lib/materialicon.js';

const SCREEN_WIDTH = Number(exec(`bash -c "xrandr --current | grep '*' | uniq | awk '{print $1}' | cut -d 'x' -f1 | head -1"`));
const SCREEN_HEIGHT = Number(exec(`bash -c "xrandr --current | grep '*' | uniq | awk '{print $1}' | cut -d 'x' -f2 | head -1"`));
const MAX_RESULTS = 10;
const OVERVIEW_SCALE = 0.18; // = overview workspace box / screen size
const TARGET = [Gtk.TargetEntry.new('text/plain', Gtk.TargetFlags.SAME_APP, 0)];

function launchCustomCommand(command) {
    const args = command.split(' ');
    if (args[0] == '>raw') { // Mouse raw input
        execAsync([`bash`, `-c`, `hyprctl keyword input:force_no_accel $(( 1 - $(hyprctl getoption input:force_no_accel -j | gojq ".int") ))`]).catch(print);
    }
    else if (args[0] == '>img') { // Change wallpaper
        execAsync([`${App.configDir}/scripts/switchwall.sh`]).catch(print);
    }
    else if (args[0] == '>light') { // Light mode
        execAsync([`bash`, `-c`, `mkdir -p ~/.cache/ags/user && echo "-l" > ~/.cache/ags/user/colormode.txt`]).catch(print);
    }
    else if (args[0] == '>dark') { // Dark mode
        execAsync([`bash`, `-c`, `mkdir -p ~/.cache/ags/user && echo "" > ~/.cache/ags/user/colormode.txt`]).catch(print);
    }
    else if (args[0] == '>todo') { // Todo
        addTodoItem(args.slice(1).join(' '));
    }
}

function startsWithNumber(str) {
    // Create a regular expression pattern to match a number at the beginning of the string
    var pattern = /^\d/;

    // Use the test() method of the pattern to check if the string matches the pattern
    return pattern.test(str);
}

function substitute(str) {
    const subs = [
        { from: 'Caprine', to: 'facebook-messenger' },
        { from: 'code-url-handler', to: 'code' },
        { from: 'Code', to: 'code' },
        { from: 'GitHub Desktop', to: 'github-desktop' },
        { from: 'wpsoffice', to: 'wps-office-kingsoft' },
    ];

    for (const { from, to } of subs) {
        if (from === str)
            return to;
    }

    return str;
}

function destroyContextMenu(menu) {
    if (menu !== null) {
        menu.remove_all();
        menu.destroy();
        menu = null;
    }
}

const ContextMenuItem = ({ label, onClick }) => Widget({
    type: Gtk.MenuItem,
    label: `${label}`,
    setup: menuItem => {
        menuItem.connect("activate", onClick);
    }
})

const ContextWorkspaceArray = ({ label, onClickBinary, thisWorkspace }) => Widget({
    type: Gtk.MenuItem,
    label: `${label}`,
    setup: menuItem => {
        let submenu = new Gtk.Menu();
        for (let i = 1; i <= 10; i++) {
            let button = new Gtk.MenuItem({ label: `${i}` });
            button.connect("activate", () => {
                execAsync([`${onClickBinary}`, `${thisWorkspace}`, `${i}`]).catch(print);
            });
            submenu.append(button);
        }
        menuItem.set_reserve_indicator(true);
        menuItem.set_submenu(submenu);
    }
})

const client = ({ address, size: [w, h], workspace: { id, name }, class: c, title }) => Widget.Button({
    className: 'overview-tasks-window',
    halign: 'center',
    valign: 'center',
    onPrimaryClickRelease: () => {
        execAsync(`hyprctl dispatch focuswindow address:${address}`).catch(print);
        ags.Service.MenuService.toggle('overview');
    },
    onMiddleClick: () => execAsync('hyprctl dispatch closewindow address:' + address).catch(print),
    onSecondaryClick: (button) => {
        button.toggleClassName('overview-tasks-window-selected', true);
        const menu = Widget({
            type: Gtk.Menu,
            setup: menu => {
                menu.append(ContextMenuItem({ label: "Close (Middle-click)", onClick: () => { execAsync('hyprctl dispatch closewindow address:' + address).catch(print); destroyContextMenu(menu); } }));
                menu.append(ContextWorkspaceArray({ label: "Dump windows to workspace", onClickBinary: `${App.configDir}/scripts/dumptows`, thisWorkspace: Number(id) }));
                menu.append(ContextWorkspaceArray({ label: "Swap windows with workspace", onClickBinary: `${App.configDir}/scripts/dumptows`, thisWorkspace: Number(id) }));
                menu.show_all();
            }
        });
        menu.connect("deactivate", () => {
            button.toggleClassName('overview-tasks-window-selected', false);
        })
        menu.connect("selection-done", () => {
            button.toggleClassName('overview-tasks-window-selected', false);
        })
        menu.popup_at_pointer(null); // Show the menu at the pointer's position
    },
    child: Widget.Box({
        vertical: true,
        children: [
            Widget.Icon({
                style: `
            min-width: ${w * OVERVIEW_SCALE - 4}px;
            min-height: ${h * OVERVIEW_SCALE - 4}px;
            `,
                size: Math.min(w, h) * OVERVIEW_SCALE / 2.5,
                icon: substitute(c),
            }),
            Widget.Scrollable({
                hexpand: true,
                vexpand: true,
                child: Widget.Label({
                    style: `
                font-size: ${Math.min(w, h) * OVERVIEW_SCALE / 20}px;
                `,
                    label: title,
                })
            })
        ]
    }),
    tooltipText: `${c}: ${title}`,
    setup: button => {
        button.drag_source_set(Gdk.ModifierType.BUTTON1_MASK, TARGET, Gdk.DragAction.MOVE);
        button.drag_source_set_icon_name(substitute(c));
        // button.drag_source_set_icon_gicon(icon);

        button.connect('drag-begin', (button) => {  // On drag start, add the dragging class
            button.toggleClassName('overview-tasks-window-dragging', true);
        });
        button.connect('drag-data-get', (_w, _c, data) => { // On drag finish, give address
            data.set_text(address, address.length);
            button.toggleClassName('overview-tasks-window-dragging', false);
        });
        setupCursorHoverAim(button);
    },
});

const workspace = index => {
    const fixed = Gtk.Fixed.new();
    const widget = Widget.Box({
        className: 'overview-tasks-workspace',
        valign: 'center',
        style: `
        min-width: ${SCREEN_WIDTH * OVERVIEW_SCALE}px;
        min-height: ${SCREEN_HEIGHT * OVERVIEW_SCALE}px;
        `,
        connections: [[Hyprland, box => {
            box.toggleClassName('active', Hyprland.active.workspace.id === index);
        }]],
        children: [Widget.EventBox({
            hexpand: true,
            vexpand: true,
            onPrimaryClick: () => {
                execAsync(`hyprctl dispatch workspace ${index}`).catch(print);
                ags.Service.MenuService.toggle('overview');
            },
            // onSecondaryClick: (eventbox) => {
            //     const menu = Widget({
            //         type: Gtk.Menu,
            //         setup: menu => {
            //             menu.append(ContextWorkspaceArray({ label: "Dump windows to workspace", onClickBinary: `${App.configDir}/scripts/dumptows`, thisWorkspace: Number(index) }));
            //             menu.append(ContextWorkspaceArray({ label: "Swap windows with workspace", onClickBinary: `${App.configDir}/scripts/dumptows`, thisWorkspace: Number(index) }));
            //             menu.show_all();
            //         }
            //     });
            //     menu.popup_at_pointer(null); // Show the menu at the pointer's position
            // },
            setup: eventbox => {
                eventbox.drag_dest_set(Gtk.DestDefaults.ALL, TARGET, Gdk.DragAction.COPY);
                eventbox.connect('drag-data-received', (_w, _c, _x, _y, data) => {
                    execAsync(`hyprctl dispatch movetoworkspacesilent ${index},address:${data.get_text()}`).catch(print);
                });
            },
            child: fixed,
        })],
    });
    widget.update = clients => {
        clients = clients.filter(({ workspace: { id } }) => id === index);

        // this is for my monitor layout
        // shifts clients back by SCREEN_WIDTHpx if necessary
        clients = clients.map(client => {
            // console.log(client);
            const [x, y] = client.at;
            if (x > SCREEN_WIDTH)
                client.at = [x - SCREEN_WIDTH, y];
            return client;
        });

        fixed.get_children().forEach(ch => ch.destroy());
        clients.forEach(c => c.mapped && fixed.put(client(c), c.at[0] * OVERVIEW_SCALE, c.at[1] * OVERVIEW_SCALE));
        fixed.show_all();
    };
    return widget;
};

const arr = (s, n) => {
    const array = [];
    for (let i = 0; i < n; i++)
        array.push(s + i);

    return array;
};

const OverviewRow = ({ startWorkspace = 1, workspaces = 5, windowName = 'overview' }) => Widget.Box({
    children: arr(startWorkspace, workspaces).map(workspace),
    properties: [['update', box => {
        execAsync('hyprctl -j clients').then(clients => {
            const json = JSON.parse(clients);
            box.get_children().forEach(ch => ch.update(json));
        }).catch(print);
    }]],
    setup: box => box._update(box),
    connections: [[Hyprland, box => {
        if (!App.getWindow(windowName).visible)
            return;

        box._update(box);
    }]],
});


export const SearchAndWindows = () => {
    var _appSearchResults = [];

    const clickOutsideToClose = Widget.EventBox({
        onPrimaryClick: () => ags.Service.MenuService.toggle('overview'),
        onSecondaryClick: () => ags.Service.MenuService.toggle('overview'),
        onMiddleClick: () => ags.Service.MenuService.toggle('overview'),
    });
    const resultsBox = Widget.Box({
        className: 'spacing-v-15 overview-search-results',
        vertical: true,
        vexpand: true,
    });
    const resultsRevealer = Widget.Revealer({
        transitionDuration: 200,
        revealChild: false,
        transition: 'slide_down',
        // duration: 200,
        halign: 'center',
        child: resultsBox,
    });
    const overviewTopRow = OverviewRow({
        startWorkspace: 1,
        workspaces: 5,
    });
    const overviewBottomRow = OverviewRow({
        startWorkspace: 6,
        workspaces: 5,
    });
    const overviewRevealer = Widget.Revealer({
        revealChild: true,
        transition: 'slide_down',
        transitionDuration: 200,
        child: Widget.Box({
            vertical: true,
            className: 'overview-tasks',
            children: [
                overviewTopRow,
                overviewBottomRow,
            ]
        }),
    });
    const entryPromptRevealer = Widget.Revealer({
        transition: 'crossfade',
        transitionDuration: 150,
        revealChild: true,
        halign: 'center',
        child: Widget.Label({
            className: 'overview-search-prompt',
            label: 'Search apps or calculate',
        })
    });

    const entryPrompt = Widget.Box({
        className: 'overview-search-icon-box',
        setup: box => box.pack_start(entryPromptRevealer, true, true, 0),
    });

    const entryIconRevealer = Widget.Revealer({
        transition: 'crossfade',
        transitionDuration: 150,
        revealChild: false,
        halign: 'end',
        child: Widget.Label({
            className: 'txt txt-large icon-material overview-search-icon',
            label: 'search',
        }),
    });

    const entryIcon = Widget.Box({
        className: 'overview-search-prompt-box',
        setup: box => box.pack_start(entryIconRevealer, true, true, 0),
    });

    const entry = Widget.Entry({
        className: 'overview-search-box txt-small txt',
        halign: 'center',
        onAccept: ({ text }) => { // This is when you press Enter
            ags.Service.MenuService.toggle('overview');;
            if (_appSearchResults.length > 0) {
                _appSearchResults[0].launch();
                return;
            }
            else {
                if (text[0] == '>') { // Custom commands
                    launchCustomCommand(text);
                    return;
                }
            }
            // Fallback: Execute command
            const args = text.split(' ');
            execAsync(args).catch(print);
        },
        // Actually onChange but this is ta workaround for a bug
        connections: [
            ['notify::text', (entry) => { // This is when you type
                resultsBox.get_children().forEach(ch => ch.destroy());
                //check empty if so then dont do stuff
                if (entry.text == '') {
                    resultsRevealer.set_reveal_child(false);
                    overviewRevealer.set_reveal_child(true);
                    entryPromptRevealer.set_reveal_child(true);
                    entryIconRevealer.set_reveal_child(false);
                    entry.toggleClassName('overview-search-box-extended', false);
                }
                else {
                    const text = entry.text;
                    resultsRevealer.set_reveal_child(true);
                    overviewRevealer.set_reveal_child(false);
                    entryPromptRevealer.set_reveal_child(false);
                    entryIconRevealer.set_reveal_child(true);
                    entry.toggleClassName('overview-search-box-extended', true);
                    _appSearchResults = Applications.query(text);

                    // Calculate if start with number
                    if (startsWithNumber(text)) {
                        const fullResult = eval(text);
                        console.log(fullResult);
                        resultsBox.add(Widget.Button({
                            className: 'overview-search-result-btn',
                            onClicked: () => {
                                ags.Service.MenuService.toggle('overview');
                                const args = text.split(' ');
                                execAsync(calculate).catch(print);
                            },
                            child: Widget.Box({
                                children: [
                                    Widget.Box({
                                        vertical: false,
                                        children: [
                                            Widget.Label({
                                                className: `icon-material overview-search-results-icon`,
                                                label: 'calculate',
                                            }),
                                            Widget.Label({
                                                className: 'overview-search-results-txt txt txt-norm',
                                                label: `${entry.text} = ${fullResult}`,
                                            })
                                        ]
                                    })
                                ]
                            })
                        }));
                    }

                    // Add application entries
                    let appsToAdd = MAX_RESULTS;
                    _appSearchResults.forEach(app => {
                        if (appsToAdd == 0) return;
                        resultsBox.add(Widget.Button({
                            className: 'overview-search-result-btn',
                            onClicked: () => {
                                ags.Service.MenuService.toggle('overview');;
                                app.launch();
                            },
                            child: Widget.Box({
                                children: [
                                    Widget.Box({
                                        vertical: false,
                                        children: [
                                            Widget.Icon({
                                                className: 'overview-search-results-icon',
                                                icon: app.iconName,
                                                size: 35, // TODO: Make this follow font size. made for 11pt.
                                            }),
                                            Widget.Label({
                                                className: 'overview-search-results-txt txt txt-norm',
                                                label: app.name,
                                            })
                                        ]
                                    })
                                ]
                            })
                        }));
                        appsToAdd--;
                    });

                    // Add fallback: run command
                    resultsBox.add(Widget.Button({
                        className: 'overview-search-result-btn',
                        onClicked: () => {
                            ags.Service.MenuService.toggle('overview');
                            const args = text.split(' ');
                            execAsync(args).catch(print);
                        },
                        child: Widget.Box({
                            children: [
                                Widget.Box({
                                    vertical: false,
                                    children: [
                                        Widget.Label({
                                            className: `icon-material overview-search-results-icon`,
                                            label: 'settings_b_roll',
                                        }),
                                        Widget.Label({
                                            className: 'overview-search-results-txt txt txt-norm',
                                            label: `Run command: ${entry.text}`,
                                        })
                                    ]
                                })
                            ]
                        })
                    }));

                    // Add fallback: search
                    resultsBox.add(Widget.Button({
                        className: 'overview-search-result-btn',
                        onClicked: () => {
                            ags.Service.MenuService.toggle('overview');
                            execAsync(['xdg-open', `https://www.google.com/search?q=${text}`]).catch(print);
                        },
                        child: Widget.Box({
                            children: [
                                Widget.Box({
                                    vertical: false,
                                    children: [
                                        Widget.Label({
                                            className: `icon-material overview-search-results-icon`,
                                            label: 'travel_explore',
                                        }),
                                        Widget.Label({
                                            className: 'overview-search-results-txt txt txt-norm',
                                            label: `Search "${entry.text}" on Google`,
                                        })
                                    ]
                                })
                            ]
                        })
                    }));
                    resultsBox.show_all();
                }
            }]
        ],
        // setup: entry => {
        //     entry.set_placeholder_text('Search apps or calculate');
        // }
    });

    return Widget.Box({
        vertical: true,
        children: [
            clickOutsideToClose,
            Widget.Box({
                halign: 'center',
                children: [
                    entry,
                    entryPrompt,
                    entryIcon,
                ]
            }),
            overviewRevealer,
            resultsRevealer,
        ],
        connections: [
            [App, (_b, name, visible) => {
                if (name !== 'overview')
                    return;

                if (visible);
                // entry.grab_focus();
                else {
                    resultsBox.children = [];
                    entry.set_text('');
                }
            }],
            ['key-press-event', (widget, event) => {
                if (event.get_keyval()[1] >= 32 && event.get_keyval()[1] <= 126 && widget != entry) {
                    entry.grab_focus();
                    entry.set_text(entry.text + String.fromCharCode(event.get_keyval()[1]));
                    entry.set_position(-1);
                }
            }]
        ],
    });
};
