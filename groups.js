import { groups, windows, nextGroupId, nextZIndex, getTopLevelRects } from './state.js';
import { makeDraggable } from './drag.js';

const HEADER_HEIGHT = 28;
const MEMBER_GAP = 8;

/**
 * A video window group: a container `<div>` that member VideoWindow elements are
 * reparented into. Because members become real DOM children, dragging the group's
 * header moves every member automatically via normal CSS layout - no per-member
 * offset bookkeeping needed, and "maintains relative positions" falls out for free.
 */
export class VideoWindowGroup {
    constructor({ title }) {
        this.id = nextGroupId();
        this.title = title || `Group ${this.id.replace('vpw_grp_', '')}`;
        /** @type {string[]} */
        this.memberIds = [];
        this._destroying = false;

        this.el = document.createElement('div');
        this.el.className = 'videoWindowGroup';
        this.el.id = this.id;
        this.el.style.left = '120px';
        this.el.style.top = '120px';
        this.el.style.width = '300px';
        this.el.style.height = `${HEADER_HEIGHT}px`;

        const header = document.createElement('div');
        header.className = 'vwgHeader panelControlBar flex-container';

        const grabber = document.createElement('div');
        grabber.className = 'fa-fw fa-solid fa-grip drag-grabber';
        grabber.id = `${this.id}header`;

        const titleEl = document.createElement('span');
        titleEl.className = 'vwgTitle';
        titleEl.textContent = this.title;

        const closeButton = document.createElement('div');
        closeButton.className = 'fa-fw fa-solid fa-circle-xmark dragClose';
        closeButton.id = `${this.id}close`;
        closeButton.dataset.relatedId = this.id;
        closeButton.title = 'Ungroup';
        closeButton.addEventListener('click', () => this.destroy());

        header.append(grabber, titleEl, closeButton);
        this.el.appendChild(header);
        this.headerEl = header;

        this._destroyDrag = makeDraggable(
            this.el,
            grabber,
            () => getTopLevelRects(this.id),
            () => this.bringToFront(),
        );

        document.getElementById('movingDivs').appendChild(this.el);
        groups.set(this.id, this);
        this.bringToFront();
    }

    bringToFront() {
        this.el.style.zIndex = String(nextZIndex());
    }

    /** @param {import('./window.js').VideoWindow} win */
    addMember(win) {
        if (win.groupId === this.id) {
            return;
        }
        if (win.groupId) {
            const previousGroup = groups.get(win.groupId);
            previousGroup?.removeMember(win.id);
        }

        this.el.appendChild(win.el);
        win.el.style.top = `${HEADER_HEIGHT}px`;
        win.setDragEnabled(false);
        win.groupId = this.id;
        this.memberIds.push(win.id);

        this._layoutMembers();
    }

    /**
     * @param {string} windowId
     * @param {{keepPosition?: boolean}} [opts] - keepPosition=false skips the reposition-back-to-
     *   viewport step, used when the window is being destroyed anyway (its DOM node goes away).
     */
    removeMember(windowId, opts = {}) {
        const { keepPosition = true } = opts;
        const win = windows.get(windowId);
        const index = this.memberIds.indexOf(windowId);
        if (index === -1) {
            return;
        }
        this.memberIds.splice(index, 1);

        if (win) {
            win.groupId = null;
            if (keepPosition) {
                const memberRect = win.el.getBoundingClientRect();
                document.getElementById('movingDivs').appendChild(win.el);
                win.el.style.left = `${memberRect.left}px`;
                win.el.style.top = `${memberRect.top}px`;
                win.setDragEnabled(true);
            }
        }

        if (this.memberIds.length === 0 && !this._destroying) {
            this.destroy();
        } else if (this.memberIds.length > 0) {
            this._layoutMembers();
        }
    }

    /** Arranges all current members left-to-right in a row and grows the container to fit. */
    _layoutMembers() {
        let nextLeft = MEMBER_GAP;
        let maxBottom = HEADER_HEIGHT;

        for (const memberId of this.memberIds) {
            const win = windows.get(memberId);
            if (!win) {
                continue;
            }
            win.el.style.left = `${nextLeft}px`;
            win.el.style.top = `${HEADER_HEIGHT}px`;
            nextLeft += win.el.offsetWidth + MEMBER_GAP;
            maxBottom = Math.max(maxBottom, HEADER_HEIGHT + win.el.offsetHeight);
        }

        this.el.style.width = `${Math.max(nextLeft, 300)}px`;
        this.el.style.height = `${maxBottom + MEMBER_GAP}px`;
    }

    /** @returns {import('./snapping.js').Rect} */
    getRect() {
        const rect = this.el.getBoundingClientRect();
        return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    }

    destroy() {
        if (this._destroying) {
            return;
        }
        this._destroying = true;
        for (const memberId of Array.from(this.memberIds)) {
            this.removeMember(memberId, { keepPosition: true });
        }
        this._destroyDrag?.();
        this.el.remove();
        groups.delete(this.id);
    }
}

/**
 * @param {{title?: string}} opts
 * @returns {VideoWindowGroup}
 */
export function createGroup(opts = {}) {
    return new VideoWindowGroup(opts);
}
