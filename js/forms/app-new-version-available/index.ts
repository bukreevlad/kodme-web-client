// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { updateAppHandler } from "./handlers/update.js";

/**
 * Данные формы уведомления о новой версии приложения.
 */
export interface AppNewVersionAvailableData {

    /** Настройки формы. */
    options?: AppNewVersionAvailableOptions;

    /**
     * Callback: получает true, когда пользователь подтвердил обновление
     * (вызывающий код запускает вытеснение старого service worker).
     */
    callback?: (isConfirmed: boolean) => void;

}

/**
 * Настройки формы уведомления о новой версии.
 */
export interface AppNewVersionAvailableOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class AppNewVersionAvailable {

    /** Настройки формы. */
    options: AppNewVersionAvailableOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Callback вызывающего кода (подтверждение обновления). */
    callback: ((isConfirmed: boolean) => void) | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.callback - Callback.
     * ***************************************************************************
     */
    constructor(data?: AppNewVersionAvailableData) {

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы
        this.callback = data?.callback || null;

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

            // Шаблон формы
            this.tpl = this._template();

            if (!this.tpl) return;

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
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

            // Обновление
            const update = this.tpl?.querySelector(`[action-update]`);
            update?.addEventListener("click", () => updateAppHandler(this));

            // Отмена
            const cancel = this.tpl?.querySelector(`[action-cancel]`);
            cancel?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Устанавливаем элементы
            this.content = this.tpl?.querySelector(":scope >.content") ?? null;

            // Инициализируем скроллбар
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

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
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal app-new-version-available flex flex-col ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${window._lc.forms.app_new_version_available.update_desc}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()} items-center">

                    <span class="text-sm text-secondary">${window._lc.forms.app_new_version_available.update_last_desc}</span>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
                        shape: "square",
                        attributes: ["action-cancel"],
                        classes: ["w-full"],
                        text: window._lc.forms.app_new_version_available.cancel
                    })}
                    ${Buttons.primary({
                        shape: "square",
                        attributes: ["action-update"],
                        classes: ["w-full"],
                        text: window._lc.forms.app_new_version_available.update
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
