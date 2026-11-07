// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";
import { Socket } from "../../config/socket.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";

// Импортируем events
import { subscribeSocketEvents } from "./events/socket/socket_events.js";
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем типы
import type { OnlineChatMessage } from "./types.js";

/**
 * Данные формы онлайн-чата трансляции.
 */
export interface BroadcastOnlineChatData {

    /** Данные для авторизации (значение параметра broadcastOnlineChat). */
    auth: string;

    /** Настройки формы. */
    options?: BroadcastOnlineChatOptions;

}

/**
 * Настройки формы онлайн-чата трансляции.
 */
export interface BroadcastOnlineChatOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class BroadcastOnlineChat {

    // Переменная для хранения единственного экземпляра формы
    static instance: BroadcastOnlineChat | null = null;

    // Переменные формы
    auth: string;

    // Каркас: шаблон, модалка, контент и список сообщений
    options: BroadcastOnlineChatOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    list: HTMLElement | null;

    // Скроллбар списка и менеджер якоря
    osListScrollInstance: OverlayScrollbars | null = null;

    // Хранилище списка сообщений
    store: Store<OnlineChatMessage>;

    /**
     * ***************************************************************************
     * Форма онлайн-чата трансляции.
     * @param data - Данные.
     * @param data.auth - Данные для авторизации.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BroadcastOnlineChatData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector("body"),
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;

        // Переменные формы
        this.auth = data.auth;

        // Хранилище списка сообщений
        this.store = new Store<OnlineChatMessage>();

        // Проверяем, существует ли уже экземпляр
        if (BroadcastOnlineChat.instance) {
            return BroadcastOnlineChat.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BroadcastOnlineChat.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        subscribeStoreEvents(this);

        // Инициализируем сокет
        Socket.client = new Socket(`/api/v1/wss/cast_online_chat?access_token=${this.auth}`, {
            autoReconnect: true,
            reconnectAttempts: 0,
            defaultAckTimeout: 5000,
            heartbeatEnabled: false   // cast-роут не отвечает на сообщения, heartbeat не имеет смысла
        });

        // Соединяемся с сервером
        await Socket.client.connect();

        // Подписываемся на события Socket.
        subscribeSocketEvents();

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
                type: "form",
                insertInto: this.options.insertInto,
                overlay: false,
                onBeforeOpen: async () => await this._setup(),
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onClose(),
                openAnimationClass: null,
                closeAnimationClass: null
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

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _setup(): Promise<void> {

        try {

            // Получаем контейнер скролла (обертка списка)
            this.content = this.tpl?.querySelector(":scope >.content") ?? null;

            // Устанавливаем список
            this.list = this.tpl?.querySelector(":scope >.content [data-list]") ?? null;

            // Инициализируем скролл
            // invariant: onBeforeOpen вызывается после _template — контейнер
            // контента собран из наших строк
            this.osListScrollInstance = OverlayScrollbars(this.content!, {
                scrollbars: { visibility: "hidden", autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onClose(): void {

        // Удаляем экземпляр формы
        BroadcastOnlineChat.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form broadcast-online-chat bg-transparent flex flex-col w-full">
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-1 p-0 w-full h-full"></div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
