// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем functions
import { getChannels } from "./functions/get_channels.js";

// Импортируем handlers
import { closeHandler } from "./handlers/close.js";
import { forwardMessagesHandler } from "./handlers/forward_messages.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем типы
import type { ForwardChannelRecord } from "./types.js";

/**
 * Callback формы: получает id выбранных каналов-получателей.
 */
export type ForwardMessagesCallback = (selectedIds: string[]) => void;

/**
 * Настройки формы пересылки.
 */
export interface ForwardMessagesOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface ForwardMessagesData {

    /** Callback, вызываемый с id выбранных каналов. */
    callback?: ForwardMessagesCallback;

    /** Настройки формы. */
    options?: ForwardMessagesOptions;

}

// Form
export class ForwardMessages {

    // Переменная для хранения единственного экземпляра формы
    static instance: ForwardMessages | null = null;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: ForwardMessagesOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    list: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Данные формы
    callback: ForwardMessagesCallback | null;
    selectedChannelsIds: string[];

    // Хранилище списка каналов
    store: Store<ForwardChannelRecord>;

    /**
     * ***************************************************************************
     * Форма выбора каналов для пересылки сообщений.
     * @param data - Данные.
     * @param data.callback - Callback (получает id выбранных каналов).
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data?: ForwardMessagesData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.callback = data?.callback || null;
        this.selectedChannelsIds = [];

        // Хранилище списка каналов
        this.store = new Store<ForwardChannelRecord>();

        // Проверяем, существует ли уже экземпляр
        if (ForwardMessages.instance) {
            return ForwardMessages.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ForwardMessages.instance = this;

        // Инициализация
        this._init();

    }

    // *************************************************************************
    // Инициализация
    // *************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        subscribeStoreEvents(this);

        // Открытие
        await this._open();

    }

    // *************************************************************************
    // Открытие
    // *************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                closeOnSwipe: { direction: "right" },
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

    // *************************************************************************
    // Обработчики
    // *************************************************************************
    _handlers(): void {

        try {

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => closeHandler(this));

            // Переслать
            let forward = this.tpl?.querySelector(":scope >[action-forward-messages]");
            forward?.addEventListener("click", () => forwardMessagesHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Настройка формы
    // *************************************************************************
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

            // Получаем каналы с IndexedDB
            await getChannels(this);

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Форма открылась
    // *************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // *************************************************************************
    // Действия при закрытии формы
    // *************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        ForwardMessages.instance = null;

    }

    // *************************************************************************
    // Шаблон формы
    // *************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form forward-messages flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 justify-end items-center ${CDM_FORM_HEADER_CLASSES()}">
                    <button action-close class="rounded-full">${Icons.icon("X")?.outerHTML}</button>
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col p-2 gap-0 w-full"></div>
                </div>
                ${Buttons.primary({ shape: "circle", attributes: ["action-forward-messages"], icon: "arrow-back-up-double" })}
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
