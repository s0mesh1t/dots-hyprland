const { Gdk, GLib, Gtk, Pango } = imports.gi;
import { App, Utils, Widget } from '../../imports.js';
const { Box, Button, Entry, EventBox, Icon, Label, Revealer, Scrollable, Stack } = Widget;
const { execAsync, exec } = Utils;
import ChatGPT from '../../services/chatgpt.js';
import { MaterialIcon } from "../../lib/materialicon.js";
import { setupCursorHover, setupCursorHoverInfo } from "../../lib/cursorhover.js";
import { SystemMessage, ChatMessage } from "./chatmessage.js";

const chatWelcome = Box({
    vexpand: true,
    homogeneous: true,
    child: Box({
        className: 'spacing-v-15',
        vpack: 'center',
        vertical: true,
        children: [
            Icon({
                hpack: 'center',
                className: 'sidebar-chat-welcome-logo',
                icon: `${App.configDir}/assets/openai-logomark.svg`,
                setup: (self) => Utils.timeout(1, () => {
                    const styleContext = self.get_style_context();
                    const width = styleContext.get_property('min-width', Gtk.StateFlags.NORMAL);
                    const height = styleContext.get_property('min-height', Gtk.StateFlags.NORMAL);
                    self.size = Math.max(width, height, 1) * 116 / 180; // Why such a specific proportion? See https://openai.com/brand#logos
                })
            }),
            Label({
                className: 'txt txt-title-small sidebar-chat-welcome-txt',
                wrap: true,
                justify: Gtk.Justification.CENTER,
                label: 'ChatGPT',
            }),
            Box({
                className: 'spacing-h-5',
                hpack: 'center',
                children: [
                    Label({
                        className: 'txt-smallie txt-subtext',
                        wrap: true,
                        justify: Gtk.Justification.CENTER,
                        label: 'Powered by OpenAI',
                    }),
                    Button({
                        className: 'txt-subtext txt-norm icon-material',
                        label: 'info',
                        tooltipText: 'Uses the gpt-3.5-turbo model.\nNot affiliated, endorsed, or sponsored by OpenAI.',
                        setup: (self) => setupCursorHoverInfo(self),
                    }),
                ]
            }),
            Revealer({
                transition: 'slide_down',
                transitionDuration: 150,
                connections: [[ChatGPT, (self, hasKey) => {
                    self.revealChild = (ChatGPT.key.length == 0);
                }, 'hasKey']],
                child: Button({
                    child: Label({
                        useMarkup: true,
                        wrap: true,
                        className: 'txt sidebar-chat-welcome-txt',
                        justify: Gtk.Justification.CENTER,
                        label: 'An OpenAI API key is required\nYou can grab one <u>here</u>, then enter it below'
                    }),
                    setup: (button) => setupCursorHover(button),
                    onClicked: () => {
                        Utils.execAsync(['bash', '-c', `xdg-open https://platform.openai.com/api-keys &`]);
                    }
                })
            }),
        ]
    })
})

const chatContent = Box({
    className: 'spacing-v-15',
    vertical: true,
    connections: [
        [ChatGPT, (box, id) => {
            const message = ChatGPT.messages[id];
            if (!message) return;
            box.add(ChatMessage(message))
        }, 'newMsg'],
        [ChatGPT, (box) => {
            box.children = [chatWelcome];
        }, 'clear'],
        [ChatGPT, (box) => {
            box.children = [chatWelcome];
        }, 'initialized'],
    ]
});

const markdownTest = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
1. yes
2. no
127. well
- __Underline__ __ No underline __
- **Bold** ** No bold **
- **Italics** ** No Italics **
- A color: #D6BAFF
- another: #9A3B59
  - sub-item
\`\`\`javascript
// A code block!
myArray = [23, 123, 43, 54, '6969'];
console.log('uwu');
\`\`\`
To update arch lincox, run \`sudo pacman -Syu\`
`;

const sendChatMessage = () => {
    // Check if text or API key is empty
    if (chatEntry.text.length == 0) return;
    if (ChatGPT.key.length == 0) {
        ChatGPT.key = chatEntry.text;
        chatContent.add(SystemMessage(`Key saved to\n<tt>${ChatGPT.keyPath}</tt>`, 'API Key'));
        chatEntry.text = '';
        return;
    }
    // Commands
    if (chatEntry.text.startsWith('/')) {
        if (chatEntry.text.startsWith('/clear')) ChatGPT.clear();
        else if (chatEntry.text.startsWith('/model')) chatContent.add(SystemMessage(`Currently using <tt>${ChatGPT.modelName}</tt>`, '/model'))
        else if (chatEntry.text.startsWith('/key')) {
            const parts = chatEntry.text.split(' ');
            if (parts.length == 1) chatContent.add(SystemMessage(`See  <tt>${ChatGPT.keyPath}</tt>`, '/key'));
            else {
                ChatGPT.key = parts[1];
                chatContent.add(SystemMessage(`Updated API Key at\n<tt>${ChatGPT.keyPath}</tt>`, '/key'));
            }
        }
        else if (chatEntry.text.startsWith('/test'))
            chatContent.add(SystemMessage(markdownTest, `Markdown test`));
        else
            chatContent.add(SystemMessage(`Invalid command.`, 'Error'))
    }
    else {
        ChatGPT.send(chatEntry.text);
    }

    chatEntry.text = '';
}

const chatSendButton = Button({
    className: 'txt-norm icon-material sidebar-chat-send',
    vpack: 'center',
    label: 'arrow_upward',
    setup: (button) => setupCursorHover(button),
    onClicked: (btn) => sendChatMessage(),
});

export const chatEntry = Entry({
    className: 'sidebar-chat-entry',
    hexpand: true,
    connections: [
        [ChatGPT, (self, hasKey) => {
            self.placeholderText = (ChatGPT.key.length > 0 ? 'Ask a question...' : 'Enter OpenAI API Key...');
        }, 'hasKey']
    ],
    onChange: (entry) => {
        chatSendButton.toggleClassName('sidebar-chat-send-available', entry.text.length > 0);
    },
    onAccept: () => sendChatMessage(),
});

export default Widget.Box({
    vertical: true,
    className: 'spacing-v-10',
    homogeneous: false,
    children: [
        Scrollable({
            className: 'sidebar-chat-viewport',
            vexpand: true,
            child: chatContent,
            setup: (scrolledWindow) => {
                scrolledWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                const vScrollbar = scrolledWindow.get_vscrollbar();
                vScrollbar.get_style_context().add_class('sidebar-scrollbar');
            }
        }),
        Box({
            className: 'spacing-h-5',
            children: [
                Box({ hexpand: true }),
                Button({
                    className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
                    onClicked: () => chatEntry.text = '/key',
                    setup: (button) => setupCursorHover(button),
                    label: '/key',
                }),
                Button({
                    className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
                    onClicked: () => chatContent.add(SystemMessage(
                        `Currently using <tt>${ChatGPT.modelName}</tt>`,
                        '/model'
                    )),
                    setup: (button) => setupCursorHover(button),
                    label: '/model',
                }),
                Button({
                    className: 'sidebar-chat-chip sidebar-chat-chip-action txt txt-small',
                    onClicked: () => ChatGPT.clear(),
                    setup: (button) => setupCursorHover(button),
                    label: '/clear',
                }),
            ]
        }),
        Box({ // Entry area
            className: 'sidebar-chat-textarea spacing-h-10',
            children: [
                chatEntry,
                chatSendButton,
            ]
        }),
    ]
});