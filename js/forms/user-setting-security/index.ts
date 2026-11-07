// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";
import { isWebauthnSupported } from "../../utils/helpers/webauthn.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем functions
import { refreshTotpStatus } from "./functions/refresh_totp_status.js";
import { getPasskeys } from "./functions/get_passkeys.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { enableTotpHandler } from "./handlers/enable_totp.js";
import { disableTotpHandler } from "./handlers/disable_totp.js";
import { addPasskeyHandler } from "./handlers/add_passkey.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";

// Импортируем типы
import type { PasskeyListItem, TotpStatusData } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы безопасности.
 */
export interface UserSettingSecurityOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingSecurityData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingSecurityOptions;

}

// Form
export class UserSettingSecurity {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingSecurity | null = null;

    /** Настройки формы. */
    options: UserSettingSecurityOptions;

    /** Id пользователя. */
    userId: string;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;
    content: HTMLElement | null = null;

    // Элементы карточки TOTP
    totpCard: HTMLElement | null = null;
    totpStatusEl: HTMLElement | null = null;
    totpEnableBtn: HTMLElement | null = null;
    totpDisableBtn: HTMLElement | null = null;

    // Элементы карточки ключей доступа
    passkeysCard: HTMLElement | null = null;
    passkeyList: HTMLElement | null = null;
    passkeysEmpty: HTMLElement | null = null;

    // Скролл-инстанс и менеджер якоря
    osListScrollInstance: OverlayScrollbars | null = null;
    listScrollManager: ScrollManager | null = null;

    // Статус TOTP (обновляется карточкой)
    totpStatus: TotpStatusData | null = null;

    // Хранилище списка ключей доступа
    store: Store<PasskeyListItem> = new Store<PasskeyListItem>();

    /**
     * ***************************************************************************
     * Форма безопасности (TOTP и ключи доступа).
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserSettingSecurityData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Поиск открытого профиля пользователя
        const userProfileForm = UserProfile.instances.get(data.userId);
        const insertInto = userProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.userId = data.userId;

        // Проверяем, существует ли уже экземпляр
        if (UserSettingSecurity.instance) {
            return UserSettingSecurity.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingSecurity.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store
        subscribeStoreEvents(this);

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
                type: "form",
                url: `?user-setting-security=${this.userId}`,
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
            let close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Включить TOTP
            let totpEnable = this.tpl.querySelector(`:scope >.content [action-totp-enable]`);
            totpEnable?.addEventListener("click", () => enableTotpHandler(this));

            // Отключить TOTP
            let totpDisable = this.tpl.querySelector(`:scope >.content [action-totp-disable]`);
            totpDisable?.addEventListener("click", () => disableTotpHandler(this));

            // Добавить ключ доступа
            let passkeyAdd = this.tpl.querySelector(`:scope >.content [action-passkey-add]`);
            passkeyAdd?.addEventListener("click", () => addPasskeyHandler(this));

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

            // Устанавливаем контент и элементы карточек
            this.content = this.tpl.querySelector(":scope >.content");
            this.totpCard = this.tpl.querySelector(`:scope >.content [data-totp-card]`);
            this.totpStatusEl = this.tpl.querySelector(`:scope >.content [data-totp-status]`);
            this.totpEnableBtn = this.tpl.querySelector(`:scope >.content [action-totp-enable]`);
            this.totpDisableBtn = this.tpl.querySelector(`:scope >.content [action-totp-disable]`);
            this.passkeysCard = this.tpl.querySelector(`:scope >.content [data-passkeys-card]`);
            this.passkeyList = this.tpl.querySelector(`:scope >.content [data-passkeys-list]`);
            this.passkeysEmpty = this.tpl.querySelector(`:scope >.content [data-passkeys-empty]`);

            // Инициализируем скроллбар (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Менеджер якоря скролла (для будущих вставок в список)
            if (this.osListScrollInstance) {
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Если WebAuthn недоступен — прячем карточку ключей
            if (!isWebauthnSupported()) this.passkeysCard?.classList.add("hidden");

            // Загружаем статус TOTP и список ключей
            await refreshTotpStatus(this);
            await getPasskeys(this);

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
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        UserSettingSecurity.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-security flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-close"],
            icon: "ArrowLeft"
        })}
                    <span class="font-semibold text-base truncate flex-1">${t("forms.user_settings.security")}</span>
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div data-totp-card class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("shield-lock", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_security.totp_title")}
                            </span>
                            <span data-totp-status class="text-sm text-secondary"></span>
                            <div class="flex flex-row gap-2">
                                ${Buttons.primary({
            shape: "square",
            classes: ["flex-1"],
            attributes: ["action-totp-enable"],
            icon: "shield-lock",
            text: t("forms.user_setting_security.totp_enable")
        })}
                                ${Buttons.danger({
            shape: "square",
            classes: ["flex-1", "hidden"],
            attributes: ["action-totp-disable"],
            icon: "logout-2",
            text: t("forms.user_setting_security.totp_disable")
        })}
                            </div>
                        </div>

                        <div data-passkeys-card class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("fingerprint", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_security.passkeys_title")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_security.passkeys_desc")}</span>
                            <span data-passkeys-empty class="hidden text-sm text-muted text-center">${t("forms.user_setting_security.passkeys_empty")}</span>
                            <div data-passkeys-list class="flex flex-col gap-2"></div>
                            ${Buttons.create({
            shape: "square",
            classes: ["w-full"],
            attributes: ["action-passkey-add"],
            icon: "plus",
            text: t("forms.user_setting_security.passkey_add")
        })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
