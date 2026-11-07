// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем forms
import { MeetSettings } from "../../../meet-settings/index.js";

/**
 * Настройки диалога подтверждения удаления конференции.
 */
export interface RemoveMeetOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные диалога подтверждения удаления конференции.
 */
export interface RemoveMeetData {

    /** Id конференции. */
    meetId: string;

    /** Настройки формы. */
    options?: RemoveMeetOptions;

    /** Callback, вызываемый с флагом подтверждения. */
    callback: (confirmed: boolean) => void;

}

// Form
export class RemoveMeet {

    // Переменная для хранения единственного экземпляра формы
    static instance: RemoveMeet | null = null;

    // Переменные формы
    meetId: string;
    callback: (confirmed: boolean) => void;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: RemoveMeetOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Диалог подтверждения удаления конференции.
     * @param data - Данные.
     * @param data.meetId - Id конференции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.callback - Callback.
     * ***************************************************************************
     */
    constructor(data: RemoveMeetData) {

        // Если не передан meetId
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Поиск открытой формы настроек конференции
        let meetSettingsForm = MeetSettings.instances.get(data.meetId);
        let insertInto = meetSettingsForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto: insertInto || data.options?.insertInto,
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.meetId = data.meetId;
        this.callback = data.callback;

        // Проверяем, существует ли уже экземпляр
        if (RemoveMeet.instance) {
            return RemoveMeet.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        RemoveMeet.instance = this;

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
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

            // Закрыть из шапки
            let headerClose = this.tpl.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Удалить
            let remove = this.tpl.querySelector(":scope >.footer [action-remove]");
            remove?.addEventListener("click", () => this.callback(true));

            // Отмена
            let close = this.tpl.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

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

            // Устанавливаем элементы
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.content = content;

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
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
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        RemoveMeet.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal meet-remove-confirm flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${window._lc.forms.meet_settings.dialogs.remove.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                        <span class="text-secondary text-sm">${window._lc.forms.meet_settings.dialogs.remove.description}</span>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.meet_settings.dialogs.remove.action_close })}
                    ${Buttons.danger({ attributes: ["action-remove"], classes: ["w-full"], text: window._lc.forms.meet_settings.dialogs.remove.action_remove })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
