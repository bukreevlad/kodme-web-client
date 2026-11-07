// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { settingsHandler } from "./handlers/settings.js";
import { createChatHandler } from "./handlers/create_chat.js";
import { callHandler } from "./handlers/call.js";
import { contextMenuHandler } from "./handlers/context_menu.js";

// Импортируем requests
import { getUserInfoRequest } from "./requests/get_user_info.js";

// Импортируем типы
import type { SessionProfile } from "../menu/types.js";
import type { UserProfileRecord } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы профиля пользователя.
 */
export interface UserProfileOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserProfileData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserProfileOptions;

}

// Form
export class UserProfile {

    // Реестр всех открытых форм UserProfile: { userId: instance }
    static instances = new Map<string, UserProfile>();

    // Переменные формы
    userId: string;

    /** Профиль пользователя (загружается в _onBeforeOpen). */
    profile: UserProfileRecord | null;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: UserProfileOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Форма профиля пользователя.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserProfileData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Устанавливаем настройки
        this.options = {
            insertInto: data?.options?.insertInto || document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container"),
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.userId = data.userId;
        this.profile = null;

        // Регистрируем этот экземпляр формы
        // Проверяем, существует ли уже экземпляр
        let instance = UserProfile.instances.get(data.userId);
        if (instance) return instance;

        UserProfile.instances.set(this.userId, this);

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
                url: `?user-profile=${this.userId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
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
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Настройки
            let settings = this.tpl.querySelector(":scope >.header >[action-settings]");
            settings?.addEventListener("click", () => settingsHandler(this));

            // Написать
            let createChat = this.tpl.querySelector(":scope >.content [data-actions] [action-create-chat]");
            createChat?.addEventListener("click", () => createChatHandler(this));

            // Позвонить
            let call = this.tpl.querySelector(":scope >.content [data-actions] [action-call]");
            call?.addEventListener("click", () => callHandler(this));

            // Еще
            let menu = this.tpl.querySelector(":scope >.content [data-actions] [action-menu]");
            menu?.addEventListener("click", (event) => contextMenuHandler(event, this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Текущая сессия: поле user хранится как unknown (граница
            // localStorage), приводим к профилю сессии — invariant: сессия
            // всегда пишется целиком с полем user (см. SessionProfile)
            let session = LocalStorage.session;

            // Без сессии профиль не заполнить
            if (!session) return;
            let sessionUser = session.user as SessionProfile;

            // Запрос
            let response = await getUserInfoRequest({ user_id: this.userId });
            if (!response.data) throw new Error("Не смогли загрузить профиль пользователя");

            // Данные
            this.profile = response.data;

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            let settings = this.tpl.querySelector(":scope >.header >[action-settings]");
            let actions = this.tpl.querySelector(":scope >.content [data-actions]");
            let avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            let name = this.tpl.querySelector(":scope >.content [data-name]");
            let link = this.tpl.querySelector(":scope >.content [data-link]");
            let bio = this.tpl.querySelector(":scope >.content [data-bio]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!settings || !actions || !name || !link || !bio) return;

            // Аватар
            new Avatars({
                element: avatar,
                id: this.profile.id,
                name: this.profile.display_name,
                image: this.profile.avatar,
                size: "3xl"
            });

            // Записываем данные (link/bio опциональны — нормализуем, чтобы
            // в поле не «утекало» undefined)
            name.textContent = this.profile.display_name;
            link.textContent = this.profile.link ?? null;
            bio.textContent = this.profile.bio ?? null;

            // Если это не текущий пользователь
            if (sessionUser.id !== this.userId) {
                settings.classList.add("hidden");
            }

            // Если это текущий пользователь
            if (sessionUser.id === this.userId) {
                actions.classList.add("hidden");
            }

            // Инициализируем скроллбар
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // ==================================

            // Сообщаем системе, что форма открыта
            window.dispatchEvent(new CustomEvent("[app][form]::opened", {
                detail: {
                    id: this.modal?.options.id,
                    data: {
                        instance: this,
                        title: this.profile.display_name,
                        subtitle: t("forms.user_profile.subtitle")
                    }
                }
            }));

            // ==================================

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

        // Удаляем экземпляр формы из реестра
        UserProfile.instances.delete(this.userId);

        // Сообщаем системе, что форма закрыта
        window.dispatchEvent(new CustomEvent("[app][form]::closed", {
            detail: { id: this.modal?.options.id }
        }));

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form user-profile flex flex-col gap-0 w-full ${CDM_FORM_CLASSES()}">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-close"],
            icon: "ArrowLeft"
        })}
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-settings"],
            icon: "Settings"
        })}
                </div>
                 <div class="content w-full h-full flex flex-col gap-0 p-3 ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 py-4 items-center max-w-[var(--form-max-content-width)] m-auto">

                        <div class="cdm-avatar relative"></div>
                        <div class="flex flex-col gap-1 items-center">
                            <span data-name class="font-semibold"></span>
                            <span data-link class="empty:hidden text-[var(--color-brand)] dark:text-[var(--color-brand)] font-mono"></span>
                            <span data-bio class="empty:hidden text-muted text-center font-mono text-sm"></span>
                        </div>
                        <div data-actions class="flex flex-row w-full gap-2 justify-center">
                            ${Buttons.create({
            shape: "square",
            attributes: ["action-create-chat"],
            classes: ["flex-col", "flex-1", "p-2", "gap-2", "text-secondary", "text-sm"],
            icon: "message-circle",
            text: t("forms.user_profile.chat")
        })}
                            ${Buttons.create({
            shape: "square",
            attributes: ["action-call"],
            classes: ["flex-col", "flex-1", "p-2", "gap-2", "text-secondary", "text-sm"],
            icon: "PhoneOutgoing",
            text: t("forms.user_profile.call")
        })}
                            ${Buttons.create({
            shape: "square",
            attributes: ["action-menu"],
            classes: ["flex-col", "flex-1", "p-2", "gap-2", "text-secondary", "text-sm"],
            icon: "dots",
            text: t("forms.user_profile.other")
        })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
