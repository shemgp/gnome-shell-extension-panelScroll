// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Gdk = imports.gi.Gdk;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Conf = imports.misc.config;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const POSITION = {
    LEFT: 0,
    RIGHT: 1
};

class PanelScroll {
    constructor() {
        this._allMonitor = false;
        this._time = 0;

        this.wm = global.workspace_manager;

        this.previousDirection = Meta.MotionDirection.UP;
        this.listPointer = 0;

        this.scrollEventId = Main.panel.connect('scroll-event', this.scrollEvent.bind(this));
    }

    scrollEvent(actor, event) {
        let direction;
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            direction = Meta.MotionDirection.UP;
            break;
        case Clutter.ScrollDirection.DOWN:
            direction = Meta.MotionDirection.DOWN;
            break;
        default:
            return Clutter.EVENT_STOP;
        }

        let gap = event.get_time() - this._time;
        if (gap < 500 && gap >= 0)
            return Clutter.EVENT_STOP;
        this._time = event.get_time();

        switch (this.pointerOnPanel()) {
        case POSITION.LEFT:
            this.switchWindows(direction);
            break;
        case POSITION.RIGHT:
            this.switchWorkspace(direction);
            break;
        }

        return Clutter.EVENT_STOP;
    }

    pointerOnPanel() {
        let [x, y, mod] =global.get_pointer();

        let currentMonitor;
        let currentMonitorIndex = global.display.get_current_monitor();
        currentMonitor = global.display.get_monitor_geometry(currentMonitorIndex);

        if (x < (currentMonitor.x + currentMonitor.width / 2))
            return POSITION.LEFT;

        let aggregateMenu = Main.panel._rightBox.get_last_child().get_first_child();
        if (x < (currentMonitor.x + currentMonitor.width - aggregateMenu.width))
            return POSITION.RIGHT;

        return null;
    }

    switchWindows(direction) {
        let windows = this.getWindows();
        if (windows.length <= 1)
            return;

        if (direction != this.previousDirection) {
            this.listPointer = 1;
        } else {
            this.listPointer += 1;
            if (this.listPointer > windows.length - 1)
                this.listPointer = windows.length -1;
        }
        this.previousDirection = direction;
        windows[this.listPointer].activate(global.get_current_time());
    }

    switchWorkspace(direction) {
        let ws = this.getWorkSpace();

        let activeIndex = this.wm.get_active_workspace_index();

        let newWs;
        if (direction == Meta.MotionDirection.UP) {
            if (activeIndex == 0 )
                newWs = ws.length - 1;
            else
                newWs = activeIndex - 1;
        } else {
            if (activeIndex == (ws.length - 1) )
                newWs = 0;
            else
                newWs = activeIndex + 1;
        }

        this.actionMoveWorkspace(ws[newWs]);
        this.switcherPopup(direction, ws[newWs]);
    }

    switcherPopup(direction, newWs) {
        if (!Main.overview.visible) {
            if (this._workspaceSwitcherPopup == null) {
                Main.wm._workspaceTracker.blockUpdates();
                this._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                this._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceTracker.unblockUpdates();
                    this._workspaceSwitcherPopup = null;
                });
            }
            this._workspaceSwitcherPopup.display(direction, newWs.index());
        }
    }

    getWorkSpace() {
        let activeWs = this.wm.get_active_workspace();

        let activeIndex = activeWs.index();
        let ws = [];

        ws[activeIndex] = activeWs;

        const vertical = this.wm.layout_rows === -1;
        for (let i = activeIndex - 1; i >= 0; i--) {
            if (vertical)
                ws[i] = ws[i + 1].get_neighbor(Meta.MotionDirection.UP);
            else
                ws[i] = ws[i + 1].get_neighbor(Meta.MotionDirection.LEFT);
        }

        for (let i = activeIndex + 1; i < this.wm.n_workspaces; i++) {
            if (vertical)
                ws[i] = ws[i - 1].get_neighbor(Meta.MotionDirection.DOWN);
            else
                ws[i] = ws[i - 1].get_neighbor(Meta.MotionDirection.RIGHT);
        }

        return ws;
    }

    actionMoveWorkspace(workspace) {
        if (!Main.sessionMode.hasWorkspaces)
            return;

        let activeWorkspace = this.wm.get_active_workspace();

        if (activeWorkspace != workspace)
            workspace.activate(global.get_current_time());
    }

    getWindows() {
        let currentWorkspace = this.wm.get_active_workspace();

        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, currentWorkspace);
        windows.map(w => {
            return w.is_attached_dialog() ? w.get_transient_for() : w;
        }).filter((w, i, a) => !w.skip_taskbar && a.indexOf(w) == i);

        return windows;
    }

    destroy() {
        if (this.scrollEventId != null) {
            Main.panel.disconnect(this.scrollEventId);
            this.scrollEventId = null;
        }
    }
}

let panelScroll;

function init(metadata) {
}

function enable() {
    panelScroll = new PanelScroll();
}

function disable() {
    panelScroll.destroy();
    panelScroll = null;
}
