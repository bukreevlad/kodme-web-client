// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { ElectronNotifications } from "../../utils/electron_notifications.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { enableHandler } from "./handlers/enable.js";
import { disableHandler } from "./handlers/disable.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";

// Импортируем requests
import { getNotifySettingsRequest } from "./requests/get_notify_settings.js";

// Импортируем типы
import type { SessionUserFields } from "../user-settings/types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы уведомлений.
 */
export interface UserSettingNotificationsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingNotificationsData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingNotificationsOptions;

}

// Form
export class UserSettingNotifications {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingNotifications | null = null;

    /** Настройки формы. */
    options: UserSettingNotificationsOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

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
    constructor(data: UserSettingNotificationsData) {

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
        if (UserSettingNotifications.instance) {
            return UserSettingNotifications.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingNotifications.instance = this;

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
                type: "form",
                url: `?user-setting-notifications=${this.userId}`,
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
            const close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            const save = this.tpl.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveHandler(this));

            // Включить
            const enable = this.tpl.querySelector(":scope >.content [action-enable]");
            enable?.addEventListener("click", () => enableHandler(this));

            // Выключить
            const disable = this.tpl.querySelector(":scope >.content [action-disable]");
            disable?.addEventListener("click", () => disableHandler(this));

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

            // Запрос
            const getSettings = await getNotifySettingsRequest();

            // Кешируем серверные настройки для нативных уведомлений Electron
            // (тумблеры формы фильтруют показ без запроса на каждое уведомление)
            ElectronNotifications.cacheSettings(getSettings?.data);

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            const enable = this.tpl.querySelector<HTMLElement>(":scope >.content [action-enable]");
            const disable = this.tpl.querySelector<HTMLElement>(":scope >.content [action-disable]");
            const pushDesc = this.tpl.querySelector<HTMLElement>(":scope >.content [data-push-desc]");
            const actionAccounts = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="action-accounts"]`);
            const calls = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="calls"]`);
            const messages = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="messages"]`);
            const comments = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="comments"]`);
            const replyMessage = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="reply-message"]`);

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!enable || !disable || !pushDesc || !actionAccounts || !calls || !messages || !comments || !replyMessage) return;

            // Записываем данные (data может быть undefined — пользователь не найден)
            getSettings?.data?.notify_action_accounts && actionAccounts.click();
            getSettings?.data?.notify_calls && calls.click();
            getSettings?.data?.notify_messages && messages.click();
            getSettings?.data?.notify_comments && comments.click();
            getSettings?.data?.notify_reply_message && replyMessage.click();

            // Текущая сессия (без неё состояние push-провайдера не узнать)
            const session = LocalStorage.session;
            if (!session) return;

            // invariant: профиль текущей сессии приходит с сервера — читаем
            // поле push-провайдера is_pushes этим сужением unknown
            const user = session.user as SessionUserFields;

            // Определяем включены ли уведомления
            const isPushes = user?.is_pushes;
            if (isPushes) {
                enable.classList.add("hidden");
                disable.classList.remove("hidden");
                pushDesc.classList.remove("hidden");
            } else {
                enable.classList.remove("hidden");
                disable.classList.add("hidden");
                pushDesc.classList.add("hidden");
            }

            // Описание в зависимости от типа уведомлений web или андроид
            if (isPushes === "web") {
                pushDesc.textContent = t("forms.user_setting_notifications.notify_desc_web")
            } else if (["hms", "fcm"].includes(isPushes ?? "")) {
                pushDesc.textContent = t("forms.user_setting_notifications.notify_desc_android")
            }

            // Инициализируем скроллбар
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

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
        UserSettingNotifications.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-notifications flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("bell", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_notifications.notify_enabled")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_notifications.notify_enabled_desc")}</span>
                            ${Buttons.primary({ attributes: ["action-enable"], classes: ["w-full", "hidden"], text: t("forms.user_setting_notifications.enable") })}
                            ${Buttons.warning({ attributes: ["action-disable"], classes: ["w-full", "hidden"], text: t("forms.user_setting_notifications.disable") })}
                            <span data-push-desc class="text-sm text-muted">${t("forms.user_setting_notifications.notify_enabled_desc")}</span>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("user-exclamation", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_notifications.account_action")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_notifications.account_action_desc")}</span>

                            ${Toggle.switch({
            name: "action-accounts",
            checked: false,
            toggleText: {
                on: t("forms.user_setting_notifications.enabled"),
                off: t("forms.user_setting_notifications.disabled")
            }
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("phone", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_notifications.calls")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_notifications.calls_desc")}</span>

                            ${Toggle.switch({
            name: "calls",
            checked: false,
            toggleText: {
                on: t("forms.user_setting_notifications.enabled"),
                off: t("forms.user_setting_notifications.disabled")
            }
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_notifications.messages")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_notifications.messages_desc")}</span>

                            ${Toggle.switch({
            name: "messages",
            checked: false,
            toggleText: {
                on: t("forms.user_setting_notifications.enabled"),
                off: t("forms.user_setting_notifications.disabled")
            }
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("messages", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_notifications.comments")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_notifications.comments_desc")}</span>

                            ${Toggle.switch({
            name: "comments",
            checked: false,
            toggleText: {
                on: t("forms.user_setting_notifications.enabled"),
                off: t("forms.user_setting_notifications.disabled")
            }
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("corner-up-left", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_notifications.reply_message")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_notifications.reply_message_desc")}</span>

                            ${Toggle.switch({
            name: "reply-message",
            checked: false,
            toggleText: {
                on: t("forms.user_setting_notifications.enabled"),
                off: t("forms.user_setting_notifications.disabled")
            }
        })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
