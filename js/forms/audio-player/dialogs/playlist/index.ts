// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем handlers
import { trackChangeHandler } from "../../handlers/track_change.js";

// Импортируем типы
import type { AudioPlayer } from "../../index.js";
import type { AudioPlayerManager } from "../../../../utils/audio/audio_player.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * ПЛЕЙЛИСТ - модальное окно со списком треков очереди воспроизведения.
 * ***************************************************************************
 */
export class PlaylistDialog {

    // Переменная для хранения единственного экземпляра диалога
    static instance: PlaylistDialog | null = null;

    /** Ссылка на форму полноэкранного плеера. */
    form: AudioPlayer | null;

    /** Менеджер воспроизведения. */
    manager: AudioPlayerManager | null;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /** Контент диалога. */
    content: HTMLElement | null = null;

    /** Экземпляр скролла контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /**
     * ***************************************************************************
     * Диалог.
     * @param form - Экземпляр формы AudioPlayer.
     * ***************************************************************************
     */
    constructor(form: AudioPlayer) {

        // Ссылка на форму полноэкранного плеера
        this.form = form;

        // Менеджер воспроизведения
        this.manager = form.manager;

        // Проверяем, существует ли уже экземпляр
        if (PlaylistDialog.instance) {
            return PlaylistDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        PlaylistDialog.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон диалога
            this.tpl = this._template();

            if (!this.tpl) return;

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                closeOnEsc: true,
                closeOnOverlay: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем диалог
            this.modal.open();

        } catch (error) {
            Logger.error("PlaylistDialog Open Error:", error);
        }

    }

    // ***************************************************************************
    // Настройка диалога перед открытием
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Устанавливаем элементы
            this.content = this.tpl?.querySelector<HTMLElement>(":scope >.content") ?? null;

            // Рендерим список треков
            this._render();

            // Инициализируем скролл
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

        } catch (error) {
            Logger.error("PlaylistDialog onBeforeOpen Error:", error);
        }

    }

    // ***************************************************************************
    // Диалог открылся
    // ***************************************************************************
    _onOpen(): void {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть из шапки
            this.tpl?.querySelector(":scope >.header [action-close]")?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error("PlaylistDialog Handlers Error:", error);
        }

    }

    // ***************************************************************************
    // Клик по треку в списке
    // @param isActive - Является ли трек текущим.
    // @param index - Индекс трека в плейлисте.
    // ***************************************************************************
    _onTrackClick(isActive: boolean, index: number): void {

        try {

            if (!this.manager) return;

            // Клик по активному треку — переключаем воспроизведение
            if (isActive) {
                this.manager.toggle();
                return;
            }

            // Запускаем выбранный трек (передаем текущий плейлист и индекс);
            // invariant: контейнер монтирования мини-плеера не задан — плеер
            // уже смонтирован глобальным менеджером, передаём null как легаси
            this.manager.play(this.manager.playlist, null, { after: true }, index);
            if (this.form) trackChangeHandler(this.form);

        } catch (error) {
            Logger.error("PlaylistDialog TrackClick Error:", error);
        }

    }

    // ***************************************************************************
    // Отрисовка списка треков
    // ***************************************************************************
    _render(): void {

        if (!this.manager || !this.tpl) return;

        // Контейнер списка
        const container = this.tpl.querySelector("[data-playlist-items]");
        if (!container) return;

        // Сбрасываем содержимое
        container.innerHTML = "";

        // Текущий плейлист
        const playlist = this.manager.playlist || [];

        // Текущий id трека
        const currentId = this.manager.audioData?.id;

        // Счётчик треков в шапке
        const countEl = this.tpl.querySelector("[data-playlist-count]");
        if (countEl) {
            countEl.textContent = playlist.length
                ? t("forms.audio_player.tracks_count", { count: playlist.length })
                : "";
        }

        // Пустой плейлист
        if (!playlist.length) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 p-8 text-secondary dark:text-secondary">
                    ${Icons.icon("playlist", { classes: ["text-muted"] })?.outerHTML}
                    <span class="text-sm">${t("forms.audio_player.playlist_empty")}</span>
                </div>
            `;
            return;
        }

        // Проходим по плейлисту
        playlist.forEach((track, index) => {

            // Если текущий трек
            const isActive = track.id === currentId;

            // Создаем элемент списка
            const item = document.createElement("button");
            item.type = "button";
            item.className = `flex flex-row items-center gap-2 p-2 rounded-md cursor-pointer text-left w-full transition-colors hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] ${isActive ? "bg-[var(--color-black)]/5 dark:bg-[var(--color-white)]/10" : ""}`;

            // Шаблон
            item.innerHTML = `
                <div class="flex items-center justify-center rounded-full text-[var(--color-brand)] shrink-0">
                    ${isActive ? Icons.icon("player-play", { settings: { filled: true } })?.outerHTML : Icons?.icon("Music")?.outerHTML}
                </div>
                <div class="flex flex-col flex-1 overflow-hidden min-w-0">
                    <span class="text-sm font-semibold truncate ${isActive ? "text-[var(--color-brand)]" : ""}">${track.title || t("forms.audio_player.untitled")}</span>
                    <span class="text-xs text-secondary dark:text-secondary truncate">${track.author || t("forms.audio_player.unknown")}</span>
                </div>
            `;

            // Обработка клика по треку
            item.addEventListener("click", () => this._onTrackClick(isActive, index));

            container.appendChild(item);

        });

    }

    // ***************************************************************************
    // Действия при закрытии диалога
    // ***************************************************************************
    _onBeforeClose(): void {

        // Уничтожаем скролл
        this.osListScrollInstance?.destroy();
        this.osListScrollInstance = null;

        // Удаляем ссылки на DOM элементы (помогаем GC)
        this.form = null;
        this.manager = null;
        this.tpl = null;
        this.modal = null;

        // Удаляем глобальный экземпляр
        PlaylistDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal audio-player-playlist flex flex-col p-0 gap-0 w-[26rem] ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-col gap-0 items-start font-semibold text-lg">
                        ${t("forms.audio_player.playlist_title")}
                        <span data-playlist-count class="text-xs font-normal text-secondary dark:text-secondary"></span>
                    </span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()} max-h-[60vh]">
                    <div data-playlist-items class="flex flex-col gap-1"></div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
