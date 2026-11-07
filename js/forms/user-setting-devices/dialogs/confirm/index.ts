// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

/**
 * Настройки диалога подтверждения.
 */
export interface ConfirmDeviceDialogOptions {

    /** Заголовок диалога. */
    title?: string;

    /** Описание действия. */
    description?: string;

    /** Текст кнопки «Отмена». */
    actionClose?: string;

    /** Текст кнопки подтверждения. */
    actionRemove?: string;

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Callback подтверждения (true/false). */
    callback?: ((response: boolean) => void) | null;

}

// Form
export class ConfirmDeviceDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: ConfirmDeviceDialog | null = null;

    /** Настройки диалога. */
    options: Required<ConfirmDeviceDialogOptions>;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог подтверждения действия с сессиями.
     * @param data - Данные.
     * @param data.title - Заголовок диалога.
     * @param data.description - Описание действия.
     * @param data.actionClose - Текст кнопки «Отмена».
     * @param data.actionRemove - Текст кнопки подтверждения.
     * @param data.insertInto - Куда вставить диалог.
     * @param data.callback - Callback подтверждения (true/false).
     * ***************************************************************************
     */
    constructor({
        title = "",
        description = "",
        actionClose = "",
        actionRemove = "",
        insertInto = null,
        callback = null
    }: ConfirmDeviceDialogOptions) {

        // Устанавливаем настройки
        this.options = {
            title,
            description,
            actionClose,
            actionRemove,
            insertInto,
            callback
        };

        // Проверяем, существует ли уже экземпляр
        if (ConfirmDeviceDialog.instance) {
            return ConfirmDeviceDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ConfirmDeviceDialog.instance = this;

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

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем диалог
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

            // Закрыть из шапки
            let headerClose = this.tpl?.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Подтвердить действие
            let remove = this.tpl?.querySelector(":scope >.footer [action-remove]");
            remove?.addEventListener("click", () => this.options.callback?.(true));

            // Отмена
            let close = this.tpl?.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии диалога
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        ConfirmDeviceDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal user-device-confirm flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-base">${this.options.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <span class="text-secondary text-sm">${this.options.description}</span>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: this.options.actionClose })}
                    ${Buttons.danger({ attributes: ["action-remove"], classes: ["w-full"], text: this.options.actionRemove })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
