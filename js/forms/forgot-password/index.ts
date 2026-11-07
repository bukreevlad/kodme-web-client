// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CENTERED_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Tabs } from "../../components/tabs.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { AuthSteps } from "../login/components/auth_steps.js";

// Импортируем handlers
import { closeHandler } from "./handlers/close.js";
import { stepSendHandler } from "./handlers/step_send.js";
import { stepConfirmHandler } from "./handlers/step_confirm.js";
import { stepSetPasswordHandler } from "./handlers/step_set_password.js";
import { backEmailHandler } from "./handlers/back_email.js";
import { backCodeHandler } from "./handlers/back_code.js";
import { t } from "../../utils/i18n/index.js";

// Типы настроек формы
/**
 * Настройки формы восстановления пароля.
 */
export interface ForgotPasswordOptions {
    /** Email (если уже известен — сразу открываем шаг с кодом). */
    email?: string;
}

// Form
export class ForgotPassword {

    /** Настройки формы. */
    options: ForgotPasswordOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Менеджер табов (шагов восстановления). */
    tabs: Tabs | null = null;

    /** Email пользователя. */
    email: string | null = null;

    /** Код подтверждения. */
    code: string | null = null;

    /** Новый пароль. */
    password: string | null = null;

    /** Новый пароль повторно. */
    retryPassword: string | null = null;

    /**
     * ***************************************************************************
     * Форма восстановления пароля.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: ForgotPasswordOptions) {

        // Устанавливаем настройки
        this.options = {
            ...options
        }

        // Устанавливаем переменные
        this.email = this.options.email || null;

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

            // Без шаблона открывать форму не из чего
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

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть (шаг 1)
            const back = this.tpl.querySelector("[action-back]");
            back?.addEventListener("click", () => closeHandler(this));

            // Отправить код (шаг 1 → шаг 2)
            const stepSend = this.tpl.querySelector("[action-send]");
            stepSend?.addEventListener("click", () => stepSendHandler(this));

            // Назад к Email (шаг 2)
            const backEmail = this.tpl.querySelector("[action-back-email]");
            backEmail?.addEventListener("click", () => backEmailHandler(this));

            // Подтвердить код (шаг 2 → шаг 3)
            const stepConfirm = this.tpl.querySelector("[action-confirm]");
            stepConfirm?.addEventListener("click", () => stepConfirmHandler(this));

            // Назад к коду (шаг 3)
            const backCode = this.tpl.querySelector("[action-back-code]");
            backCode?.addEventListener("click", () => backCodeHandler(this));

            // Установить пароль (шаг 3)
            const stepSetPassword = this.tpl.querySelector("[action-set-password]");
            stepSetPassword?.addEventListener("click", () => stepSetPasswordHandler(this));

            // Футер: «Вернуться ко входу»
            const toLogin = this.tpl.querySelector("[action-to-login]");
            toLogin?.addEventListener("click", () => closeHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    _setup(): void {

        try {

            // Записываем контейнеры табов
            const links = this.tpl?.querySelector<HTMLElement>(".cdm-tabs");
            const panes = this.tpl?.querySelector<HTMLElement>(".cdm-tabs-content") ?? null;

            // Контейнер ссылок табов входит в шаблон — иначе шаги не собрать
            if (!links) return;

            // Инициализируем табы
            this.tabs = new Tabs([
                { tabs: links, scrollType: "horizontal" }
            ], panes, { isSlider: false });

            // Если email уже передан — сразу открываем шаг с кодом
            if (this.email) {
                this.tabs.activateTab("code");
            } else {
                this.tabs.activateTab("email");
            }

            // Следим за сменой шагов, чтобы синхронизировать индикатор
            this.tabs.activationCallbacks["email"] = () => this._updateSteps();
            this.tabs.activationCallbacks["code"] = () => this._updateSteps();
            this.tabs.activationCallbacks["password"] = () => this._updateSteps();

            // Обновляем индикатор шагов
            this._updateSteps();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обновление индикатора шагов
    // ***************************************************************************
    _updateSteps(): void {

        try {

            // Порядок шагов
            const order = ["email", "code", "password"];
            const currentId = this.tabs?.currentId || "email";
            const index = Math.max(0, order.indexOf(currentId));

            // Обновляем степпер и подпись шага
            const stepsRoot = this.tpl?.querySelector<HTMLElement>(".cdm-auth-steps");
            if (stepsRoot) {
                AuthSteps.update(stepsRoot, {
                    current: index,
                    label: t("forms.forgot_password.step", { current: index + 1, total: order.length })
                });
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Подпись стартового шага
        const stepLabel = t("forms.forgot_password.step", { current: 1, total: 3 });

        return new DOMParser().parseFromString(`

            <div class="cdm-modal forgot-password flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_CENTERED_CONTENT_CLASSES()}">

                    <div class="flex flex-col items-center text-center gap-0.5 select-none">
                        <span class="text-base font-bold mt-1 leading-snug">${t("forms.forgot_password.title")}</span>
                        <span class="text-sm text-secondary font-normal leading-snug">${t("forms.forgot_password.subtitle")}</span>
                    </div>

                    ${AuthSteps.html({
                        count: 3,
                        current: 0,
                        label: stepLabel
                    })}

                    <ul class="cdm-tabs flex flex-row hidden" id="fogot-tabs">
                        <li data-target="email" class="item"><span>${t("forms.forgot_password.email")}</span></li>
                        <li data-target="code" class="item"><span>${t("forms.forgot_password.code")}</span></li>
                        <li data-target="password" class="item"><span>${t("forms.forgot_password.password")}</span></li>
                    </ul>

                    <div class="cdm-tabs-content">

                        <!-- Шаг 1: Email -->
                        <div class="item active flex flex-col gap-5" data-target="email">
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${t("forms.forgot_password.email")}</span>
                                ${Inputs.email({
                                    placeholder: t("forms.forgot_password.email"),
                                    name: "email",
                                    icon: "mail",
                                    attributes: ["required"]
                                })}
                            </div>
                            <p class="text-xs text-secondary leading-snug">${t("forms.forgot_password.desc_send")}</p>
                            <div class="flex flex-row gap-3 w-full">
                                ${Buttons.create({
                                    attributes: ["action-back"],
                                    classes: ["flex-1"],
                                    text: t("forms.forgot_password.back"),
                                    icon: "arrow-left"
                                })}
                                ${Buttons.primary({
                                    attributes: ["action-send"],
                                    classes: ["flex-1"],
                                    text: t("forms.forgot_password.send")
                                })}
                            </div>
                        </div>

                        <!-- Шаг 2: Код подтверждения -->
                        <div class="item flex flex-col gap-5" data-target="code">
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${t("forms.forgot_password.code")}</span>
                                ${Inputs.create({
                                    placeholder: t("forms.forgot_password.code"),
                                    name: "code",
                                    icon: "key",
                                    attributes: ["required", { name: "maxlength", value: "6" }, { name: "autocomplete", value: "off" }],
                                    classes: ["font-mono", "tracking-widest"]
                                })}
                            </div>
                            <p class="text-xs text-secondary text-center leading-snug">${t("forms.forgot_password.desc_code")}</p>
                            <div class="flex flex-row gap-3 w-full">
                                ${Buttons.create({
                                    attributes: ["action-back-email"],
                                    classes: ["flex-1"],
                                    text: t("forms.forgot_password.back"),
                                    icon: "arrow-left"
                                })}
                                ${Buttons.primary({
                                    attributes: ["action-confirm"],
                                    classes: ["flex-1"],
                                    text: t("forms.forgot_password.confirm"),
                                    icon: "check"
                                })}
                            </div>
                        </div>

                        <!-- Шаг 3: Новый пароль -->
                        <div class="item flex flex-col gap-5" data-target="password">
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${t("forms.forgot_password.password")}</span>
                                ${Inputs.password({
                                    placeholder: t("forms.forgot_password.password"),
                                    name: "password",
                                    icon: "lock",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${t("forms.forgot_password.retry_password")}</span>
                                ${Inputs.password({
                                    placeholder: t("forms.forgot_password.retry_password"),
                                    name: "retry-password",
                                    icon: "lock-check",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-row gap-3 w-full">
                                ${Buttons.create({
                                    attributes: ["action-back-code"],
                                    classes: ["flex-1"],
                                    text: t("forms.forgot_password.back"),
                                    icon: "arrow-left"
                                })}
                                ${Buttons.primary({
                                    attributes: ["action-set-password"],
                                    classes: ["flex-1"],
                                    text: t("forms.forgot_password.set_password"),
                                    icon: "key"
                                })}
                            </div>
                        </div>

                    </div>

                </div>

                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    <div class="flex flex-1 flex-row items-center justify-center">
                    ${Buttons.link({
                        text: t("forms.auth.back_to_login"),
                        attributes: ["action-to-login"],
                        classes: ["text-sm"]
                    })}
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
