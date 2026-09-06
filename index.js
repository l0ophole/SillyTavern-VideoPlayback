import { renderExtensionTemplateAsync } from '../../../extensions.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandNamedArgument, ARGUMENT_TYPE } from '../../../slash-commands/SlashCommandArgument.js';
import { VIDEO_EXTENSIONS } from '../../../constants.js';
import { createVideoWindow } from './window.js';
import { createGroup } from './groups.js';
import { windows, groups, closeAllVideoWindows } from './state.js';
import { getSettings, persistSettings } from './settings.js';

const EXTENSION_NAME = 'SillyTavern-VideoPlayback';

function openFilePicker() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = `video/*,${VIDEO_EXTENSIONS.map(ext => `.${ext}`).join(',')}`;
        input.style.display = 'none';

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            input.remove();
            if (file) {
                resolve(file);
            } else {
                reject(new Error('No file selected'));
            }
        });
        input.addEventListener('cancel', () => {
            input.remove();
            reject(new Error('File selection cancelled'));
        });

        document.body.appendChild(input);
        input.click();
    });
}

async function openFilePickerAndCreateWindow() {
    const file = await openFilePicker();
    const objectUrl = URL.createObjectURL(file);
    createVideoWindow({ src: objectUrl, title: file.name, objectUrl });
}

function playFromUrl(source) {
    const title = String(source).split('/').pop() || String(source);
    createVideoWindow({ src: String(source), title });
}

function addWandButton() {
    const container = document.createElement('div');
    container.id = 'video_playback_wand_container';
    container.classList.add('extension_container');

    const playItem = document.createElement('div');
    playItem.id = 'video_playback_play_button';
    playItem.classList.add('list-group-item', 'flex-container', 'flexGap5', 'interactable');
    playItem.tabIndex = 0;
    playItem.innerHTML = '<div class="fa-fw fa-solid fa-film extensionsMenuExtensionButton"></div><span>Play a video</span>';
    playItem.addEventListener('click', async () => {
        try {
            await openFilePickerAndCreateWindow();
        } catch (error) {
            console.debug('Video Playback: file picker cancelled or failed', error);
        }
    });

    const closeAllItem = document.createElement('div');
    closeAllItem.id = 'video_playback_close_all_button';
    closeAllItem.classList.add('list-group-item', 'flex-container', 'flexGap5', 'interactable');
    closeAllItem.tabIndex = 0;
    closeAllItem.innerHTML = '<div class="fa-fw fa-solid fa-xmark extensionsMenuExtensionButton"></div><span>Close all video windows</span>';
    closeAllItem.addEventListener('click', () => closeAllVideoWindows());

    const groupItem = document.createElement('div');
    groupItem.id = 'video_playback_group_button';
    groupItem.classList.add('list-group-item', 'flex-container', 'flexGap5', 'interactable');
    groupItem.tabIndex = 0;
    groupItem.innerHTML = '<div class="fa-fw fa-solid fa-object-group extensionsMenuExtensionButton"></div><span>Create a video window group</span>';
    groupItem.addEventListener('click', () => createGroup({}));

    container.append(playItem, closeAllItem, groupItem);
    document.getElementById('extensionsMenu')?.appendChild(container);
}

async function addSettingsDrawer() {
    const settings = getSettings();
    const html = await renderExtensionTemplateAsync(`third-party/${EXTENSION_NAME}`, 'index');
    const drawer = $(html);

    drawer.find('#vpw_default_volume').val(settings.defaultVolume).on('input', function () {
        settings.defaultVolume = Number($(this).val());
        persistSettings();
    });
    drawer.find('#vpw_default_speed').val(String(settings.defaultSpeed)).on('change', function () {
        settings.defaultSpeed = parseFloat(String($(this).val()));
        persistSettings();
    });
    drawer.find('#vpw_default_loop').prop('checked', settings.defaultLoop).on('change', function () {
        settings.defaultLoop = $(this).prop('checked');
        persistSettings();
    });
    drawer.find('#vpw_snap_enabled').prop('checked', settings.snapEnabled).on('change', function () {
        settings.snapEnabled = $(this).prop('checked');
        persistSettings();
    });
    drawer.find('#vpw_snap_threshold').val(settings.snapThreshold).on('input', function () {
        settings.snapThreshold = Number($(this).val());
        persistSettings();
    });

    $('#extensions_settings2').append(drawer);
}

function registerSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'video-play',
        callback: async (namedArgs) => {
            if (namedArgs.source) {
                playFromUrl(namedArgs.source);
                return '';
            }
            try {
                await openFilePickerAndCreateWindow();
            } catch (error) {
                toastr.warning('Could not open the file picker from a slash command in this context. Use the "Play a video" wand-menu button instead.');
            }
            return '';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'source',
                description: 'URL of an already-hosted video to play (local files must be opened via the "Play a video" button due to browser file-access restrictions)',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: 'Opens a new video window. With no arguments, opens a native file picker to choose a local video. With source=<url>, plays a video already reachable by URL.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'video-close-all',
        callback: () => {
            closeAllVideoWindows();
            return '';
        },
        helpString: 'Closes all open video windows and video window groups.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'video-group-create',
        callback: (namedArgs) => {
            const group = createGroup({ title: namedArgs.name ? String(namedArgs.name) : undefined });
            return group.id;
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'Display name for the group',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        returns: 'the new group\'s internal id (for use with /video-group-add)',
        helpString: 'Creates a new empty video window group. Returns its id.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'video-group-add',
        callback: (namedArgs) => {
            const group = groups.get(String(namedArgs.group));
            const win = windows.get(String(namedArgs.window));
            if (!group || !win) {
                toastr.error('Unknown video window group or window id.');
                return '';
            }
            group.addMember(win);
            return '';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'group',
                description: 'Group id (from /video-group-create)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'window',
                description: 'Video window id',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Adds an existing video window to an existing video window group.',
    }));
}

export async function init() {
    addWandButton();
    await addSettingsDrawer();
    registerSlashCommands();
}
