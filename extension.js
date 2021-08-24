/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const { PACKAGE_VERSION } = imports.misc.config;
const { GLib, Gio } = imports.gi;
const PopupMenu = imports.ui.popupMenu;
const BoxPointer = imports.ui.boxpointer;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// i18n
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

// Get running instance
const Main = imports.ui.main;
const { panel } = Main;

// D-Bus
const ManagerInterface = `<node>
  <interface name="org.freedesktop.login1.Manager">
    <method name="Reboot">
      <arg type="b" direction="in"/>
    </method>
  </interface>
</node>`;
const Manager = Gio.DBusProxy.makeProxyWrapper(ManagerInterface);

class Extension {
    constructor() {
        this._systemIndicator = panel.statusArea.aggregateMenu._system;
    }

    enable() {
        this._proxy = new Manager(Gio.DBus.system,
            'org.freedesktop.login1',
            '/org/freedesktop/login1');

        // Create hibernate action item
        this._item = new PopupMenu.PopupMenuItem(_('Reboot to Windows'));
        this._item.connect('activate', () => {
            this._systemIndicator.menu.itemActivated(BoxPointer.PopupAnimation.NONE);
            this._reboot();
        });

        // Update menu item visibility
        this._sessionUpdatedId = Main.sessionMode.connect('updated',
            this._sessionUpdated.bind(this));
        this._sessionUpdated();

        // Add to session submenu
        const itemIdx = (PACKAGE_VERSION > '3.38') ? 1 : 4;
        this._systemIndicator._sessionSubMenu.menu.addMenuItem(this._item, itemIdx);
    }

    disable() {
        Main.sessionMode.disconnect(this._sessionUpdatedId);
        this._item.destroy();
        this._item = null;
        this._proxy = null;
    }

    _sessionUpdated() {
        this._item.visible = true;
    }

    _reboot() {
        GLib.spawn_command_line_async(`efibootmgr | awk '/Windows Boot Manager/ { print $1 }' | cut -c 5-8 | xargs sudo efibootmgr -n`)
        this._proxy.RebootRemote(true);
    }
}

function init() {
    return new Extension();
}
