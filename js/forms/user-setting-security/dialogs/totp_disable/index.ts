// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";
import { Inputs } from "../../../../components/inputs.js";

/**
 * Настройки диалога отключения TOTP.
 */
export interface TotpDisableDialogOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Callback подтверждения (действующий код из приложения). */
    callback?: ((code: string) => void) | null;

}

// Form
export class TotpDisableDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: TotpDisableDialog | null = null;

    /** Настройки диалога. */
    options: Required<TotpDisableDialogOptions>;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог отключения TOTP: ввод действующего кода из приложения.
     * @param data - Данные.
     * @param data.insertInto - Куда вставить диалог.
     * @param data.callback - Callback подтверждения (код из приложения).
     * ***************************************************************************
     */
    constructor({
        insertInto = null,
        callback = null
    }: TotpDisableDialogOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto,
            callback
        };

        // Проверяем, существует ли уже экземпляр
        if (TotpDisableDialog.instance) {
            return TotpDisableDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        TotpDisableDialog.instance = this;

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
                onBeforeOpen: () => this._setup(),
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
    // Настройка диалога
    // ***************************************************************************
    _setup(): void {

        // Фокусируем поле ввода кода
        const codeInput = this.tpl?.querySelector<HTMLInputElement>("[name=\"code\"]");
        codeInput?.focus?.();

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть из шапки
            let headerClose = this.tpl?.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Подтвердить отключение (код уходит в callback — обработчик формы)
            let confirm = this.tpl?.querySelector(":scope >.footer [action-confirm]");
            confirm?.addEventListener("click", () => {

                // Считываем код и передаём наружу
                const code = this.tpl?.querySelector<HTMLInputElement>("[name=\"code\"]");
                this.options.callback?.(code?.value.trim() ?? "");

            });

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
        TotpDisableDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal security-totp-disable flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-base">${window._lc.forms.user_setting_security.totp_disable_title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-4">

                        <span class="text-secondary text-sm">${window._lc.forms.user_setting_security.totp_disable_desc}</span>

                        <div class="flex flex-col gap-2">
                            <span class="text-sm font-semibold">${window._lc.forms.user_setting_security.totp_code}</span>
                            ${Inputs.create({
                                placeholder: window._lc.forms.user_setting_security.totp_code,
                                name: "code",
                                icon: "key",
                                attributes: [
                                    "required",
                                    { name: "autocomplete", value: "off" },
                                    { name: "inputmode", value: "numeric" },
                                    { name: "maxlength", value: "10" }
                                ],
                                classes: ["font-mono", "tracking-widest"]
                            })}
                        </div>

                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.user_setting_security.action_cancel })}
                    ${Buttons.danger({ attributes: ["action-confirm"], classes: ["w-full"], text: window._lc.forms.user_setting_security.totp_disable })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
