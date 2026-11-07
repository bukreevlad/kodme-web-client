// ***************************************************************************
// Глобальные объявления приложения (window.*, токены сборки).
// ***************************************************************************

// Импортируем типы
import type { AudioPlayerManager } from "../utils/audio/audio_player.js";
import type { KodmeDesktopBridge } from "../utils/platform.bridge.js";
import type { AndroidDownloadMessage } from "../utils/network/file_downloader.js";

declare global {
    interface Window {
        /** Глобальный аудиопроигрыватель (записывается в main). */
        audioPlayer: AudioPlayerManager;
        /** Мост десктоп-обёртки Electron (exposeInMainWorld из preload.js). */
        kodmeDesktop?: KodmeDesktopBridge;
        /** Legacy-конструктор WebKit AudioContext (старые Safari). */
        webkitAudioContext?: typeof AudioContext;
        /** Мост WebKit-обёртки iOS (window.webkit.messageHandlers.iosBridge). */
        webkit?: {
            messageHandlers?: {
                iosBridge?: {
                    postMessage(message: unknown): void;
                };
            };
        };
        /** File System Access API: сохранение файла через системный диалог. */
        showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<FileSystemFileHandle>;
    }

    /**
     * Собственные события window приложения: типизация `detail` для
     * `window.addEventListener("<имя события>", handler)`.
     */
    interface WindowEventMap {
        /** Запуск медиа: `detail.type` — "audio" либо "video", `detail.id` — id источника. */
        "[app][audio]::media-play": CustomEvent<{ type: string; id?: string }>;
        /** Статус скачивания файла из нативной Android-обёртки (FileDownloader). */
        "AndroidDownloadEvent": CustomEvent<AndroidDownloadMessage>;
        /** Клик по нативному уведомлению десктоп-обёртки Electron (detail — данные уведомления). */
        "DesktopNotificationClick": CustomEvent<Record<string, unknown>>;
    }

    /**
     * Legacy-конструктор WebKit AudioContext (старые Safari). Объявлен и как
     * глобальная переменная: код опознаёт Web Audio через `globalThis`.
     */
    var webkitAudioContext: typeof AudioContext | undefined;

    /**
     * Токены сборки — подставляются bun.build.js текстовой заменой в бандле.
     */

    /** Имя файла Service Worker (подставляется при сборке). */
    const __SW_FILE_NAME__: string;

    /** Версия сборки (подставляется при сборке). */
    const __BUILD_VERSION__: string;

    /** Время сборки в ISO (подставляется при сборке). */
    const __BUILD_AT__: string;
}
