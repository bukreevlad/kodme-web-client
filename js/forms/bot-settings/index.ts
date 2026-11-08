// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { contextMenuHandler } from "./handlers/context_menu.js";
import { avatarContextMenuHandler } from "./handlers/avatar_menu.js";
import { addAppHandler } from "./handlers/add_app.js";

// Импортируем requests
import { getBotSettingsRequest } from "./requests/get_bot_settings.js";

// Импортируем forms
import { BotProfile } from "../bot-profile/index.js";
import { BotSettingLink } from "../bot-setting-link/index.js";

// Импортируем functions
import { buildTreeArray } from "./functions/build_tree_array.js";
import { showMenuBot } from "./functions/show_menu_bot.js";
import { showAppsBot } from "./functions/show_apps_bot.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store-apps/index.js";

// Импортируем типы
import type { BotAppRecord, BotMenuNode, BotSettingsProfile } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы настроек бота.
 */
export interface BotSettingsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы настроек бота.
 */
export interface BotSettingsData {

    /** Id бота. */
    botId: string;

    /** Настройки формы. */
    options?: BotSettingsOptions;

}

// Form
export class BotSettings {

    // Переменная для хранения единственного экземпляра формы
    static instance: BotSettings | null = null;

    /**
     * ***************************************************************************
     * Форма настроек бота.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BotSettingsData) {

        // Если не передан botId
        if (!data?.botId) throw new Error("Не передан: botId");

        // Поиск открытого профиля бота
        let botProfileForm = BotProfile.instances.get(data.botId);
        let insertInto = botProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.listApps = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.botId = data.botId;
        this.profile = null;
        this.menuTree = [];
        this.currentCategoryId = null;
        this.avatar = null;

        // Хранилище приложений бота
        this.storeApps = new Store<BotAppRecord>();

        // Проверяем, существует ли уже экземпляр
        if (BotSettings.instance) {
            return BotSettings.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BotSettings.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: BotSettingsOptions;

    // Id бота
    botId: string;

    // Данные профиля бота, дерево меню и текущая категория
    profile: BotSettingsProfile | null;
    menuTree: BotMenuNode[];
    currentCategoryId: string | null;

    // Компонент аватара бота
    avatar: Avatars | null;

    // Хранилище приложений бота
    storeApps: Store<BotAppRecord>;

    // Каркас: шаблон, модалка, контент, список приложений
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    listApps: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?bot-settings=${this.botId}`,
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
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            let save = this.tpl.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveHandler(this));

            // Установить имя
            let link = this.tpl.querySelector(":scope >.content [action-set-link]");
            link?.addEventListener("click", (event) => {
                // Профиль загружается до открытия формы; пустую ссылку
                // нормализуем в `""` — BotSettingLink отвергнет её при валидации
                const profile = this.profile;
                if (profile) new BotSettingLink({ botId: this.botId, botLink: profile.link ?? "" });
            });

            // Контекстное меню
            let contextMenu = this.tpl.querySelector(":scope >.content [action-context-menu]");
            contextMenu?.addEventListener("click", (event) => contextMenuHandler(event, this));

            // Контекстное меню аватара (загрузить/удалить)
            let avatarMenu = this.tpl.querySelector(":scope >.content [action-choose-photo]");
            avatarMenu?.addEventListener("click", (event) => avatarContextMenuHandler(event, this));

            // Добавить приложение бота
            let addApp = this.tpl.querySelector(":scope >.content [action-add-app]");
            addApp?.addEventListener("click", (event) => addAppHandler(this));

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

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            this.listApps = this.tpl.querySelector(":scope >.content [data-apps-list]");

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Запрос
            let response = await getBotSettingsRequest({ bot_id: this.botId });
            if (!response.data) return;

            // Обновляем форму
            this._update(response.data);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обновляем данные формы
    // ***************************************************************************
    _update(data: BotSettingsProfile): void {

        // Записываем данные
        this.profile = data;

        // Без шаблона заполнять нечего
        if (!this.tpl) return;

        // Устанавливаем элементы
        let avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
        let link = this.tpl.querySelector(`:scope >.content [action-set-link]`);
        let bio = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="bio"]`);
        let id = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="id"]`);
        let token = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="token"]`);

        // Поля обязаны входить в шаблон — иначе заполнять нечего
        if (!link || !bio || !id || !token) return;

        // Аватар
        this.avatar = new Avatars({
            element: avatar,
            id: data.id,
            name: data.link,
            image: data?.avatar,
            size: "3xl"
        });

        // Записываем данные (bio/bot_token опциональны — нормализуем,
        // чтобы в поле не «утекало» null)
        link.textContent = data.link;
        bio.value = data.bio ?? "";
        id.value = data.id;
        token.value = data.bot_token ?? "";

        // Создаем дерево из комманд и категорий
        this.menuTree = buildTreeArray(this.profile.bot_commands);

        // Отображаем меню бота
        showMenuBot(this, this.menuTree);

        // Отображаем apps бота
        showAppsBot(this);

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
        BotSettings.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form bot-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
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
                                    ${Icons.icon("link", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.link")}
                            </span>
                            ${Buttons.create({ attributes: ["action-set-link"], classes: ["font-mono"], text: t("forms.bot_settings.not_select") })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.bio")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.bot_settings.bio"), name: "bio", rows: 4 })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("id", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.id")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.bot_settings.id"), name: "id", classes: ["font-mono"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("key", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.token")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.bot_settings.token"), name: "token", classes: ["font-mono"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-0">
                                <div class="flex flex-row items-center justify-between">
                                    <span class="flex flex-row gap-2 items-center font-semibold">
                                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                            ${Icons.icon("menu", { settings: { size: 20 } })?.outerHTML ?? ""}
                                        </span>
                                        ${t("forms.bot_settings.bot_menu")}
                                    </span>
                                    ${Buttons.transparent({ shape: "circle", attributes: ["action-context-menu"], icon: "dots-vertical" })}
                                </div>
                                <div data-path class="flex flex-row gap-1"></div>
                            </div>
                            <div data-menu class=""></div>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-row items-center justify-between">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("apps", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${t("forms.bot_settings.apps")}
                                </span>
                                ${Buttons.transparent({ shape: "circle", attributes: ["action-add-app"], icon: "plus" })}
                            </div>
                            <div data-apps-list class="flex flex-col gap-0"></div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
