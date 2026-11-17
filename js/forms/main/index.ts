// Импортируем сторонние пакеты
import { FormsRegistry } from "../../core/managers/forms_registry.js";
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES } from "../../config/constants.js";
import { Socket } from "../../config/socket.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { t } from "../../utils/i18n/index.js";
import { Store } from "../../utils/store.js";
import { GestureController } from "../../utils/gesture_controller.js";
import { AppStatus } from "../../utils/app_status.js";

// Импортируем forms
import { Search } from "../search/index.js";
import { MainFolderCreate } from "../main-folder-create/index.js";

// Импортируем functions
import { getConversations } from "./functions/get_conversations.js";
import { getChannels } from "./functions/get_channels.js";
import { getUpdates } from "./functions/get_updates.js";
import { getUserUpdates } from "./functions/get_user_updates.js";
import { showMainFolders } from "./functions/show_main_folders.js";
import { updateFolderUnread } from "./functions/update_folder_unread.js";
import { getSessionOrganisationName } from "./functions/session_identity.js";

// Импортируем db
import { channelsTable } from "./db.js";

// Импортируем handlers
import { menuHandler } from "./handlers/menu.js";

// Импортируем events
import { SocketEvents } from "./events/socket/socket_events.js";
import { StoreEvents } from "./events/store/store_events.js";
import { SecretChatEvents } from "./events/manager/secret_chat_events.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Tabs } from "../../components/tabs.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем типы
import type { ChannelRecord } from "./types.js";

/**
 * Настройки конструктора главной формы.
 */
interface MainOptions {

    /** Куда вставить форму (по умолчанию — левая колонка главной формы). */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * ***************************************************************************
 * MAIN - главная форма: список папок и каналов пользователя.
 *
 * Синглтон: единственный экземпляр живёт в реестре открытых форм, повторный
 * конструктор возвращает его же. Данные списка живут в Store<ChannelRecord>,
 * локальная копия каналов — в IndexedDB (см. db.ts).
 * ***************************************************************************
 */
export class Main {


    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options: MainOptions = {}) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Хранилище списка каналов
        this.store = new Store<ChannelRecord>();

        // Проверяем, существует ли уже экземпляр
        const opened = FormsRegistry.getOwner<Main>("main");
        if (opened) return opened;

        // Сохраняем ссылку на текущий экземпляр

        // Инициализация
        this._init();

    }

    /** Настройки формы. */
    options: MainOptions;

    /** Шаблон формы (DOM-узел шаблона). */
    tpl: HTMLDivElement | null = null;

    /** Оверлей формы. */
    modal: Overlay | null = null;

    /** Инстанс overlay-scrollbars списка каналов. */
    osListScrollInstance: ReturnType<typeof OverlayScrollbars> | null = null;

    /** Хранилище списка каналов. */
    store: Store<ChannelRecord>;

    /** Скроллируемая область со списками папок. */
    content: HTMLElement | null = null;

    /** Лента вкладок папок в шапке формы. */
    foldersHorizontal: HTMLElement | null = null;

    /** Панели папок (контент вкладок). */
    foldersHorizontalPanes: HTMLElement | null = null;

    /** Вкладки папок (менеджер ленты и панелей). */
    foldersTabs: Tabs | null = null;

    /** Название организации в шапке формы. */
    appName: HTMLElement | null = null;

    /** Статус соединения/обновления в шапке формы. */
    appStatus: AppStatus | null = null;

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        StoreEvents.init(this);

        // Подписываемся на события Socket.
        SocketEvents.init();

        // Подписываемся на события менеджера секретных чатов.
        SecretChatEvents.init(this);

        // Подписываемся на событие connected
        Socket.client.on("connected", () => {

            // Запрашиваем полное обновление
            this._getUpdates();

        });

        // Подписываемся на событие disconnected
        Socket.client.on("disconnected", () => {

            // Закрытие с кодом 1008 (протухший токен, сессия удалена) сокет
            // эмитит отдельное событие "auth-expired" — там токен обновляется
            // и соединение восстанавливается; перезагрузка остаётся только
            // fallback'ом, если обновить токен не удалось (см. auth/expired.ts)

            // Устанавливаем статус
            this.appStatus?.setStatus({ text: t("forms.main.connecting") });

        });

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
                owner: this,
                id: "main",
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,

                // Опции читаются как falsy: свайп и анимации выключены —
                // в типе оверлея выключению соответствует null
                closeOnSwipe: null,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
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

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Меню
            const menu = this.tpl.querySelector<HTMLElement>(":scope .header [action-menu]");
            menu?.addEventListener("click", () => menuHandler());

            // Поиск
            const search = this.tpl.querySelector<HTMLElement>(":scope .header [action-search]");
            search?.addEventListener("click", () => new Search());

            // Создать папку (из шапки и панелей папок)
            const createFolder = this.tpl.querySelectorAll<HTMLElement>("[action-create-folder]");
            createFolder?.forEach((button) => button?.addEventListener("click", () => new MainFolderCreate()));

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
            this.content = this.tpl.querySelector<HTMLElement>(":scope .content");

            // Устанавливаем элементы для папок (папки только горизонтальные)
            this.foldersHorizontal = this.tpl.querySelector<HTMLElement>(":scope [data-folders-horizontal] >[data-list]");
            this.foldersHorizontalPanes = this.tpl.querySelector<HTMLElement>(":scope .content >.cdm-tabs-content");

            // Лента и панели папок обязаны быть в шаблоне — иначе вкладки не собрать
            if (!this.foldersHorizontal || !this.foldersHorizontalPanes) return;

            // Записываем tab контейнер
            this.foldersTabs = new Tabs([
                { tabs: this.foldersHorizontal, scrollType: "horizontal" }
            ],
                this.foldersHorizontalPanes,
                { isSlider: true }
            );

            // Запускаем обработчик свайпов
            this._gestureController();

            // Название (данные сессии читаем через guard: поле server
            // в типе сессии не описано, а неполная сессия не должна ронять форму)
            const organisationName = getSessionOrganisationName();

            // Название
            const appName = this.tpl.querySelector<HTMLElement>(":scope .header [data-app-name]");
            if (!appName) return;
            this.appName = appName;
            this.appName.textContent = organisationName;

            // Записываем статус
            this.appStatus = new AppStatus(this.appName, organisationName);

            // Заголовок браузера
            document.title = organisationName;

            // Отображаем папки пользователя
            showMainFolders(this);

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Получаем каналы с IndexedDB
            await getChannels(this);

            // Обновляем бейджи непрочитанных на вкладках папок
            updateFolderUnread(this);

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

        // Вызываем полное обновление
        this._getUpdates();

    }

    // ***************************************************************************
    // Синхронизация списка каналов и пропущенных событий
    //
    // Список бесед получаем только при холодном старте (локальная БД пуста):
    // дальше он живёт событиями ленты, а обычный старт и переподключение
    // обслуживаются догонкой по pts.
    // ***************************************************************************
    async _getUpdates(): Promise<void> {

        // Устанавливаем статус
        this.appStatus?.setStatus({ text: t("forms.main.updating") });

        // Холодный старт: локальной истории каналов нет — получаем полный список
        const localChannelsCount = await channelsTable().count();
        if (localChannelsCount === 0) await getConversations(this);

        // Личная лента: появление/исчезновение каналов (сначала она — новые
        // каналы должны появиться в хранилище раньше канальной догонки)
        await getUserUpdates(this);

        // Получаем пропущенные события для каналов
        await getUpdates(this);

        // Обновляем бейджи непрочитанных на вкладках папок
        updateFolderUnread(this);

        // Устанавливаем статус
        this.appStatus?.clearStatus();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Очищаем хранилище
        this.store?.removeAll();


    }

    // ***************************************************************************
    // gestureController
    // ***************************************************************************
    _gestureController(): void {

        // Без шаблона не на что вешать жесты
        if (!this.tpl) return;

        // Лента папок — в игнор жестов, только если она есть в шаблоне
        const ignore = this.foldersHorizontal ? [this.foldersHorizontal] : [];

        // Контроллер: свайп вправо за пределы порога открывает меню
        new GestureController(this.tpl, {
            ignore,
            swipe: {
                commitDistance: 60,
                directions: ["right"],
                onCommit: () => {
                    menuHandler();
                }
            }
        });

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLDivElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form main flex flex-row gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="flex flex-col gap-0 w-full h-full overflow-hidden">
                    <div class="header flex flex-col gap-1 p-2 justify-center w-full ${CDM_FORM_HEADER_CLASSES()}">
                        <div class="flex flex-row gap-2 items-center w-full">
                            <div class="flex flex-row gap-2 items-center w-full">
                                ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: "menu-2" })}
                                <div class="flex flex-col gap-0">
                                    <span data-app-name class="font-semibold text-xl"></span>
                                </div>
                            </div>
                            <div class="flex flex-row gap-2 items-center">
                                ${Buttons.transparent({ shape: "circle", attributes: ["action-search"], icon: "Search" })}
                            </div>
                        </div>
                    </div>

                    <div data-main-folders-tabs-wrap class="flex w-full pt-[var(--form-header-height)]">
                        <div data-folders-horizontal class="p-1 w-full relative flex flex-row items-center gap-1 overflow-hidden">
                            <div data-list class="cdm-tabs flex flex-row gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none"></div>
                            ${Buttons.transparent({ size: "sm", shape: "circle", attributes: ["action-create-folder"], icon: "plus", classes: ["flex-shrink-0"] })}
                        </div>
                    </div>

                    <div class="content flex flex-row gap-0 w-full flex-1 min-h-0 overflow-hidden pb-[var(--form-footer-height)]">
                        <div class="cdm-tabs-content flex flex-row gap-0 w-full overflow-hidden"></div>
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLDivElement>(".cdm-form");

    }

}
