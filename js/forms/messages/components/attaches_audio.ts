// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { FileDownloader } from "../../../utils/network/file_downloader.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { ProgressIndicator } from "../../../components/progress.js";

// Импортируем handlers
import { audioContextMenuHandler } from "./handlers/audio_context_menu.js";

// Импортируем типы
import type { AudioPlayerCallback, AudioPlayerState, AudioPlayerTrack } from "../../../utils/audio/audio_player.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";
import { normalizeAttachments } from "./types.js";
import type { AttachParent, AttachmentData } from "./types.js";

/**
 * ***************************************************************************
 * createAudioItem - строка аудио сообщения: название, исполнитель,
 * длительность, кнопка Play/Pause и прогресс скачивания.
 *
 * Синхронизируется с глобальным AudioPlayerManager через систему подписок.
 * @param message - Родительское сообщение.
 * @param data - Данные вложения (id, name, metadata и т.д.).
 * @returns DOM-элемент вложения.
 * ***************************************************************************
 */
export function createAudioItem(message: AttachParent, data: AttachmentData): HTMLElement {

    // Актуальные данные вложения: __update__ может подменить объект
    let current = data;

    // Состояние загрузки и воспроизведения
    let downloader: FileDownloader | null = null;
    let progress: ProgressIndicator | null = null;
    let isDownloadProccess = false;
    let playButton: Buttons | null = null;
    let playlist: AudioPlayerTrack[] = [];
    let durationEl: HTMLElement | null = null;

    // **************************************************************************
    // Шаблон элемента
    // **************************************************************************
    function template(): HTMLElement {

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div class="item audio flex flex-row items-center w-full gap-2 p-1 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <button action-play></button>
                <div class="flex flex-col gap-0 justify-center min-w-40 overflow-hidden flex-1">
                    <div class="flex flex-col gap-0">
                        <div class="flex flex-row justify-between items-center gap-2">
                            <span data-title class="font-semibold truncate"></span>
                            <span data-duration class="text-muted text-xs"></span>
                        </div>
                        <span data-artist class="text-sm text-secondary truncate"></span>
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;
    }

    // **************************************************************************
    // Установка/Перерисовка данных
    // **************************************************************************
    function setup(data: AttachmentData): void {

        try {

            // Обновляем данные
            current = data;

            // Устанавливаем элементы
            let playPlaceholder = element.querySelector("[action-play]");
            const titleEl = element.querySelector<HTMLElement>(":scope [data-title]");
            const artistEl = element.querySelector<HTMLElement>(":scope [data-artist]");
            durationEl = element.querySelector<HTMLElement>(":scope [data-duration]");

            // Текстовые узлы входят в шаблон — без них нечего заполнять
            if (!titleEl || !artistEl || !durationEl) return;

            // Устанавливаем кнопку управления
            playButton = Buttons.circle({
                attributes: ["action-play-filled"],
                classes: ["relative"],
                icon: { name: "player-play", settings: { filled: true } },
                intent: "primary"
            });

            // Заменяем элемент кнопки
            if (playPlaceholder) {
                playPlaceholder.replaceWith(playButton.dom);
            }

            // Извлекаем теги и инфо
            const tags = current.metadata?.tags;
            const original = current.metadata?.original;

            // Заполняем текстовые данные
            titleEl.textContent = tags?.title || current.name || "Untitled";
            artistEl.textContent = tags?.artist || message.data.display_name || "Unknown Artist";

            // Длительность
            if (original?.duration) {
                durationEl.textContent = formatTime(original.duration);
            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    // **************************************************************************
    // Обработчики
    // **************************************************************************
    function actions(): void {

        // GestureController
        new GestureController(element, {
            threshold: 5,
            onContextMenu: (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!IsMobile.get()) {
                    audioContextMenuHandler(event, { initDownload });
                }
            },
            tap: {
                longTapTimeout: 500,
                onTap: async (event) => {
                    proccessPlayer(event);
                }
            }
        });

    }

    // **************************************************************************
    // Глобальные обработчики
    // **************************************************************************
    function globalEvents(): void {

        // Ключ подписки — идентификатор вложения: рассылка идёт всем
        // подписчикам, компонент фильтрует состояние по trackId сам
        const playerCallback: AudioPlayerCallback = (info) => handlePlayerUpdate(info);
        if (window.audioPlayer) {
            window.audioPlayer.subscribe(String(current.id), playerCallback);
        }

    }

    // **************************************************************************
    // Обработка данных от плеера
    // **************************************************************************
    function handlePlayerUpdate(info: Partial<AudioPlayerState>): void {

        // Если играет наш трек
        if (info.trackId === current.id) {
            renderProgress(info);
            playButton?.setIcon(info.isPlaying ? "player-pause" : "player-play", { settings: { filled: true } });
        } else {
            // Если играет что-то другое или плеер закрыт
            resetUI();
        }

    }

    // **************************************************************************
    // Метод для отрисовки прогресса в конкретном сообщении
    // **************************************************************************
    function renderProgress(info: Partial<AudioPlayerState>): void {

        // currentTime опционален в событии — undefined нормализуем к null
        if (durationEl) durationEl.textContent = info.currentTime ?? null;

    }

    // **************************************************************************
    // Сброс состояния
    // **************************************************************************
    function resetUI(): void {

        playButton?.setIcon("player-play", { settings: { filled: true } });
        const originalDuration = current.metadata?.original?.duration;
        if (originalDuration && durationEl) durationEl.textContent = formatTime(originalDuration);

    }

    // **************************************************************************
    // Форматирование времени
    // **************************************************************************
    function formatTime(seconds: number): string {
        if (!seconds) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    // **************************************************************************
    // Логика запуска загрузки
    // **************************************************************************
    async function startDownload(): Promise<void> {
        isDownloadProccess = true;

        try {

            // Инициализация прогресс-бара
            progress = new ProgressIndicator({ width: "100%" });
            playButton?.dom?.appendChild(progress.getElement());
            progress.setProcessing();

            // Иконка "X" для отмены
            playButton?.setIcon("X");

            // Создаем загрузчик (без id хранилище не найдёт файл —
            // качать нечего)
            if (current.id == null) return;

            downloader = new FileDownloader({
                url: StorageUrl.forStorage(current.id),
                file_token: current.token,
                file_name: current.file_name,
                callback: (loaded, total, percent) => {
                    if (progress) progress.update(percent);
                }
            });

            // Ждём завершения загрузки
            await downloader.download();

        } catch (error) {
            if (getErrorName(error) !== "AbortError") {
                Logger.error("Download Error:", error);
            }
        } finally {
            cleanupUI();
            isDownloadProccess = false;
        }
    }

    // **************************************************************************
    // Принудительная остановка
    // **************************************************************************
    function abortDownload(): void {
        if (downloader) downloader.destroy();
        cleanupUI();
    }

    // **************************************************************************
    // Очистка UI после загрузки/ошибки/отмены
    // **************************************************************************
    function cleanupUI(): void {

        // Удаляем прогресс
        if (progress) {
            progress.destroy();
            progress = null;
        }

        // Очищаем данные
        downloader = null;
        isDownloadProccess = false;

        // Возвращаем корректную иконку
        playButton?.setIcon("player-play", { settings: { filled: true } });

    }

    // **************************************************************************
    // Инициализация загрузки или открытия
    // **************************************************************************
    async function initDownload(): Promise<void> {

        // Если идет скачивание
        if (isDownloadProccess) return;

        // Начинаем процесс загрузки
        await startDownload();

    }

    // **************************************************************************
    // Логика запуска плеера
    // **************************************************************************
    function proccessPlayer(event: Event): void {

        // Если этот трек уже загружен в плеер — просто переключаем Play/Pause
        if (window.audioPlayer.audioData?.id === current.id) {
            window.audioPlayer.toggle();
        } else {

            // Иначе собираем плейлист из сообщения и запускаем.
            // Нормализуем: сервер отдаёт массив, локальные (temp/pending) — объект-мап.
            const attachments = normalizeAttachments(message.data?.attachments);
            playlist = attachments
                .filter(at => isKind("audio", at.mime_type || at.type))
                .map(at => ({
                    ...at,
                    // Контракт плеера требует строки — без имени оставляем пусто
                    author: at.author || at.metadata?.tags?.artist || message.data.display_name || "",
                    title: at.title || at.metadata?.tags?.title || at.file_name || ""
                }));

            // Текущий индекс трека
            const index = playlist.findIndex(item => item.id === current.id);

            // Запускаем плеер с плейлистом
            window.audioPlayer.play(playlist, null, { after: true }, index >= 0 ? index : 0);
        }

    }

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Функции обновления и чтения данных (хуки для загрузчика)
    data.__update__ = (next) => setup(next);
    data.__getData__ = () => current;

    // Устанавливаем начальные данные
    setup(data);

    // Прикрепляем обработчики событий
    actions();

    // Подписываемся на глобальный плеер
    globalEvents();

    // Возвращаем сам элемент для вставки в DOM
    return element;

}
