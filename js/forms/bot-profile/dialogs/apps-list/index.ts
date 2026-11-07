// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Store } from "../../../../utils/store.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем forms
import { BotProfile } from "../../../bot-profile/index.js";

// Импортируем functions
import { showApps } from "./functions/show_apps.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store-apps/index.js";

// Импортируем типы
import { BotAppItem } from "../../../bot-profile/requests/get_bot_info.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки диалога приложений бота.
 */
export interface BotAppsListOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога.
 */
export interface BotAppsListData {

    /** Id бота. */
    botId: string;

    /** Приложения бота. */
    apps?: BotAppItem[] | undefined;

    /** Настройки формы. */
    options?: BotAppsListOptions;

}

// Form
export class BotAppsList {

    // Переменная для хранения единственного экземпляра формы
    static instance: BotAppsList | null = null;

    /** Настройки формы. */
    options: BotAppsListOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Список приложений. */
    list: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Приложения бота. */
    apps: BotAppItem[];

    /** Хранилище приложений бота. */
    store = new Store<BotAppItem>();

    /**
     * ***************************************************************************
     * Диалог.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.apps - Приложения бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BotAppsListData) {

        // Если не передан botId
        if (!data?.botId) throw new Error("Не передан: botId");

        // Поиск открытого профиля бота
        let boProfileForm = BotProfile.instances.get(data.botId);
        let insertInto = boProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto: insertInto || data.options?.insertInto,
            ...data?.options
        }

        // Переменные формы
        this.apps = data.apps || [];

        // Проверяем, существует ли уже экземпляр
        if (BotAppsList.instance) {
            return BotAppsList.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BotAppsList.instance = this;

        // Инициализация
        this._init();

    }

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

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
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

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Устанавливаем элементы
            this.content = this.tpl?.querySelector(":scope >.content") ?? null;
            this.list = this.tpl?.querySelector(":scope >.content [data-list]") ?? null;

            // Инициализируем скролл
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Показываем приложения бота
            showApps(this);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        BotAppsList.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal bot-apps-list flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            ${Icons.icon("apps", { settings: { size: 20 } })?.outerHTML ?? ""}
                        </span>
                        ${t("forms.bot_profile.dialogs.apps_list.title")}
                    </span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-2"></div>
                </div>
            </div>

        `, "text/html").querySelector(".cdm-modal");

    }

}
