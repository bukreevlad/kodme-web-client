// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

/**
 * Настройки диалога удаления ключа доступа.
 */
export interface PasskeyRemoveDialogOptions {

    /** Имя удаляемого ключа. */
    name: string;

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Callback подтверждения (true/false). */
    callback?: ((response: boolean) => void) | null;

}

// Form
export class PasskeyRemoveDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: PasskeyRemoveDialog | null = null;

    /** Настройки диалога. */
    options: Required<PasskeyRemoveDialogOptions>;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог подтверждения удаления ключа доступа.
     * @param data - Данные.
     * @param data.name - Имя удаляемого ключа.
     * @param data.insertInto - Куда вставить диалог.
     * @param data.callback - Callback подтверждения (true/false).
     * ***************************************************************************
     */
    constructor({
        name = "",
        insertInto = null,
        callback = null
    }: PasskeyRemoveDialogOptions) {

        // Устанавливаем настройки
        this.options = {
            name,
            insertInto,
            callback
        };

        // Проверяем, существует ли уже экземпляр
        if (PasskeyRemoveDialog.instance) {
            return PasskeyRemoveDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        PasskeyRemoveDialog.instance = this;

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

            // Подтвердить удаление
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
        PasskeyRemoveDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        // Подставляем имя ключа в описание
        let description = window._lc.forms.user_setting_security.passkey_remove_desc || "";
        if (description.includes("{name}") && this.options.name) {
            description = description.replace("{name}", this.options.name);
        }

        return new DOMParser().parseFromString(`

            <div class="cdm-modal security-passkey-remove flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-base">${window._lc.forms.user_setting_security.passkey_remove_title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <span class="text-secondary text-sm">${description}</span>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.user_setting_security.action_cancel })}
                    ${Buttons.danger({ attributes: ["action-remove"], classes: ["w-full"], text: window._lc.forms.user_setting_security.passkey_remove })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
