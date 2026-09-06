import { windows, groups, nextWindowId, nextZIndex, getTopLevelRects } from './state.js';
import { makeDraggable, makeMinSizeClamped } from './drag.js';
import { getSettings } from './settings.js';
import { createGroup } from './groups.js';

const MIN_WIDTH = 240;
const MIN_HEIGHT = 200;

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export class VideoWindow {
    /**
     * @param {{src: string, title: string, objectUrl?: string}} opts
     */
    constructor({ src, title, objectUrl }) {
        const settings = getSettings();
        this.id = nextWindowId();
        this.objectUrl = objectUrl ?? null;
        this.groupId = null;

        this.el = document.createElement('div');
        this.el.className = 'draggable videoPlayerWindow';
        this.el.id = this.id;
        this.el.style.left = '80px';
        this.el.style.top = '80px';
        this.el.style.width = '420px';
        this.el.style.height = '320px';

        const titleBar = document.createElement('div');
        titleBar.className = 'dragTitle';
        titleBar.textContent = title;

        const controlBar = document.createElement('div');
        controlBar.className = 'panelControlBar flex-container';

        const grabber = document.createElement('div');
        grabber.className = 'fa-fw fa-solid fa-grip drag-grabber';
        grabber.id = `${this.id}header`;

        const groupButton = document.createElement('div');
        groupButton.className = 'fa-fw fa-solid fa-object-group vpwGroupButton';
        groupButton.title = 'Add to a video window group';

        const closeButton = document.createElement('div');
        closeButton.className = 'fa-fw fa-solid fa-circle-xmark dragClose';
        closeButton.id = `${this.id}close`;
        closeButton.dataset.relatedId = this.id;

        controlBar.append(grabber, groupButton, closeButton);

        const body = document.createElement('div');
        body.className = 'vpwBody';

        this.videoEl = document.createElement('video');
        this.videoEl.className = 'vpwVideo';
        this.videoEl.src = src;
        this.videoEl.loop = settings.defaultLoop;
        this.videoEl.volume = settings.defaultVolume / 100;
        this.videoEl.playbackRate = settings.defaultSpeed;
        this.videoEl.autoplay = true;
        this.videoEl.draggable = false;
        body.appendChild(this.videoEl);

        const controls = document.createElement('div');
        controls.className = 'vpwControls flex-container';

        this.playPauseButton = document.createElement('div');
        this.playPauseButton.className = 'menu_button vpwPlayPause fa-solid fa-pause';
        this.playPauseButton.title = 'Play / Pause';

        this.volumeInput = document.createElement('input');
        this.volumeInput.type = 'range';
        this.volumeInput.className = 'vpwVolume';
        this.volumeInput.min = '0';
        this.volumeInput.max = '100';
        this.volumeInput.step = '1';
        this.volumeInput.value = String(settings.defaultVolume);
        this.volumeInput.title = 'Volume';

        this.loopButton = document.createElement('div');
        this.loopButton.className = 'menu_button vpwLoop fa-solid fa-repeat';
        this.loopButton.title = 'Loop';
        this.loopButton.classList.toggle('active', settings.defaultLoop);

        this.speedSelect = document.createElement('select');
        this.speedSelect.className = 'vpwSpeed text_pole';
        this.speedSelect.title = 'Playback speed';
        for (const speed of SPEED_OPTIONS) {
            const option = document.createElement('option');
            option.value = String(speed);
            option.textContent = `${speed.toFixed(2)}x`;
            if (speed === settings.defaultSpeed) {
                option.selected = true;
            }
            this.speedSelect.appendChild(option);
        }

        controls.append(this.playPauseButton, this.volumeInput, this.loopButton, this.speedSelect);

        this.el.append(titleBar, controlBar, body, controls);

        this.groupDropdown = null;
        this._wireEvents(groupButton, closeButton);
        this._wireDrag(grabber);

        this.resizeObserver = makeMinSizeClamped(this.el, MIN_WIDTH, MIN_HEIGHT);

        windows.set(this.id, this);
    }

    _wireEvents(groupButton, closeButton) {
        this.playPauseButton.addEventListener('click', () => {
            if (this.videoEl.paused) {
                this.videoEl.play();
            } else {
                this.videoEl.pause();
            }
        });
        this.videoEl.addEventListener('play', () => {
            this.playPauseButton.classList.remove('fa-play');
            this.playPauseButton.classList.add('fa-pause');
        });
        this.videoEl.addEventListener('pause', () => {
            this.playPauseButton.classList.remove('fa-pause');
            this.playPauseButton.classList.add('fa-play');
        });

        this.volumeInput.addEventListener('input', () => {
            const value = Number(this.volumeInput.value);
            this.videoEl.volume = value / 100;
            this.videoEl.muted = value === 0;
        });

        this.loopButton.addEventListener('click', () => {
            this.videoEl.loop = !this.videoEl.loop;
            this.loopButton.classList.toggle('active', this.videoEl.loop);
        });

        this.speedSelect.addEventListener('change', () => {
            this.videoEl.playbackRate = parseFloat(this.speedSelect.value);
        });

        this.el.addEventListener('mousedown', () => this.bringToFront(), true);

        groupButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleGroupDropdown(groupButton);
        });

        closeButton.addEventListener('click', () => this.destroy());
    }

    _toggleGroupDropdown(anchorEl) {
        if (this.groupDropdown) {
            this.groupDropdown.remove();
            this.groupDropdown = null;
            return;
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'vpwGroupDropdown';

        const newGroupItem = document.createElement('div');
        newGroupItem.className = 'vpwGroupDropdownItem';
        newGroupItem.textContent = 'New group';
        newGroupItem.addEventListener('click', () => {
            const group = createGroup({});
            group.addMember(this);
            closeDropdown();
        });
        dropdown.appendChild(newGroupItem);

        if (groups.size > 0) {
            const separator = document.createElement('div');
            separator.className = 'vpwGroupDropdownSeparator';
            dropdown.appendChild(separator);

            for (const group of groups.values()) {
                const item = document.createElement('div');
                item.className = 'vpwGroupDropdownItem';
                item.textContent = group.title;
                item.addEventListener('click', () => {
                    group.addMember(this);
                    closeDropdown();
                });
                dropdown.appendChild(item);
            }
        }

        const closeDropdown = () => {
            dropdown.remove();
            this.groupDropdown = null;
            document.removeEventListener('mousedown', outsideClickHandler, true);
        };
        const outsideClickHandler = (e) => {
            if (!dropdown.contains(e.target)) {
                closeDropdown();
            }
        };
        setTimeout(() => document.addEventListener('mousedown', outsideClickHandler, true), 0);

        anchorEl.appendChild(dropdown);
        this.groupDropdown = dropdown;
    }

    _wireDrag(grabber) {
        this._destroyDrag = makeDraggable(
            this.el,
            grabber,
            () => getTopLevelRects(this.groupId ?? this.id),
            () => this.bringToFront(),
        );
    }

    /** Disables independent dragging while this window is nested inside a group. */
    setDragEnabled(enabled) {
        const grabber = this.el.querySelector('.drag-grabber');
        if (grabber) {
            grabber.style.visibility = enabled ? '' : 'hidden';
            grabber.style.pointerEvents = enabled ? '' : 'none';
        }
    }

    bringToFront() {
        this.el.style.zIndex = String(nextZIndex());
    }

    /** @returns {import('./snapping.js').Rect} */
    getRect() {
        const rect = this.el.getBoundingClientRect();
        return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    }

    destroy() {
        if (this.groupId) {
            const group = groups.get(this.groupId);
            group?.removeMember(this.id, { keepPosition: false });
        }
        this.resizeObserver?.disconnect();
        this._destroyDrag?.();
        this.videoEl.pause();
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
        }
        this.el.remove();
        windows.delete(this.id);
    }
}

/**
 * @param {{src: string, title: string, objectUrl?: string}} opts
 * @returns {VideoWindow}
 */
export function createVideoWindow(opts) {
    const win = new VideoWindow(opts);
    document.getElementById('movingDivs').appendChild(win.el);
    win.bringToFront();
    return win;
}
