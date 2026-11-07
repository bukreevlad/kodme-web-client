// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { AudioPlayerManager } from "../../utils/audio/audio_player.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Range } from "../../components/range.js";

// Импортируем dialogs
import { PlaylistDialog } from "./dialogs/playlist/index.js";

// Импортируем functions
import { updateTrackInfo } from "./functions/update_track_info.js";
import { subscribeToPlayer } from "./functions/subscribe.js";

// Импортируем handlers
import { trackChangeHandler } from "./handlers/track_change.js";

// Импортируем типы
import type { AudioPlayerCallback } from "../../utils/audio/audio_player.js";

/**
 * Настройки формы аудиоплеера (поля конструктора; сейчас класс их не читает,
 * форма открывается без аргументов — `new AudioPlayer()`).
 */
export interface AudioPlayerOptions {
    /** Прочие настройки (легаси-контракт конструктора). */
    [key: string]: unknown;
}

/**
 * ***************************************************************************
 * Форма полноэкранного аудиоплеера с поддержкой плейлиста.
 * ***************************************************************************
 */
export class AudioPlayer {

    // Переменная для хранения единственного экземпляра формы
    static instance: AudioPlayer | null = null;

    /** Настройки формы. */
    options: AudioPlayerOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы. */
    content: HTMLElement | null = null;

    /** Экземпляр скролла контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Менеджер воспроизведения (глобальный синглтон). */
    manager: AudioPlayerManager;

    /** Слайдер прогресса воспроизведения. */
    progress: Range | null = null;

    /** Кнопка play/pause. */
    playBtn: Buttons | null = null;

    /** Id текущего отображаемого трека. */
    currentTrackId: string | number | null = null;

    /** Последнее известное состояние play/pause (для смены иконки). */
    lastPlayingState: boolean | null = null;

    /** Подписчик обновлений менеджера (снимается при закрытии). */
    _updateCallback: AudioPlayerCallback | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options: AudioPlayerOptions = {}) {

        // Устанавливаем настройки
        this.options = {
            ...options
        };

        // AudioPlayerManager
        this.manager = new AudioPlayerManager();

        // Проверяем, существует ли уже экземпляр
        if (AudioPlayer.instance) {
            return AudioPlayer.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        AudioPlayer.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    _init(): void {

        // Открытие
        this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?audio-player`,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("AudioPlayer Form Open Error:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы перед открытием
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Устанавливаем элементы
            this.content = this.tpl?.querySelector<HTMLElement>(":scope >.content") ?? null;

            // Инициализируем скролл
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Скрываем базовый проигрыватель
            this.manager.isAudioPlayerOpened = true;

            // Устанавливаем изначальные данные трека
            if (this.tpl) updateTrackInfo(this);

            // Рендерим плейлист
            this._renderPlaylist();

            // Активируем слайдеры
            if (this.tpl) Range.hydrate(this.tpl);

        } catch (error) {
            Logger.error("AudioPlayer Form onBeforeOpen Error:", error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Вешаем события
        this._handlers();

        // Синхронизируем активное состояние повтора
        const repeatBtn = this.tpl?.querySelector("[data-repeat]");
        if (repeatBtn && this.manager.isRepeatEnabled) {
            repeatBtn.classList.add("text-[var(--color-brand)]");
        }

        // Подписываемся на обновления плеера
        subscribeToPlayer(this);

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            if (!this.tpl) return;

            // Кнопка закрытия формы
            const closeBtn = this.tpl.querySelector<HTMLElement>("[action-close]");
            if (closeBtn) {
                closeBtn.onclick = () => {
                    this.modal?.close();
                };
            }

            // Управление воспроизведением
            const playPauseBtn = this.tpl.querySelector<HTMLElement>("[data-play-pause]");
            if (playPauseBtn) playPauseBtn.onclick = () => this.manager.toggle();

            // Следующий трек
            const nextBtn = this.tpl.querySelector<HTMLElement>("[data-next]");
            if (nextBtn) {
                nextBtn.onclick = () => {
                    this.manager.next();
                    trackChangeHandler(this);
                };
            }

            // Предыдущий трек
            const prevBtn = this.tpl.querySelector<HTMLElement>("[data-prev]");
            if (prevBtn) {
                prevBtn.onclick = () => {
                    this.manager.prev();
                    trackChangeHandler(this);
                };
            }

            // Перемешать плейлист
            const shuffleBtn = this.tpl.querySelector<HTMLElement>("[data-shuffle]");
            if (shuffleBtn) {
                shuffleBtn.onclick = () => {
                    shuffleBtn.classList.toggle("text-[var(--color-brand)]");
                    this.manager.shuffle();
                    // Рендерим плейлист
                    this._renderPlaylist();
                };
            }

            // Повтор плейлиста
            const repeatBtn = this.tpl.querySelector<HTMLElement>("[data-repeat]");
            if (repeatBtn) {
                repeatBtn.onclick = () => {
                    repeatBtn.classList.toggle("text-[var(--color-brand)]");
                    this.manager.toggleRepeat();
                };
            }

            // Регулировка громкости
            const volumeInput = this.tpl.querySelector<HTMLInputElement>(`[name="volume"]`);
            if (volumeInput) {
                volumeInput.oninput = () => {
                    // Приведение к числу эквивалентно веб-приведению записи в audio.volume
                    const val = Number(volumeInput.value);
                    this.manager.audio.volume = val;
                    volumeInput.style.background = `linear-gradient(to right, var(--color-primary) ${val * 100}%, var(--color-secondary) ${val * 100}%)`;
                };
            }

            // Открытие плейлиста в отдельном модальном окне
            const playlistBtn = this.tpl.querySelector<HTMLElement>("[data-toggle-playlist]");
            if (playlistBtn) {
                playlistBtn.onclick = () => {
                    if (!PlaylistDialog.instance) {
                        new PlaylistDialog(this);
                    }
                };
            }

            // Перемотка через слайдер
            const progressInput = this.progress?.dom.querySelector<HTMLInputElement>("input[type='range']");
            if (progressInput) {
                progressInput.oninput = () => {
                    this.manager.seek(progressInput.value);
                };
            }

            // Перемотка через волновой график
            const waveContainer = this.tpl.querySelector<HTMLElement>("[data-wave-form]");
            if (waveContainer) {
                waveContainer.onclick = (e) => {
                    const rect = waveContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    if (rect.width > 0) {
                        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
                        this.manager.seek(percent);
                    }
                };
            }

        } catch (error) {
            Logger.error("AudioPlayer Form Handlers Error:", error);
        }

    }

    /**
     * ***************************************************************************
     * Обновление списка треков плейлиста (делегирует открытому диалогу).
     * ***************************************************************************
     */
    _renderPlaylist(): void {

        // Перерисовываем список в открытом диалоге плейлиста
        PlaylistDialog.instance?._render();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Закрываем открытый диалог плейлиста
        PlaylistDialog.instance?.modal?.close();

        // Отписываемся от обновлений в AudioPlayerManager
        if (this.currentTrackId && this._updateCallback) {
            // invariant: тот же id, что и при подписке (см. functions/subscribe.ts)
            this.manager.unsubscribe(this.currentTrackId as string, this._updateCallback);
        }

        if (this.progress?.dom) {
            const progressInput = this.progress.dom.querySelector<HTMLInputElement>("input[type='range']");
            if (progressInput) progressInput.oninput = null;
        }

        // Очищаем обработчики на основных кнопках
        const actions = [
            "[action-close]", "[data-play-pause]", "[data-next]",
            "[data-prev]", "[data-toggle-playlist]"
        ];

        actions.forEach(selector => {
            const el = this.tpl?.querySelector<HTMLElement>(selector);
            if (el) el.onclick = null;
        });

        // Сбрасываем внутреннее состояние
        this.currentTrackId = null;
        this.lastPlayingState = null;

        // Удаляем ссылки на DOM элементы (помогаем GC)
        this.tpl = null;
        this.modal = null;

        // Удаляем глобальный экземпляр
        AudioPlayer.instance = null;

        // Скрываем базовый проигрыватель
        this.manager.isAudioPlayerOpened = false;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // Инициализируем чистые экземпляры в JS
        this.progress = Range.create({ name: "player-progress", showThumb: false, min: 0, max: 100, value: 0, step: 0.1, showTooltip: false, showLimits: false, intent: "brand" });
        this.playBtn = Buttons.transparent({ shape: "circle", attributes: ["data-play-pause"], icon: { name: "player-play", settings: { filled: true } } });

        // 2. Оставляем в HTML семантические слоты-пустышки
        const htmlString = `
            <div class="cdm-form audio-player flex flex-col w-full h-full ${CDM_FORM_CLASSES()}">
                <div class="header flex flex-row gap-2 p-2 items-center justify-end ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["data-toggle-playlist"], icon: "List" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="content w-full h-full flex flex-col max-w-[var(--form-max-content-width)] m-auto ${CDM_FORM_CONTENT_CLASSES()}">

                    <div data-track class="flex flex-col flex-1 gap-4 p-6 items-center justify-center relative z-10 w-full">

                        <div data-cover class="flex relative rounded-2xl shadow-xl items-center justify-center bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10 overflow-hidden aspect-square w-64 h-64">
                            <img data-thumbnail src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="w-full absolute object-cover" />
                            ${Icons.icon("Music")?.outerHTML ?? ""}
                        </div>

                        <div class="flex flex-col gap-1 text-center w-full">
                            <span data-title class="text-2xl font-semibold truncate"></span>
                            <span data-author class="text-secondary dark:text-secondary text-lg mt-1 truncate"></span>
                        </div>

                        <div class="flex flex-col gap-4 w-full px-6">
                            <div data-wave-form class="flex flex-row w-full items-center gap-[1px]" style="height: 45px;"></div>
                            <div data-slot="progress"></div>
                            <div class="flex flex-row justify-between text-xs font-mono text-secondary dark:text-secondary">
                                <span data-current-time>0:00</span>
                                <span data-duration>0:00</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-center gap-6">
                            ${Buttons.transparent({ shape: "circle", attributes: ["data-shuffle"], icon: "arrows-shuffle" })}
                            ${Buttons.transparent({ shape: "circle", attributes: ["data-prev"], icon: { name: "player-skip-back", settings: { filled: true } } })}
                            <div data-slot="play-pause"></div>
                            ${Buttons.transparent({ shape: "circle", attributes: ["data-next"], icon: { name: "player-skip-forward", settings: { filled: true } } })}
                            ${Buttons.transparent({ shape: "circle", attributes: ["data-repeat"], icon: "Repeat" })}
                        </div>

                        <div class="flex items-center justify-center gap-3 w-full max-w-xs text-secondary dark:text-secondary">
                            ${Icons.icon("volume", { settings: { filled: true } })?.outerHTML ?? ""}
                            ${Range.create({ name: "volume", showThumb: false, min: 0, max: 1, value: this.manager.audio.volume, step: 0.01, showTooltip: false, showLimits: false, intent: "brand" })}
                        </div>

                    </div>

                </div>
            </div>
        `;

        const doc = new DOMParser().parseFromString(htmlString, "text/html");
        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        const tpl = doc.querySelector<HTMLElement>(".cdm-form")!;

        // 3. Заменяем слоты на живые DOM-ноды наших кнопок (.dom)
        tpl.querySelector('[data-slot="play-pause"]')?.replaceWith(this.playBtn.dom);
        tpl.querySelector('[data-slot="progress"]')?.replaceWith(this.progress.dom);

        return tpl;

    }

}
