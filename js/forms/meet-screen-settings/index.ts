// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем forms
import { MeetPlay } from "../meet-play/index.js";

// Импортируем handlers
import { saveScreenSettingsHandler } from "./handlers/save.js";

/**
 * Данные формы настроек демонстрации экрана.
 */
export interface MeetScreenSettingsData {

    /** Id конференции. */
    meetId?: string;

    /** Настройки формы. */
    options?: {

        /** Куда вставить форма (контейнер формы конференции). */
        insertInto?: HTMLElement | null;
    };

}

/**
 * Временное хранилище выбранных значений в форме.
 */
export interface MeetScreenSettingsState {

    /** Ключ пресета разрешения ("original" | "h1080fps30" | ...). */
    presetKey: string;

    /** Частота кадров (undefined — ни разу не сохраняли). */
    fps?: number | undefined;

    /** Звук при демонстрации. */
    captureAudio: boolean;

}

/**
 * ***************************************************************************
 * MeetScreenSettings - Форма настройки качества демонстрации экрана:
 *                      разрешение, частота кадров и звук.
 *
 * Выбранное применяется сразу при следующем включении демонстрации, а если
 * она уже идёт — перезапускается с новым пресетом.
 * ***************************************************************************
 */
export class MeetScreenSettings {

    /** Единственный экземпляр формы. */
    static instance: MeetScreenSettings | null = null;

    /** Форма конференции, в которую вложена эта форма. */
    meetPlayForm: MeetPlay | null = null;

    /** Настройки формы. */
    options: { insertInto?: HTMLElement | null };

    /** Корневой элемент шаблона. */
    tpl: HTMLElement | null = null;

    /** Оверлей формы. */
    modal: Overlay | null = null;

    /** Контейнер контента. */
    content: HTMLElement | null = null;

    /** overlayScroll instance контента. */
    osListScrollInstance: ReturnType<typeof OverlayScrollbars> | null = null;

    /** Id конференции. */
    meetId: string;

    /** Временное хранилище выбранных значений. */
    currentSettings: MeetScreenSettingsState;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные формы.
     * ***************************************************************************
     */
    constructor(data: MeetScreenSettingsData) {

        // Если не передан meetId
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Поиск открытого окна конференции
        this.meetPlayForm = MeetPlay.instances.get(data.meetId) ?? null;
        let insertInto = this.meetPlayForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.meetId = data.meetId;

        // Временное хранилище для настроек (берем текущие из формы или дефолт)
        this.currentSettings = {
            presetKey: this.meetPlayForm?.screenSettings?.presetKey || "h720fps15",
            // Частота кадров тоже берётся из сохранённых настроек: иначе
            // форма при каждом открытии показывал бы «5», хотя реально
            // поток идёт с другой частотой, и смена разрешения молча
            // понижала бы её
            fps: this.meetPlayForm?.screenSettings?.fps,
            // Звук при демонстрации — по умолчанию да, как и раньше.
            // Строгое `!== false`, а не `|| true`: поле может быть
            // не задано вовсе (настройки ни разу не сохраняли),
            // и «не задано» здесь означает «звук нужен»
            captureAudio: this.meetPlayForm?.screenSettings?.captureAudio !== false
        };

        // Проверяем, существует ли уже экземпляр
        if (MeetScreenSettings.instance) {
            return MeetScreenSettings.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        MeetScreenSettings.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Открывает форма.
     * @returns Промис открытия.
     * ***************************************************************************
     */
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Собирает шаблон, оборачивает в Overlay и открывает.
     * @returns Промис открытия.
     * ***************************************************************************
     */
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма настроек
            this.modal = new Overlay(this.tpl, {
                type: "form",
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Вешает обработчики элементов формы.
     * @returns {void}
     * ***************************************************************************
     */
    _handlers(): void {

        try {

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Кнопка сохранить
            const save = this.tpl?.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveScreenSettingsHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Готовит элементы до показа формы.
     * @returns Промис подготовки.
     * ***************************************************************************
     */
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Активируем переключатели: без гидратации тумблер «Звук при
            // демонстрации» оставался бы мёртвым — он собирается в шаблоне
            // строкой и не слушает клики, пока компонент его не оживит
            Toggle.hydrate(this.tpl);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Включает обработчики после открытия.
     * @returns {void}
     * ***************************************************************************
     */
    async _onOpen(): Promise<void> {

        // Включаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Снимает экземпляр формы.
     * @returns {void}
     * ***************************************************************************
     */
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        MeetScreenSettings.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Возвращает корневой элемент шаблона формы.
     * @returns Корневой элемент шаблона.
     * ***************************************************************************
     */
    _template(): HTMLElement {

        const root = new DOMParser().parseFromString(`
        
            <div class="cdm-form meet-screen-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.meet_play.dialogs.screen_settings.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("aspect-ratio", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.meet_play.dialogs.screen_settings.resolution}
                            </span>
                            <select data-setting="resolution" class="w-full p-2 rounded-md bg-[var(--form-bg)] border border-[var(--border-color)] outline-none cursor-pointer">
                                <option value="original" ${this.currentSettings.presetKey === "original" ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.original}</option>
                                <option value="h1080fps30" ${this.currentSettings.presetKey.includes("h1080") ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.h1080}</option>
                                <option value="h720fps30" ${this.currentSettings.presetKey.includes("h720") ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.h720}</option>
                                <option value="h360fps30" ${this.currentSettings.presetKey.includes("h360") ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.h360}</option>
                            </select>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("clock", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.meet_play.dialogs.screen_settings.fps}
                            </span>
                            <select data-setting="fps" class="w-full p-2 rounded-md bg-[var(--form-bg)] border border-[var(--border-color)] outline-none cursor-pointer">
                                <option value="5" ${this.currentSettings.fps === 5 ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.fps_5}</option>
                                <option value="15" ${this.currentSettings.fps === 15 ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.fps_15}</option>
                                <option value="30" ${this.currentSettings.fps === 30 ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.fps_30}</option>
                                <option value="60" ${this.currentSettings.fps === 60 ? "selected" : ""}>${window._lc.forms.meet_play.dialogs.screen_settings.fps_60}</option>
                            </select>
                            <p class="text-xs text-secondary">${window._lc.forms.meet_play.dialogs.screen_settings.fps_desc}</p>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            ${Toggle.checkbox({
                name: "screen-audio",
                checked: this.currentSettings.captureAudio,
                attributes: ["data-audio"],
                text: window._lc.forms.meet_play.dialogs.screen_settings.audio,
                description: window._lc.forms.meet_play.dialogs.screen_settings.audio_desc
            })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

        // invariant: шаблон — наши строки, корневой .cdm-form в нём всегда есть
        if (!(root instanceof HTMLElement)) {
            throw new TypeError("MeetScreenSettings: шаблон .cdm-form не найден");
        }

        return root;

    }

}
