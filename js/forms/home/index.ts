// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { IndexedDB } from "../../utils/indexed_db.js";
import { CacheManager } from "../../utils/cache_manager.js";
import { Vault } from "../../utils/crypto/vault.js";

// Импортируем managers
import { TabsManager } from "../../core/managers/form_tabs_manager.js";
import { SecretChatsManager } from "../../core/managers/secret_chats_manager.js";
import { SecretCallsManager } from "../../core/managers/secret_calls_manager.js";

// Импортируем config
import { Socket } from "../../config/socket.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";

// Импортируем forms
import { Main } from "../main/index.js";
import { SecretChatIncoming } from "../secret-chat-incoming/index.js";
import { SecretCallIncoming } from "../secret-call-incoming/index.js";

// Импортируем handlers
import { tabsScrollHandler } from "./handlers/tabs_scroll.js";

// Импортируем routes
import { initRoutes } from "../../router/routes.js";

// Form
export class Home {

    // Переменная для хранения единственного экземпляра формы
    static instance: Home | null = null;

    /** Настройки формы. */
    options: object;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контейнер вкладок формы. */
    tabContainer: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: object) {

        // Устанавливаем настройки
        this.options = {
            ...options
        }

        // Проверяем, существует ли уже экземпляр
        if (Home.instance) {
            return Home.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Home.instance = this;

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

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                closeOnEsc: false,
                closeOnOverlay: false,
                closeOnSwipe: null,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                notReplaceAnimationClassIsMobile: true,
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

            // Перехватываем скролл и переводим его в горизонтальный
            this.tabContainer?.addEventListener("wheel", (event: WheelEvent) => tabsScrollHandler(event, this), { passive: false });

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
            this.tabContainer = this.tpl?.querySelector(":scope >.content >.middle >.tab-container") ?? null;

            // Инициализируем БД
            await IndexedDB.initial(LocalStorage.sessionId);

            // Инициализируем Cache: без id сессии инициализировать нечего
            const sessionId = LocalStorage.sessionId;
            if (sessionId) {
                await CacheManager.initializeSessionCache(sessionId);
            }

            // Получаем сессию
            const session = LocalStorage.session;

            // Инициализируем сокет
            Socket.client = new Socket(`/api/v1/wss/client?access_token=${session?.access_token}`, {
                autoReconnect: true,
                reconnectAttempts: 0,
                defaultAckTimeout: 5000
            });

            // Соединяемся с сервером
            await Socket.client.connect();

            // Инициализируем vault-ключ секретных чатов (нужен менеджеру
            // для шифрования локальных записей) и сам менеджер — строго
            // после соединения: он подписывается на события сокета
            const vaultSessionId = LocalStorage.sessionId;
            if (vaultSessionId) {
                await Vault.initial(vaultSessionId);
                const chatsManager = SecretChatsManager.initial();

                // Приглашение в секретный чат — модалка на каждом
                // онлайн-устройстве собеседника (принимает выбранное)
                chatsManager.on("chat::incoming", ({ chatId }) => {
                    new SecretChatIncoming({ chatId });
                });

                // Менеджер секретных звонков: входящий звонок показывает
                // модалку на каждом онлайн-устройстве собеседника
                const callsManager = SecretCallsManager.initial();
                callsManager.on("call::incoming", ({ callId }) => {
                    new SecretCallIncoming({ callId });
                });
            }

            this._handlers()

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Без таб-контейнера из шаблона форму не настроить
        if (!this.tabContainer) return;

        // Инициализируем скролл
        this.osListScrollInstance = OverlayScrollbars(this.tabContainer, {
            scrollbars: { autoHide: "scroll" }, overflow: { x: "scroll", y: "hidden" }
        });

        // Инициализируем TabManager
        TabsManager.init(this.tabContainer);

        // Окрываем форму Main
        new Main({
            insertInto: this.tpl?.querySelector(":scope >.content >.left")
        });

        // Выполняем routes
        initRoutes();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        Home.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form home flex flex-col w-full h-full ${CDM_FORM_CLASSES()}">
                <div class="content w-full h-full flex flex-row gap-1 p-1.5
                            max-lg:block max-lg:relative max-lg:h-dvh max-lg:w-full max-lg:overflow-hidden">
                    
                    <!-- Левый блок (сайдбар) -->
                    <div class="left relative w-sm min-w-sm max-w-sm h-full 
                                rounded-lg border border-[var(--border-color)]
                                max-lg:absolute max-lg:top-0 max-lg:left-0 
                                max-lg:w-full max-lg:min-w-full max-lg:h-full 
                                max-lg:z-1 max-lg:border-0
                                max-lg:translate-x-0 overflow-hidden">
                    </div>
                    
                    <!-- Средний блок (основной контент) -->
                    <div class="middle flex flex-col w-full gap-1 overflow-hidden
                                max-lg:absolute max-lg:top-0 max-lg:left-0 
                                max-lg:w-full max-lg:h-full max-lg:z-0">
                        
                        <div class="tab-container flex p-0 gap-0 relative 
                                    h-[var(--form-header-min-height)] 
                                    min-h-[var(--form-header-min-height)] 
                                    max-lg:hidden border 
                                    border-[var(--border-color)] rounded-lg">
                            <div data-list class="flex flex-row h-full items-center gap-1 px-2"></div>
                        </div>
                        
                        <div class="form-container flex relative w-full h-full border border-[var(--border-color)] rounded-lg overflow-hidden"></div>
                    </div>
                </div>
                <div data-audio-player-mini-wrap class="relative flex empty:hidden"></div>
            </div>

        `, "text/html").querySelector(".cdm-form");

    }

}
