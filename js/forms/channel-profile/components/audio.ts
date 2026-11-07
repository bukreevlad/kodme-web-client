// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { FileDownloader } from "../../../utils/network/file_downloader.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { ProgressIndicator } from "../../../components/progress.js";

// Импортируем handlers
import { ContextMenuHandler } from "./handlers/context_menu.js";

// Импортируем типы
import type { ChannelSectionItemData, ChannelProfile } from "../types.js";
import type { AudioPlayerCallback, AudioPlayerTrack } from "../../../utils/audio/audio_player.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * AudioItem - строка вкладки «Аудио» профиля канала.
 * Синхронизируется с глобальным AudioPlayerManager через систему подписок.
 *
 * Конструктор НЕ возвращает DOM-элемент (класс-фабрика — красный флаг
 * миграции): элемент отдаёт поле element, его берёт subscribe_section.
 * ***************************************************************************
 */
export class AudioItem {

    /** Форма-владелец строки. */
    form: ChannelProfile;

    /** Данные вложения (id, token, metadata и т.д.). */
    data: ChannelSectionItemData;

    /** Корневой DOM-элемент строки. */
    element: HTMLElement;

    /** Кнопка воспроизведения. */
    playButton: Buttons | null = null;

    /** Название трека. */
    titleEl: HTMLElement | null = null;

    /** Исполнитель. */
    artistEl: HTMLElement | null = null;

    /** Длительность/позиция воспроизведения. */
    durationEl: HTMLElement | null = null;

    /** Контроллер жестов (tap/long tap/context menu). */
    gestureController: GestureController | null = null;

    /** Колбэк подписки на глобальный аудиоплейер. */
    playerCallback: AudioPlayerCallback | null = null;

    /** Плейлист, собранный из секции перед запуском плеера. */
    playlist: AudioPlayerTrack[] = [];

    /** Прогресс-бар загрузки файла. */
    progress: ProgressIndicator | null = null;

    /** Загрузчик файла. */
    downloader: FileDownloader | null = null;

    /** Идёт ли сейчас скачивание файла. */
    isDownloadProccess = false;

    /**
     * ***************************************************************************
     * constructor - Создаёт строку аудио, вешает обработчики и подписки.
     * @param form - Экземпляр формы профиля канала.
     * @param data - Данные вложения.
     * ***************************************************************************
     */
    constructor(form: ChannelProfile, data: ChannelSectionItemData) {

        // Записываем данные
        this.form = form;
        this.data = data;

        this.downloader = null;
        this.progress = null; // Для загрузки файлов через ProgressIndicator
        this.isDownloadProccess = false;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
        // при вставке пачки в начало списка (см. functions/load_section.ts)
        if (data?.id) this.element.setAttribute("data-id", String(data.id));

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Функция для обновления данных
        this.data.__update__ = (data) => this.update(data);
        this.data.__getData__ = () => this.getData();

        // Отписка от глобальных событий (аудиоплейер): вызывается из
        // events/store/subscribe_section при удалении строки из Store
        this.data.__destroy__ = () => this.destroy();

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Прикрепляем глобальные подписки
        this._globalEvents();

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // ***************************************************************************
    _template(): HTMLElement {

        const tpl = new DOMParser().parseFromString(`
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
        `, "text/html").querySelector<HTMLElement>(".item");

        // invariant: шаблон выше всегда содержит корневой .item
        if (!tpl) throw new Error("Не удалось разобрать шаблон строки аудио");

        return tpl;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    async _setup(data: ChannelSectionItemData): Promise<void> {

        try {

            // Обновляем данные
            this.data = data;

            // Устанавливаем элементы
            const playButton = this.element.querySelector("[action-play]");
            this.titleEl = this.element.querySelector(":scope [data-title]");
            this.artistEl = this.element.querySelector(":scope [data-artist]");
            this.durationEl = this.element.querySelector(":scope [data-duration]");

            // Текстовые узлы входят в шаблон строки — без них нечего заполнять
            if (!this.titleEl || !this.artistEl || !this.durationEl) return;

            // Устанавливаем кнопку управления
            this.playButton = Buttons.circle({
                attributes: ["action-play"],
                classes: ["relative"],
                icon: "player-play",
                intent: "primary"
            });

            // Заменяем элемент кнопки
            if (playButton) {
                playButton.replaceWith(this.playButton.dom);
            }

            // Извлекаем теги и инфо
            const tags = this.data.metadata?.tags || {};
            const original = this.data.metadata?.original || {};

            // Заполняем текстовые данные
            this.titleEl.textContent = tags.title || this.data.name || "Untitled";
            this.artistEl.textContent = tags.artist || this.data.display_name || "Unknown Artist";

            // Длительность
            if (original.duration) {
                this.durationEl.textContent = this._formatTime(original.duration);
            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // GestureController
        this.gestureController = new GestureController(this.element, {
            threshold: 5,
            onContextMenu: (event) => {
                event.preventDefault();
                if (!IsMobile.get()) {
                    ContextMenuHandler(event, this, "audio");
                }
            },
            tap: {
                longTapTimeout: 500,
                onTap: async () => {
                    this.proccessPlayer();
                },
                onLongTap: (event) => {
                    if (IsMobile.get()) {
                        if (event.cancelable) event.preventDefault();
                        ContextMenuHandler(event, this, "audio");
                    }
                }
            }
        });

    }

    // ***************************************************************************
    // Глобальные обработчики (Private Method)
    // ***************************************************************************
    _globalEvents(): void {

        this.playerCallback = (info) => this._handlePlayerUpdate(info);
        if (window.audioPlayer) {
            // Ключ подписки — строка: id записи приводим к строке и в
            // subscribe, и в unsubscribe, чтобы отписка гарантированно совпала
            window.audioPlayer.subscribe(String(this.data.id), this.playerCallback);
        }

    }

    // ***************************************************************************
    // Обработка данных от плеера
    // ***************************************************************************
    _handlePlayerUpdate(info: Parameters<AudioPlayerCallback>[0]): void {

        // Если играет наш трек
        if (info.trackId === this.data.id) {
            this._renderProgress(info);
            // Кнопка создаётся в _setup — без неё переключать нечего
            this.playButton?.setIcon(info.isPlaying ? "player-pause" : "player-play", { settings: { filled: true } });
        } else {
            // Если играет что-то другое или плеер закрыт
            this._resetUI();
        }

    }

    // ***************************************************************************
    // Обновляем данные элемента
    // ***************************************************************************
    update(data: ChannelSectionItemData): void {
        this._setup(data);
    }

    // ***************************************************************************
    // Метод для очистки при удалении сообщения из DOM
    // ***************************************************************************
    destroy(): void {
        this.gestureController?.destroy();
        // Колбэк создаётся в _globalEvents — если подписки не было,
        // отписываться не от чего
        const callback = this.playerCallback;
        if (window.audioPlayer && callback) {
            window.audioPlayer.unsubscribe(String(this.data.id), callback);
        }
    }

    // ***************************************************************************
    // Загружаем файл и начинаем проигрывание
    // ***************************************************************************
    proccessPlayer(): void {

        // Если этот трек уже загружен в плеер — просто переключаем Play/Pause
        if (window.audioPlayer.audioData?.id === this.data.id) {
            window.audioPlayer.toggle();
        } else {

            // Иначе собираем плейлист из сообщения и запускаем
            const attachments = this.form?.audioStore?.getAll();
            this.playlist = attachments
                .filter(at => isKind("audio", at.mime_type))
                .map(at => ({
                    ...at,
                    author: at.author || at.metadata?.tags?.artist || this.data.display_name,
                    title: at.title || at.metadata?.tags?.title || at.file_name
                }));

            // Текущий индекс трека
            const index = this.playlist.findIndex(item => item.id === this.data.id);

            // Запускаем плеер с плейлистом
            window.audioPlayer.play(this.playlist, null, { after: true }, index >= 0 ? index : 0);
        }

    }

    // ***************************************************************************
    // Метод для отрисовки прогресса в конкретном сообщении
    // ***************************************************************************
    _renderProgress(info: Parameters<AudioPlayerCallback>[0]): void {

        // currentTime опционален в событии — undefined нормализуем к null
        // (textContent сам вычищает значение)
        if (this.durationEl) this.durationEl.textContent = info.currentTime ?? null;

    }

    // ***************************************************************************
    // Сброс состояния
    // ***************************************************************************
    _resetUI(): void {

        this.playButton?.setIcon("player-play", { settings: { filled: true } });
        const originalDuration = this.data.metadata?.original?.duration;
        if (originalDuration && this.durationEl) this.durationEl.textContent = this._formatTime(originalDuration);

    }

    // ***************************************************************************
    // Форматирование времени
    // ***************************************************************************
    _formatTime(seconds: number | null | undefined): string {
        if (!seconds) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    // ***************************************************************************
    // Логика запуска загрузки
    // ***************************************************************************
    async _startDownload(): Promise<void> {
        this.isDownloadProccess = true;

        try {

            // Инициализация прогресс-бара
            this.progress = new ProgressIndicator({ width: "100%" });
            this.playButton?.dom?.appendChild(this.progress.getElement());
            this.progress.setProcessing();

            // Иконка "X" для отмены
            this.playButton?.setIcon("X");

            // Создаем загрузчик
            this.downloader = new FileDownloader({
                // StorageUrl, а не ручная сборка: `location.hostname` теряет порт,
                // и на нестандартном порту скачивание не работало
                url: StorageUrl.forStorage(this.data.id),
                file_token: this.data.token,
                file_name: this.data.file_name,
                callback: (loaded, total, percent) => {
                    if (this.progress) this.progress.update(percent);
                }
            });

            // Ждём завершения загрузки
            await this.downloader.download();

        } catch (error) {

            // Отмена по кнопке «X» — не ошибка, тост показывать незачем.
            // Всё остальное показываем пользователю: раньше был только
            // Logger.error, и нажатие «Скачать» выглядело как ничего не делающее
            if (getErrorName(error) === "AbortError") return;

            toastError(error, {
                context: "[app][channel-profile][audio]::download",
                fallback: t("forms.channel_profile.toasts.download_error")
            });

        } finally {
            this._cleanupUI();
            this.isDownloadProccess = false;
        }
    }

    // ***************************************************************************
    // Принудительная остановка
    // ***************************************************************************
    _abortDownload(): void {
        if (this.downloader) this.downloader.destroy();
        this._cleanupUI();
    }

    // ***************************************************************************
    // Очистка UI после загрузки/ошибки/отмены
    // ***************************************************************************
    _cleanupUI(): void {

        // Удаляем прогресс
        if (this.progress) {
            this.progress.destroy();
            this.progress = null;
        }

        // Очищаем данные
        this.downloader = null;
        this.isDownloadProccess = false;

        // Возвращаем корректную иконку
        this.playButton?.setIcon("player-play", { settings: { filled: true } });

    }

    // ***************************************************************************
    // Инициализация загрузки или открытия
    // ***************************************************************************
    async _initDownload(): Promise<void> {

        // Если идет скачивание
        if (this.isDownloadProccess) return;

        // Начинаем процесс загрузки
        await this._startDownload();

    }

    // ***************************************************************************
    // Вспомогательные методы
    // ***************************************************************************
    getData(): ChannelSectionItemData { return this.data; }

}
