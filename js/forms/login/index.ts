// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { isWebauthnSupported } from "../../utils/helpers/webauthn.js";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CENTERED_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { loginHandler } from "./handlers/login.js";
import { loginWithQRCodeHandler } from "./handlers/login_with_qrcode.js";
import { loginWithPasskeyHandler } from "./handlers/login_with_passkey.js";
import { registrationHandler } from "./handlers/registration.js";
import { forgotPasswordHandler } from "./handlers/forgot_password.js";
import { t } from "../../utils/i18n/index.js";

// Form
export class Login {

    /** Настройки формы. */
    options: Record<string, unknown>;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: Record<string, unknown>) {

        // Устанавливаем настройки
        this.options = {
            ...options
        }

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

            // Авторизация
            const login = this.tpl?.querySelector("[action-login]");
            login?.addEventListener("click", () => loginHandler(this));

            // Авторизация по QR-коду
            const loginWithQRCode = this.tpl?.querySelector("[action-login-with-qrcode]");
            loginWithQRCode?.addEventListener("click", () => loginWithQRCodeHandler(this));

            // Авторизация по ключу доступа (Passkey)
            const loginWithPasskey = this.tpl?.querySelector("[action-login-with-passkey]");
            loginWithPasskey?.addEventListener("click", () => loginWithPasskeyHandler(this));

            // Если WebAuthn недоступен — прячем кнопку ключа доступа
            if (!isWebauthnSupported()) loginWithPasskey?.classList.add("hidden");

            // Регистрация
            const registration = this.tpl?.querySelector("[action-registration]");
            registration?.addEventListener("click", () => registrationHandler(this));

            // Восстановление пароля
            const forgotPassword = this.tpl?.querySelector("[action-forgot-password]");
            forgotPassword?.addEventListener("click", () => forgotPasswordHandler(this));

            // Активируем переключатели (без шаблона активировать нечего)
            if (this.tpl) Toggle.hydrate(this.tpl);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    _setup(): void {

        // Данные формы задаются по мере необходимости (легаси-пустое тело
        // обёртки try/catch удалено — обрабатывать нечего)

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal login flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_CENTERED_CONTENT_CLASSES()}">

                    <div class="flex flex-col items-center text-center gap-0.5 select-none">
                        <span class="text-base font-bold mt-1 leading-snug">${t("forms.login.title")}</span>
                        <span class="text-sm text-secondary font-normal leading-snug">${t("forms.login.subtitle")}</span>
                    </div>

                    <div class="flex flex-col gap-2">
                        <span class="text-sm font-semibold">${t("forms.login.email")}</span>
                        ${Inputs.email({
                            placeholder: t("forms.login.email"),
                            name: "email",
                            icon: "mail",
                            attributes: ["required"]
                        })}
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex flex-row items-center justify-between gap-2">
                            <span class="text-sm font-semibold">${t("forms.login.password")}</span>
                            ${Buttons.link({
                                text: t("forms.login.forgot_password"),
                                attributes: ["action-forgot-password"],
                                classes: ["text-sm"]
                            })}
                        </div>
                        ${Inputs.password({
                            placeholder: t("forms.login.password"),
                            name: "password",
                            icon: "lock",
                            attributes: ["required"]
                        })}
                    </div>

                    <label class="flex flex-row items-center justify-between gap-3 cursor-pointer select-none pt-0.5">
                        <span class="text-sm font-medium">${t("forms.login.save_me")}</span>
                        ${Toggle.switch({ name: "save-session", checked: true })}
                    </label>

                    <div class="flex flex-col gap-4">
                        ${Buttons.primary({
                            attributes: ["action-login"],
                            classes: ["w-full", "h-11"],
                            text: t("forms.login.login"),
                            icon: "login-2"
                        })}

                        <div class="flex flex-row items-center gap-3">
                            <span class="h-px flex-1 bg-[var(--border-color)]"></span>
                            <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">${t("forms.auth.or")}</span>
                            <span class="h-px flex-1 bg-[var(--border-color)]"></span>
                        </div>

                        ${Buttons.create({
                            attributes: ["action-login-with-qrcode"],
                            classes: ["w-full"],
                            text: t("forms.login.qr_login"),
                            icon: "qrcode"
                        })}

                        ${Buttons.create({
                            attributes: ["action-login-with-passkey"],
                            classes: ["w-full"],
                            text: t("forms.login.passkey_login"),
                            icon: "fingerprint"
                        })}
                    </div>

                </div>

                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    <div class="flex flex-1 flex-row items-center justify-center gap-1.5">
                    <span class="text-sm text-secondary">${t("forms.auth.no_account")}</span>
                    ${Buttons.link({
                        text: t("forms.login.registration"),
                        attributes: ["action-registration"],
                        classes: ["text-sm"]
                    })}
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
