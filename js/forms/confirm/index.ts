// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CENTERED_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем handlers
import { confirmHandler } from "./handlers/confirm.js";
import { t } from "../../utils/i18n/index.js";

// Типы данных формы
/**
 * Данные формы подтверждения кода.
 */
export interface ConfirmData {
    /** Id сессии. */
    session_id: string;
    /** Email. */
    email: string;
    /** Вводится TOTP-код из приложения-генератора (а не код из письма). */
    totp_required?: boolean | undefined;
}

// Form
export class Confirm {

    /** Id сессии. */
    sessionId: string;

    /** Email. */
    email: string;

    /** Вводится TOTP-код из приложения-генератора. */
    totpRequired: boolean;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Форма подтверждения кода.
     * @param data - Данные.
     * @param data.session_id - Id сессии.
     * @param data.email - Email.
     * @param data.totp_required - Вводится TOTP-код из приложения-генератора.
     * ***************************************************************************
     */
    constructor(data: ConfirmData) {

        // Устанавливаем переменные
        this.sessionId = data.session_id;
        this.email = data.email;
        this.totpRequired = data.totp_required === true;

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
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers()
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

            // Проверка кода
            const check = this.tpl?.querySelector("[action-check]");
            check?.addEventListener("click", () => confirmHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    _setup(): void {

        try {

            // Фокусируем поле ввода кода
            const codeInput = this.tpl?.querySelector<HTMLInputElement>("[name=\"code\"]");
            codeInput?.focus?.();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Подставляем email в описание
        let desc = this.email
            ? t("forms.confirm.desc", { email: this.email })
            : t("forms.confirm.desc");

        // Подпись поля зависит от источника кода: TOTP или письмо
        let codeLabel = t("forms.confirm.code");
        if (this.totpRequired) {
            desc = t("forms.confirm.desc_totp");
            codeLabel = t("forms.confirm.totp_code");
        }

        return new DOMParser().parseFromString(`

            <div class="cdm-modal confirm flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_CENTERED_CONTENT_CLASSES()}">

                    <div class="flex flex-col items-center text-center gap-1 select-none">
                        <span data-title class="text-lg font-bold mt-1 leading-snug">${this.totpRequired ? t("forms.confirm.title_totp") : t("forms.confirm.title")}</span>
                        <span class="text-sm text-secondary font-normal leading-snug">${desc}</span>
                    </div>

                    <div class="flex flex-col gap-2">
                        <span class="text-sm font-semibold">${codeLabel}</span>
                        ${Inputs.create({
                            placeholder: codeLabel,
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

                    <p class="text-xs text-secondary text-center leading-snug">${this.totpRequired ? t("forms.confirm.desc_totp_code") : t("forms.confirm.desc_code")}</p>

                    ${Buttons.primary({
                        attributes: ["action-check"],
                        classes: ["w-full", "h-11"],
                        text: t("forms.confirm.check"),
                        icon: "check"
                    })}

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
