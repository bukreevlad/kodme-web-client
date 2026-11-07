// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Icons } from "../../utils/icons.js";
import { t } from "../../utils/i18n/index.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { settingsHandler } from "./handlers/settings.js";
import { createChatHandler } from "./handlers/create_chat.js";
import { openAppsHandler } from "./handlers/open_apps.js";

// Импортируем requests
import { getBotInfoRequest } from "./requests/get_bot_info.js";

// Импортируем типы
import { BotInfo } from "./requests/get_bot_info.js";
import type { SessionProfile } from "../menu/types.js";

/**
 * Настройки формы профиля бота.
 */
export interface BotProfileOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface BotProfileData {

    /** Id бота. */
    botId: string;

    /** Настройки формы. */
    options?: BotProfileOptions;

}

// Form
export class BotProfile {

    // Реестр всех открытых форм BotProfile: { botId: instance }
    static instances = new Map<string, BotProfile>();

    /** Настройки формы. */
    options: BotProfileOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Id бота. */
    botId: string;

    /** Данные бота (ответ "[bot]: get info"). */
    profile: BotInfo | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BotProfileData) {

        // Если не передан botId
        if (!data?.botId) throw new Error("Не передан: botId");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы
        this.botId = data.botId;

        // Получаем instance
        let instance = BotProfile.instances.get(data.botId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        BotProfile.instances.set(this.botId, this);

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
                url: `?bot-profile=${this.botId}`,
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

            // Приложения
            let openApps = this.tpl.querySelector(":scope >.content [data-actions] [action-open-apps]");
            openApps?.addEventListener("click", () => openAppsHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Текущая сессия (user хранится как unknown на границе
            // localStorage — invariant: форма читает из него id профиля,
            // канон — menu/handlers/profile.ts)
            const session = LocalStorage.session;

            // Без сессии профиль не заполнить
            if (!session) return;
            const sessionUser = session.user as SessionProfile;

            // Запрос
            let response = await getBotInfoRequest({ bot_id: this.botId });
            if (!response.data) throw new Error("Не смогли загрузить профиль бота");

            // Данные
            this.profile = response.data;

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            let settings = this.tpl.querySelector(":scope >.header >[action-settings]");
            let avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            let link = this.tpl.querySelector(":scope >.content [data-link]");
            let bio = this.tpl.querySelector(":scope >.content [data-bio]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!settings || !link || !bio) return;

            // Аватар
            new Avatars({
                element: avatar,
                id: this.profile.id,
                name: this.profile.link,
                image: this.profile?.avatar,
                size: "3xl"
            });

            // Записываем данные
            link.textContent = this.profile.link;
            bio.textContent = this.profile.bio;

            // Если это не текущий пользователь
            if (sessionUser.id !== this.profile.bot_created_user_id) {
                settings.classList.add("hidden");
            }

            // Инициализируем скролл
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
                        title: this.profile.link,
                        subtitle: t("forms.bot_profile.subtitle")
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
        BotProfile.instances.delete(this.botId);

        // Сообщаем системе, что форма закрыта
        window.dispatchEvent(new CustomEvent("[app][form]::closed", {
            detail: { id: this.modal?.options.id }
        }));

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form bot-profile flex flex-col gap-0 w-full ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-settings"], icon: "Settings" })}
                </div>
                 <div class="content w-full h-full flex flex-col gap-0 ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-0 max-w-[var(--form-max-content-width)] m-auto">

                        <div class="flex flex-col gap-3 p-3 py-4 items-center">
                            <div class="cdm-avatar relative"></div>
                            <div class="flex flex-col gap-1 items-center">
                                <span data-link class="empty:hidden text-[var(--color-brand)] dark:text-[var(--color-brand)] font-semibold font-mono"></span>
                                <span data-bio class="empty:hidden text-muted font-mono text-sm"></span>
                            </div>
                            <div data-actions class="flex flex-row w-full gap-2 justify-center">
                                ${Buttons.create({ attributes: ["action-create-chat"], classes: ["flex-col", "flex-1", "p-2", "gap-2", "text-secondary", "text-sm"], icon: "message-circle", text: t("forms.bot_profile.chat") })}
                                ${Buttons.create({ attributes: ["action-open-apps"], classes: ["flex-col", "flex-1", "p-2", "gap-2", "text-secondary", "text-sm"], icon: "app-window", text: t("forms.bot_profile.apps") })}
                            </div>
                        </div>

                        <div class="cdm-tabs-container flex flex-col"></div>

                    </div>
                    
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
