// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем utils
import { AudioPlayerManager } from "../../utils/audio/audio_player.js";
import { Logger } from "../../utils/logs/logger.js";

// Импортируем forms
import { AudioPlayer } from "../../forms/audio-player/index.js";
import { Home } from "../../forms/home/index.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем типы
import type { AudioPlayerCallback, AudioPlayerState, MiniAudioPlayerMountOptions } from "../../utils/audio/audio_player.js";

/**
 * ***************************************************************************
 * UI Форма мини-плеера.
 * Управляет только отображением, анимацией монтирования и событиями мыши.
 * ***************************************************************************
 */
export class MiniAudioPlayer {

    /** Настройки монтирования. */
    options: MiniAudioPlayerMountOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Менеджер воспроизведения. */
    manager: AudioPlayerManager;

    /** Признак монтирования в DOM. */
    isMounted: boolean = false;

    /** Контейнер элементов управления плеером. */
    controlsContainer: HTMLElement | null = null;

    /** Информация о времени воспроизведения. */
    timeInfo: HTMLElement | null = null;

    /** Отображение текущего времени трека. */
    currentTimeEl: HTMLElement | null = null;

    /** Отображение длительности трека. */
    durationEl: HTMLElement | null = null;

    /** Отображение автора трека. */
    author: HTMLElement | null = null;

    /** Отображение названия трека. */
    title: HTMLElement | null = null;

    /** Кнопка воспроизведения/паузы. */
    btnPlay: Buttons | null = null;

    /** Кнопка разворота полного плеера. */
    btnExpand: Buttons | null = null;

    /** Кнопка полного закрытия плеера. */
    btnClose: Buttons | null = null;

    /** Подписчик обновлений менеджера (снимается при закрытии). */
    _updateCallback: AudioPlayerCallback | null = null;

    /** Id текущего отображаемого трека. */
    currentTrackId: string | number | null = null;

    /**
     * ***************************************************************************
     * Инициализация UI.
     * @param options - Настройки монтирования ({ insertInto, prepend, after }).
     * ***************************************************************************
     */
    constructor(options?: MiniAudioPlayerMountOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: Home.instance?.tpl?.querySelector(":scope [data-audio-player-mini-wrap]"),
            ...options
        }

        this.manager = new AudioPlayerManager();

        this._init();
    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    _init(): void {
        this._open();
    }

    // ***************************************************************************
    // Открытие и монтирование в DOM
    // ***************************************************************************
    _open(): void {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                // invariant: контейнер вставки — DOM-элемент (wrap мини-плеера
                // на главной форме либо контейнер, переданный в mount)
                insertInto: this.options.insertInto as HTMLElement | null,
                notReplaceInsertIntoIsMobile: true,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка перед открытием
    // ***************************************************************************
    _onBeforeOpen(): void {

        // Элементы заполняются из шаблона — без него нечего настраивать
        if (!this.tpl) return;

        // Плеерные элементы управления
        this.controlsContainer = this.tpl.querySelector(":scope [data-player-controls-container]");
        this.timeInfo = this.tpl.querySelector(":scope [data-player-time-info]");
        this.currentTimeEl = this.tpl.querySelector("[data-player-current-time]");
        this.durationEl = this.tpl.querySelector("[data-player-duration]");
        this.author = this.tpl.querySelector("[data-author]");
        this.title = this.tpl.querySelector("[data-title]");

        // Устанавливаем изначальные статические данные трека
        this._updateTrackInfo();

        // Показываем плеер (добавляем класс анимации появления)
        this.show();

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {
        this._handlers();
        this._subscribe();
    }

    // ***************************************************************************
    // Монтирование элемента в DOM
    // ***************************************************************************
    mount(container: HTMLElement | null, { prepend = false, after = false }: MiniAudioPlayerMountOptions = {}): void {

        if (!container || typeof container.append !== "function") {
            Logger.error("MiniAudioPlayer: Invalid container", container);
            return;
        }

        if (this.options.insertInto === container && this.isMounted) {
            this.show();
            return;
        }

        this.unmount();
        this.options.insertInto = container;

        // Без шаблона монтировать нечего
        if (!this.tpl) return;

        if (prepend) container.prepend(this.tpl);
        else if (after) container.after(this.tpl);
        else container.append(this.tpl);

        this.isMounted = true;

    }

    // ***************************************************************************
    // Перемонтирование в новый контейнер
    // ***************************************************************************
    remount(newContainer: HTMLElement | null, options: MiniAudioPlayerMountOptions = {}): void {
        this.options = options;
        this.mount(newContainer, options);
    }

    // ***************************************************************************
    // Удаление из DOM дерева
    // ***************************************************************************
    unmount(): void {
        if (this.tpl && this.tpl.parentNode) {
            this.tpl.parentNode.removeChild(this.tpl);
        }
        this.isMounted = false;
    }

    show(): void {
        if (this.tpl) this.tpl.classList.add("open");
    }

    hide(): void {
        if (this.tpl) this.tpl.classList.remove("open");
    }

    // ***************************************************************************
    // Слушатели событий интерфейса (клики, наведения)
    // ***************************************************************************
    _handlers(): void {

        try {

            // Кнопки создаются при сборке шаблона — без них нечего слушать
            if (!this.btnExpand || !this.btnPlay || !this.btnClose) return;

            // Открыть большой проигрыватель (fullscreen форму)
            // Мы вешаем событие на .dom ноду нашего JS-класса Buttons
            this.btnExpand.dom.onclick = () => new AudioPlayer();

            // Воспроизведение / Пауза
            this.btnPlay.dom.onclick = () => this.manager.toggle();

            // Полное закрытие
            this.btnClose.dom.onclick = () => this.manager.close();

        } catch (error) {
            Logger.error("MiniAudioPlayer Handlers Binding Error:", error);
        }

    }

    // ***************************************************************************
    // Обновление статичной текстовой информации
    // ***************************************************************************
    _updateTrackInfo(): void {
        const track = this?.manager?.audioData;
        if (!track) return;

        const author = this.author;
        const title = this.title;
        if (author) author.textContent = track.author || "Unknown";
        if (title) title.textContent = track.title ? `- ${track.title}` : "";
    }

    // ***************************************************************************
    // Реактивная подписка на броадкаст событий из бэкенд-менеджера
    // ***************************************************************************
    _subscribe(): void {
        const track = this?.manager?.audioData;
        if (!track) return;

        this._updateCallback = (info) => {
            if (info.trackId && info.trackId !== this.currentTrackId) {
                this.currentTrackId = info.trackId;
                this._updateTrackInfo();
            }
            this._renderUpdate(info);
        };

        // invariant: id трека из вложения — строка либо число; менеджер
        // хранит подписки в Map и сопоставляет их с trackId из broadcast
        // один в один, поэтому числовой id проходит как есть
        this.manager.subscribe(track.id as string, this._updateCallback);
    }

    // ***************************************************************************
    // Обновление визуального состояния (прогресс, тайминги, иконка паузы)
    // ***************************************************************************
    _renderUpdate(info: Partial<AudioPlayerState>): void {

        if (this.currentTimeEl) this.currentTimeEl.textContent = info.currentTime ?? null;
        if (this.durationEl) this.durationEl.textContent = info.duration ?? null;

        // Следим за иконкой
        this.btnPlay && this.btnPlay.setIcon(info.isPlaying ? "player-pause" : "player-play", { settings: { filled: true } });

    }

    // ***************************************************************************
    // Корректное закрытие и уничтожение формы
    // ***************************************************************************
    close(): void {
        this._onBeforeClose();
        this.unmount();
    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        const track = this?.manager?.audioData;
        if (track && this._updateCallback) {
            // invariant: тот же id, что и при подписке (см. _subscribe)
            this.manager.unsubscribe(track.id as string, this._updateCallback);
        }

        // Очищаем события на DOM-элементах кнопок
        if (this.btnPlay) this.btnPlay.dom.onclick = null;
        if (this.btnExpand) this.btnExpand.dom.onclick = null;
        if (this.btnClose) this.btnClose.dom.onclick = null;

        if (this.controlsContainer) {
            this.controlsContainer.onmouseenter = null;
            this.controlsContainer.onmouseleave = null;
        }

        this.btnPlay = null;
        this.btnExpand = null;
        this.btnClose = null;
        this.tpl = null;
        this._updateCallback = null;

    }

    // ***************************************************************************
    // Шаблон мини-плеера (Tailwind 4+)
    // ***************************************************************************
    _template(): HTMLElement {

        // 1. Инициализируем чистые экземпляры в JS
        this.btnPlay = Buttons.circle({ intent: "transparent", attributes: ["action-play-pause"], icon: "player-play" });
        this.btnExpand = Buttons.circle({ intent: "transparent", attributes: ["action-expand"], icon: "arrows-maximize" });
        this.btnClose = Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "X" });

        // 2. Оставляем в HTML семантические слоты-пустышки
        const htmlString = `
            <div class="cdm-form audio-player-mini flex flex-row w-full items-center bg-[var(--form-bg)] border-t border-[var(--border-color)] p-1 gap-2">
                
                <div data-slot="play-pause"></div>
                
                <div class="flex flex-col flex-1 justify-center overflow-hidden min-w-0">
                    <div class="flex flex-row items-center gap-1 min-w-0">
                        <span data-author class="text-sm font-semibold cursor-pointer truncate hover:underline"></span>
                        <span data-title class="text-xs truncate text-secondary"></span>
                    </div>
                    
                    <div data-player-controls-container class="flex flex-col justify-center overflow-hidden relative h-5 w-full">
                        <div data-player-time-info class="flex flex-row gap-1 text-xs text-secondary font-mono items-center">
                            <span data-player-current-time>00:00</span>
                            <span class="opacity-50">/</span>
                            <span data-player-duration>00:00</span>
                        </div>
                    </div>
                </div>

                <div data-slot="expand"></div>
                <div data-slot="close"></div>

            </div>
        `;

        const doc = new DOMParser().parseFromString(htmlString, "text/html");

        // invariant: корень .cdm-form и слоты кнопок входят в сам шаблон,
        // кнопки создаются этим же методом выше — все узлы на месте
        const tpl = doc.querySelector<HTMLElement>(".cdm-form")!;

        // 3. Заменяем слоты на живые DOM-ноды наших кнопок (.dom)
        tpl.querySelector('[data-slot="play-pause"]')?.replaceWith(this.btnPlay.dom);
        tpl.querySelector('[data-slot="expand"]')?.replaceWith(this.btnExpand.dom);
        tpl.querySelector('[data-slot="close"]')?.replaceWith(this.btnClose.dom);

        return tpl;

    }

}
