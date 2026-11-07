// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { LocalStorage } from "../../utils/local_storage.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем forms
import { Broadcasts } from "../broadcasts/index.js";

// Импортируем handlers
import { typePlayChangeHandler } from "./handlers/type_play_change.js";
import { typeGlobalMediaEventChangeHandler } from "./handlers/type_global_media_event_change.js";

/**
 * Настройки диалога настроек трансляций.
 */
export interface BroadcastsSettingsOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null;

}

// Form
export class BroadcastsSettings {

    // Переменная для хранения единственного экземпляра формы
    static instance: BroadcastsSettings | null = null;

    /**
     * ***************************************************************************
     * Диалог настроек трансляций (тип проигрывания, действие при глобальном
     * media event).
     * @param options - Настройки формы.
     * @param options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(options?: BroadcastsSettingsOptions) {

        // Поиск открытой формы списка трансляций: настройки открываются
        // внутри неё. Если список закрыт — остаётся левая колонка home
        const insertInto: HTMLElement | null = Broadcasts.instance?.modal?.content
            || document.querySelector(".cdm-form.home .left");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Проверяем, существует ли уже экземпляр
        if (BroadcastsSettings.instance) {
            return BroadcastsSettings.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BroadcastsSettings.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: BroadcastsSettingsOptions;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

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

            // Шаблон формы
            this.tpl = this._template();

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?broadcasts-settings`,
                insertInto: this.options.insertInto,
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
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Выбор типа стрима
            let typePlayChange = this.tpl.querySelectorAll(`:scope >.content [name="type-play"]`);
            typePlayChange.forEach(checkbox => checkbox?.addEventListener("change", () => typePlayChangeHandler(this)));

            // Выбор типа действия при глобальном media event
            let typeGlobalMediaChange = this.tpl.querySelectorAll(`:scope >.content [name="type-blobal-media-event"]`);
            typeGlobalMediaChange.forEach(checkbox => checkbox?.addEventListener("change", () => typeGlobalMediaEventChangeHandler(this)));

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Сессия пользователя (без неё не по какому значению искать чекбоксы)
            let session = LocalStorage.session;
            if (!session) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Тип проигрывания
            let typePlay = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="type-play"][value="${session.settings.broadcasts.type_play}"]`);
            typePlay?.click();

            // Тип глобального медиа эвента
            let typeGlobalMediaEvent = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="type-blobal-media-event"][value="${session.settings.broadcasts.type_global_media_event}"]`);
            typeGlobalMediaEvent?.click();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    async _onBeforeClose(): Promise<void> {

        // Удаляем экземпляр формы
        BroadcastsSettings.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form broadcasts-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.broadcasts.context_menu.settings}</span>
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("broadcast", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.broadcasts_settings.type_play}
                            </span>
                            ${Toggle.cardGroup([
        { name: "type-play", value: "flv", checked: true, text: window._lc.forms.broadcasts_settings.flv, description: window._lc.forms.broadcasts_settings.flv_play_desc },
        { name: "type-play", value: "hls", checked: true, text: window._lc.forms.broadcasts_settings.hls, description: window._lc.forms.broadcasts_settings.hls_play_desc },
        { name: "type-play", value: "rtc", checked: true, text: window._lc.forms.broadcasts_settings.rtc, description: window._lc.forms.broadcasts_settings.rtc_play_desc }
    ])}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("refresh", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.broadcasts_settings.type_blobal_media_event}
                            </span>
                            <div class="flex flex-col gap-2.5">
                                <span class="text-sm text-secondary">${window._lc.forms.broadcasts_settings.type_blobal_media_event_desc}</span>
                                ${Toggle.cardGroup([
        { name: "type-blobal-media-event", value: "paused", checked: false, text: window._lc.forms.broadcasts_settings.paused },
        { name: "type-blobal-media-event", value: "muted", checked: true, text: window._lc.forms.broadcasts_settings.muted }
    ])}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
