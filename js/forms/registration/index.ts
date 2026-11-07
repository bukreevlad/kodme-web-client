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
import { stepNamesHandler } from "./handlers/step_names.js";
import { stepPasswordHandler } from "./handlers/step_password.js";
import { registrationHandler } from "./handlers/registration.js";
import { closeHandler } from "./handlers/close.js";
import { backEmailHandler } from "./handlers/back_email.js";
import { backNamesHandler } from "./handlers/back_names.js";

// Form
export class Registration {

    /** Настройки формы. */
    options: Record<string, unknown>;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Менеджер табов (шагов регистрации). */
    tabs: Tabs | null = null;

    /** Email пользователя. */
    email: string | null = null;

    /** Имя пользователя. */
    firstName: string | null = null;

    /** Фамилия пользователя. */
    lastName: string | null = null;

    /** Пароль. */
    password: string | null = null;

    /** Пароль повторно. */
    retryPassword: string | null = null;

    /**
     * ***************************************************************************
     * Форма регистрации.
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

            // Дальше (шаг 1 → шаг 2)
            const stepNames = this.tpl.querySelector("[action-set-name]");
            stepNames?.addEventListener("click", () => stepNamesHandler(this));

            // Назад к Email (шаг 2)
            const backEmail = this.tpl.querySelector("[action-back-email]");
            backEmail?.addEventListener("click", () => backEmailHandler(this));

            // Дальше (шаг 2 → шаг 3)
            const stepPassword = this.tpl.querySelector("[action-set-password]");
            stepPassword?.addEventListener("click", () => stepPasswordHandler(this));

            // Назад к именам (шаг 3)
            const backNames = this.tpl.querySelector("[action-back-names]");
            backNames?.addEventListener("click", () => backNamesHandler(this));

            // Регистрация (шаг 3)
            const registration = this.tpl.querySelector("[action-registration]");
            registration?.addEventListener("click", () => registrationHandler(this));

            // Футер: «Уже есть аккаунт?»
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

            // Активируем стартовый шаг (email)
            this.tabs.activateTab("email");

            // Следим за сменой шагов, чтобы синхронизировать индикатор
            this.tabs.activationCallbacks["email"] = () => this._updateSteps();
            this.tabs.activationCallbacks["names"] = () => this._updateSteps();
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
            const order = ["email", "names", "password"];
            const currentId = this.tabs?.currentId || "email";
            const index = Math.max(0, order.indexOf(currentId));

            // Обновляем степпер и подпись шага
            const stepsRoot = this.tpl?.querySelector<HTMLElement>(".cdm-auth-steps");
            if (stepsRoot) {
                AuthSteps.update(stepsRoot, {
                    current: index,
                    label: window._lc.forms.registration.step
                        .replace("{current}", String(index + 1))
                        .replace("{total}", String(order.length))
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
        const stepLabel = window._lc.forms.registration.step
            .replace("{current}", String(1))
            .replace("{total}", String(3));

        return new DOMParser().parseFromString(`

            <div class="cdm-modal registration flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_CENTERED_CONTENT_CLASSES()}">

                    <div class="flex flex-col items-center text-center gap-0.5 select-none">
                        <span class="text-base font-bold mt-1 leading-snug">${window._lc.forms.registration.title}</span>
                        <span class="text-sm text-secondary font-normal leading-snug">${window._lc.forms.registration.subtitle}</span>
                    </div>

                    ${AuthSteps.html({
                        count: 3,
                        current: 0,
                        label: stepLabel
                    })}

                    <ul class="cdm-tabs flex flex-row hidden" id="reg-tabs">
                        <li data-target="email" class="item"><span>${window._lc.forms.registration.email}</span></li>
                        <li data-target="names" class="item"><span>${window._lc.forms.registration.you_name}</span></li>
                        <li data-target="password" class="item"><span>${window._lc.forms.registration.password}</span></li>
                    </ul>

                    <div class="cdm-tabs-content">

                        <!-- Шаг 1: Email -->
                        <div class="item active flex flex-col gap-5" data-target="email">
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${window._lc.forms.registration.email}</span>
                                ${Inputs.email({
                                    placeholder: window._lc.forms.registration.email,
                                    name: "email",
                                    icon: "mail",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-row gap-3 w-full">
                                ${Buttons.create({
                                    attributes: ["action-back"],
                                    classes: ["flex-1"],
                                    text: window._lc.forms.registration.back,
                                    icon: "arrow-left"
                                })}
                                ${Buttons.primary({
                                    attributes: ["action-set-name"],
                                    classes: ["flex-1"],
                                    text: window._lc.forms.registration.next
                                })}
                            </div>
                        </div>

                        <!-- Шаг 2: Имя и фамилия -->
                        <div class="item flex flex-col gap-5" data-target="names">
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${window._lc.forms.registration.first_name}</span>
                                ${Inputs.create({
                                    placeholder: window._lc.forms.registration.first_name,
                                    name: "first-name",
                                    icon: "user",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${window._lc.forms.registration.last_name}</span>
                                ${Inputs.create({
                                    placeholder: window._lc.forms.registration.last_name,
                                    name: "last-name",
                                    icon: "user-circle",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-row gap-3 w-full">
                                ${Buttons.create({
                                    attributes: ["action-back-email"],
                                    classes: ["flex-1"],
                                    text: window._lc.forms.registration.back,
                                    icon: "arrow-left"
                                })}
                                ${Buttons.primary({
                                    attributes: ["action-set-password"],
                                    classes: ["flex-1"],
                                    text: window._lc.forms.registration.next
                                })}
                            </div>
                        </div>

                        <!-- Шаг 3: Пароль -->
                        <div class="item flex flex-col gap-5" data-target="password">
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${window._lc.forms.registration.password}</span>
                                ${Inputs.password({
                                    placeholder: window._lc.forms.registration.password,
                                    name: "password",
                                    icon: "lock",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-col gap-2 w-full">
                                <span class="text-sm font-semibold">${window._lc.forms.registration.retry_password}</span>
                                ${Inputs.password({
                                    placeholder: window._lc.forms.registration.retry_password,
                                    name: "retry-password",
                                    icon: "lock-check",
                                    attributes: ["required"]
                                })}
                            </div>
                            <div class="flex flex-row gap-3 w-full">
                                ${Buttons.create({
                                    attributes: ["action-back-names"],
                                    classes: ["flex-1"],
                                    text: window._lc.forms.registration.back,
                                    icon: "arrow-left"
                                })}
                                ${Buttons.primary({
                                    attributes: ["action-registration"],
                                    classes: ["flex-1"],
                                    text: window._lc.forms.registration.registration,
                                    icon: "user-plus"
                                })}
                            </div>
                        </div>

                    </div>

                </div>

                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    <div class="flex flex-1 flex-row items-center justify-center gap-1.5">
                    <span class="text-sm text-secondary">${window._lc.forms.auth.have_account}</span>
                    ${Buttons.link({
                        text: window._lc.forms.login.login,
                        attributes: ["action-to-login"],
                        classes: ["text-sm"]
                    })}
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
