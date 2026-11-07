// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { avatarContextMenuHandler } from "./handlers/avatar_menu.js";
import { exitSessionHandler } from "./handlers/exit_session.js";
import { logoutSessionHandler } from "./handlers/logout_session.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";
import { UserSettingEmail } from "../user-setting-email/index.js";
import { UserSettingLink } from "../user-setting-link/index.js";
import { UserSettingDecorations } from "../user-setting-decoration/index.js";
import { UserSettingNotifications } from "../user-setting-notifications/index.js";
import { UserSettingPrivacy } from "../user-setting-privacy/index.js";
import { UserSettingDevices } from "../user-setting-devices/index.js";
import { UserSettingPassword } from "../user-setting-password/index.js";
import { UserSettingCache } from "../user-setting-cache/index.js";
import { UserSettingSecurity } from "../user-setting-security/index.js";

// Импортируем типы
import type { SessionUserFields } from "./types.js";

/**
 * Настройки формы настроек пользователя.
 */
export interface UserSettingsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingsData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingsOptions;

}

// Form
export class UserSettings {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettings | null = null;

    /** Настройки формы. */
    options: UserSettingsOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Компонент аватара. */
    avatar: Avatars | null = null;

    /** Id пользователя. */
    userId: string;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserSettingsData) {

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
        if (UserSettings.instance) {
            return UserSettings.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettings.instance = this;

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?user-setting=${this.userId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: async () => await this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

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
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            const close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            const save = this.tpl.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveHandler(this));

            // Avatar context menu
            const avatarContextMenu = this.tpl.querySelector(":scope >.content [action-choose-photo]");
            avatarContextMenu?.addEventListener("click", (event) => avatarContextMenuHandler(event, this));

            // Email
            const email = this.tpl.querySelector(":scope >.content [action-set-email]");
            email?.addEventListener("click", () => new UserSettingEmail({ userId: this.userId }));

            // Link
            const link = this.tpl.querySelector(":scope >.content [action-set-link]");
            link?.addEventListener("click", () => new UserSettingLink({ userId: this.userId }));

            // Decoration
            const decoration = this.tpl.querySelector(":scope >.content [action-set-decoration]");
            decoration?.addEventListener("click", () => new UserSettingDecorations({ userId: this.userId }));

            // Notifications
            const notifications = this.tpl.querySelector(":scope >.content [action-set-notifications]");
            notifications?.addEventListener("click", () => new UserSettingNotifications({ userId: this.userId }));

            // Privacy
            const privacy = this.tpl.querySelector(":scope >.content [action-set-privacy]");
            privacy?.addEventListener("click", () => new UserSettingPrivacy({ userId: this.userId }));

            // Security (2FA TOTP и ключи доступа)
            const security = this.tpl.querySelector(":scope >.content [action-set-security]");
            security?.addEventListener("click", () => new UserSettingSecurity({ userId: this.userId }));

            // Devices
            const devices = this.tpl.querySelector(":scope >.content [action-devices]");
            devices?.addEventListener("click", () => new UserSettingDevices({ userId: this.userId }));

            // Set password
            const setPassword = this.tpl.querySelector(":scope >.content [action-set-password]");
            setPassword?.addEventListener("click", () => new UserSettingPassword({ userId: this.userId }));

            // Exit session
            const exitSession = this.tpl.querySelector(":scope >.content [action-exit-account]");
            exitSession?.addEventListener("click", () => exitSessionHandler(this));

            // Logout session
            const logoutSession = this.tpl.querySelector(":scope >.content [action-logout]");
            logoutSession?.addEventListener("click", () => logoutSessionHandler(this));

            // Настройки кеша
            const manageCache = this.tpl.querySelector(":scope >.content [action-manage-cache]");
            manageCache?.addEventListener("click", () => new UserSettingCache({ userId: this.userId }));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Текущая сессия
            const session = LocalStorage.session;

            // Без сессии профиль не заполнить
            if (!session) return;

            // Устанавливаем элементы
            if (!this.tpl) return;
            this.content = this.tpl.querySelector(":scope >.content");
            const avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            const email = this.tpl.querySelector<HTMLElement>(`:scope >.content [action-set-email]`);
            const firtName = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="first-name"]`);
            const lastName = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="last-name"]`);
            const link = this.tpl.querySelector<HTMLElement>(`:scope >.content [action-set-link]`);
            const bio = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="bio"]`);

            // invariant: профиль текущей сессии приходит с сервера в
            // фиксированном виде { id, display_name, email, first_name,
            // last_name, link, bio, avatar } — читаем поля этим сужением unknown
            const user = session.user as SessionUserFields;

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!email || !firtName || !lastName || !link || !bio) return;

            // Аватар
            this.avatar = new Avatars({
                element: avatar,
                id: user.id,
                name: user.display_name,
                image: user.avatar,
                size: "3xl"
            });

            // Записываем данные
            email.textContent = user.email;
            firtName.value = user.first_name;
            lastName.value = user.last_name;
            link.textContent = user.link || window._lc.forms.user_settings.not_select;
            bio.value = user.bio;

            // Инициализируем скроллбар
            const content = this.content;
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
    // Действия при закрытии формы
    // ***************************************************************************
    async _onBeforeClose(): Promise<void> {

        // Удаляем экземпляр формы
        UserSettings.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form user-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-2xl p-3 py-4 items-center self-center relative">
                            <div class="cdm-avatar relative"></div>
                            ${Buttons.primary({ shape: "circle", attributes: ["action-choose-photo"], classes: ["absolute", "z-1", "bottom-[0.5rem]", "right-[0.5rem]"], icon: "Camera" })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("at", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.email}
                            </span>
                            ${Buttons.create({ attributes: ["action-set-email"], classes: ["font-mono"], text: window._lc.forms.user_settings.email })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.first_name}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.user_settings.first_name, name: "first-name", attributes: ["required"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.last_name}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.user_settings.last_name, name: "last-name", attributes: ["required"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("link", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.link}
                            </span>
                            ${Buttons.create({ attributes: ["action-set-link"], classes: ["font-mono"], text: window._lc.forms.user_settings.not_select })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.bio}
                            </span>
                            ${Inputs.textarea({ placeholder: window._lc.forms.user_settings.bio, name: "bio", rows: 4 })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("brush", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.decoration}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_settings.decoration_desc}</span>
                            ${Buttons.create({ attributes: ["action-set-decoration"], text: window._lc.forms.user_settings.decoration })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("bell", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.notifications}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_settings.notifications_desc}</span>
                            ${Buttons.create({ attributes: ["action-set-notifications"], text: window._lc.forms.user_settings.notifications })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("alphabet-cyrillic", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.language}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_settings.language_desc}</span>
                            ${Buttons.create({ attributes: ["action-set-language"], text: window._lc.forms.user_settings.language })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("shield-check", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.security}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_settings.security_desc}</span>
                            ${Buttons.create({ attributes: ["action-set-security"], text: window._lc.forms.user_settings.security })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("shield-lock", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.privacy}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_settings.privacy_desc}</span>
                            ${Buttons.create({ attributes: ["action-set-privacy"], text: window._lc.forms.user_settings.privacy })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("user-exclamation", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.account_actions}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_settings.account_actions_desc}</span>
                            ${Buttons.create({ attributes: ["action-devices"], text: window._lc.forms.user_settings.devices })}
                            ${Buttons.create({ attributes: ["action-set-password"], text: window._lc.forms.user_settings.set_password })}
                            ${Buttons.create({ attributes: ["action-exit-account"], text: window._lc.forms.user_settings.set_account })}
                            ${Buttons.create({ intent: "danger", attributes: ["action-logout"], text: window._lc.forms.user_settings.logout })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("info-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_settings.about}
                            </span>
                            <div class="flex flex-col gap-0">
                                <span class="text-sm text-secondary">${window._lc.forms.user_settings.app_build_version} __BUILD_VERSION__</span>
                                <span class="text-sm text-secondary">${window._lc.forms.user_settings.app_build_at} __BUILD_AT__</span>
                            </div>
                            ${Buttons.create({ attributes: ["action-manage-cache"], text: window._lc.forms.user_settings.manage_cache })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
