// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Tabs } from "../../components/tabs.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { backHandler } from "./handlers/back.js";
import { openShareLinkHandler } from "./handlers/open_share_link.js";
import { onScrollHandler } from "./handlers/on_scroll.js";

// Импортируем components
import { createCloudFolderItem } from "./components/folder_item.js";
import { createCloudFileItem } from "./components/file_item.js";
import { createCloudAvailableItem } from "./components/available_item.js";

// Импортируем functions
import { getFolder } from "./functions/get_folder.js";
import { getAvailableLinks } from "./functions/get_available_links.js";
import { uploadFiles } from "./functions/upload_files.js";

// Импортируем dialogs
import { CreateFolder } from "../cloud-folder-create/index.js";

// Импортируем типы
import type { Tabs as TabsType } from "../../components/tabs.js";
import type {
    CloudAccessLevel,
    CloudAvailableLink,
    CloudFolderEntry,
    CloudItem,
    CloudItemMode,
    CloudMode,
    CloudSharedLink,
    CloudView
} from "./types.js";
import type { ShareLinks } from "./dialogs/share_links/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы облака.
 */
export interface CloudOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

    /** Токен ссылки общего доступа (форма открыта по ссылке). */
    link?: string;

}

/**
 * Данные конструктора формы.
 */
export interface CloudData {

    /** Настройки формы. */
    options?: CloudOptions;

}

/**
 * Хлебная крошка шапки: корень (id: null) либо папка из стека.
 */
interface HeaderCrumb {

    /** Id папки (null — корень). */
    id: string | null;

    /** Название крошки. */
    name?: string | null | undefined;

}

/**
 * Данные вкладки для шаблона.
 */
interface CloudTabData {

    /** Идентификатор вкладки. */
    id: string;

    /** Название вкладки. */
    name: string;

}

// Form
export class Cloud {

    // Переменная для хранения единственного экземпляра формы
    static instance: Cloud | null = null;

    /**
     * ***************************************************************************
     * Форма «Облако».
     * @param data - Данные.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data?: CloudData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;

        // Элементы списков и пустых состояний
        this.listMine = null;
        this.listAvailable = null;
        this.listShared = null;
        this.emptyMine = null;
        this.emptyAvailable = null;
        this.emptyShared = null;
        this.fileInput = null;

        // Скролл-инстансы
        this.osMineScrollInstance = null;
        this.osSharedScrollInstance = null;

        // Отписки от скролла (снимаются в _onBeforeClose до destroy)
        this.scrollUnsubs = [];

        // Форма закрыта — фоновые проверки скролла не трогают DOM
        this.isClosed = false;

        // Вкладки
        this.tabs = null;
        this.tabsArea = null;

        // Хранилища: своё облако, доступные ссылки, общий доступ
        this.store = new Store<CloudItem>();
        this.availableStore = new Store<CloudAvailableLink>();
        this.sharedStore = new Store<CloudItem>();

        // ---------- Состояние навигации «Моё облако» ----------
        this.mode = "mine"; // mine | available | shared
        this.folderStack = []; // стек открытых папок
        this.currentFolderId = null; // текущая папка (null — корень)
        this.hasMore = false;
        this.cursorId = null;
        this.accessLevel = "owner";
        this.ownerUserId = null;

        // ---------- Оформление списка ----------
        this.view = "list"; // list | grid (тип просмотра)

        // Токен ссылки общего доступа (если форма открыта по ссылке из сообщения)
        this.shareLinkToken = data?.options?.link || null;

        // ---------- Состояние навигации «Общий доступ» ----------
        this.sharedLink = null; // данные открытой ссылки
        this.sharedPath = []; // стек папок внутри общего поддерева
        this.sharedFolderId = null; // текущая папка (null — корень ссылки)
        this.sharedHasMore = false;
        this.sharedCursorId = null;
        this.sharedAccessLevel = "read";
        this.sharedOwnerUserId = null;

        // ---------- Пагинация ----------
        this.offset = 50;
        this.isLoadingMore = false; // in-flight «Моё облако»
        this.sharedIsLoadingMore = false; // in-flight «Общий доступ»

        // Флаги первой страницы: скролл-пагинация и показ пустых состояний
        // работают только после успешного ответа (сбрасываются в начале
        // навигации, см. functions/get_folder.ts)
        this.isFirstLoaded = false;
        this.sharedIsFirstLoaded = false;
        this.availableIsFirstLoaded = false;

        // Ссылка на открытый диалог ссылок (для обновления при отзыве)
        this.shareLinksDialog = null;

        // Частота тостов ошибок папок (throttle), ключ — режим
        this.folderErrorToasts = {};

        // Проверяем, существует ли уже экземпляр
        if (Cloud.instance) {
            return Cloud.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Cloud.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: CloudOptions;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;
    content: HTMLElement | null = null;

    // Элементы списков и пустых состояний
    listMine: HTMLElement | null = null;
    listAvailable: HTMLElement | null = null;
    listShared: HTMLElement | null = null;
    emptyMine: HTMLElement | null = null;
    emptyAvailable: HTMLElement | null = null;
    emptyShared: HTMLElement | null = null;
    fileInput: HTMLInputElement | null = null;

    // Скролл-инстансы
    osMineScrollInstance: OverlayScrollbars | null = null;
    osSharedScrollInstance: OverlayScrollbars | null = null;

    // Отписки от скролла (снимаются в _onBeforeClose до destroy)
    scrollUnsubs: Array<(() => void) | null> = [];

    // Форма закрыта — фоновые проверки скролла не трогают DOM
    isClosed = false;

    // Вкладки
    tabs: TabsType | null = null;
    tabsArea: HTMLElement | null = null;

    // Хранилища: своё облако, доступные ссылки, общий доступ
    store: Store<CloudItem>;
    availableStore: Store<CloudAvailableLink>;
    sharedStore: Store<CloudItem>;

    // ---------- Состояние навигации «Моё облако» ----------
    mode: CloudMode;
    folderStack: CloudFolderEntry[];
    currentFolderId: string | null;
    hasMore: boolean;
    cursorId: string | null;
    accessLevel: CloudAccessLevel;
    ownerUserId: string | null;

    // ---------- Оформление списка ----------
    view: CloudView;

    // Токен ссылки общего доступа (если форма открыта по ссылке из сообщения)
    shareLinkToken: string | null;

    // ---------- Состояние навигации «Общий доступ» ----------
    sharedLink: CloudSharedLink | null;
    sharedPath: CloudFolderEntry[];
    sharedFolderId: string | null;
    sharedHasMore: boolean;
    sharedCursorId: string | null;
    sharedAccessLevel: CloudAccessLevel;
    sharedOwnerUserId: string | null;

    // ---------- Пагинация ----------
    offset: number;
    isLoadingMore: boolean;
    sharedIsLoadingMore: boolean;

    // Флаги первой страницы: скролл-пагинация и показ пустых состояний
    // работают только после успешного ответа
    isFirstLoaded: boolean;
    sharedIsFirstLoaded: boolean;
    availableIsFirstLoaded: boolean;

    // Ссылка на открытый диалог ссылок (для обновления при отзыве)
    shareLinksDialog: ShareLinks | null;

    // Частота тостов ошибок папок (throttle), ключ — режим
    folderErrorToasts: Partial<Record<CloudMode, number>>;

    /**
     * ***************************************************************************
     * Открытие ссылки общего доступа: если форма облака уже открыта — активируем
     * её и открываем ссылку, иначе — создаём форму с параметром ссылки.
     * @param link - Значение ссылки (токен).
     * @returns Экземпляр формы облака.
     * ***************************************************************************
     */
    static async openShareLink(link: string): Promise<Cloud> {

        // Если форма уже открыта — активируем и открываем ссылку
        let form = Cloud.instance;
        if (form) {
            form.shareLinkToken = link;
            form.modal?.activate?.();
            await openShareLinkHandler(form, link);
            return form;
        }

        // Иначе — открываем форму с параметром ссылки
        return new Cloud({ options: { link } });

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?cloud`,
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

            // Назад
            let back = this.tpl.querySelector(":scope >.header [action-back]");
            back?.addEventListener("click", () => backHandler(this));

            // Кнопка «Доступное для меня» — тумблер между режимами
            let available = this.tpl.querySelector(":scope >.header [action-available]");
            available?.addEventListener("click", () => {
                this._setMode(this.mode === "available" ? "mine" : "available");
            });

            // Создать папку
            let createFolder = this.tpl.querySelector(":scope >.header [action-create-folder]");
            createFolder?.addEventListener("click", () => {
                if (this.mode === "available") this._setMode("mine");
                new CreateFolder({ form: this });
            });

            // Загрузить файл
            let upload = this.tpl.querySelector(":scope >.header [action-upload]");
            upload?.addEventListener("click", () => {
                if (this.mode === "available") this._setMode("mine");
                this.fileInput?.click();
            });

            // Переключение вида списка (список / плитка)
            let view = this.tpl.querySelector(":scope >.header [action-view]");
            view?.addEventListener("click", () => this._toggleView());

            // Выбор файлов (захватываем ссылку локально — внутри замыкания
            // свойство формы уже не сужается типом)
            const fileInput = this.fileInput;
            if (fileInput) {
                fileInput.addEventListener("change", () => {
                    const files = fileInput.files;
                    if (files && files.length > 0) {
                        uploadFiles(this, files);
                    }
                });
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы (устанавливаем элементы и вкладки)
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Все элементы ниже — узлы собственного шаблона
            if (!this.tpl) return;

            // Контейнер контента
            this.content = this.tpl.querySelector(":scope >.content");

            // Вкладки
            this.tabsArea = this.tpl.querySelector(":scope [data-tabs]");
            let links = this.tpl.querySelector<HTMLElement>(":scope [data-tabs-list]");
            let panes = this.tpl.querySelector<HTMLElement>(":scope .cdm-tabs-content");
            if (!links || !panes) return;

            // Создаем менеджер вкладок
            this.tabs = new Tabs([
                { tabs: links, scrollType: "horizontal" }
            ], panes, { isSlider: false });

            // ---------- Вкладка «Моё облако» ----------
            let minePane = this._templatePane("mine");
            this.tabs.addTab({
                id: "mine",
                links: this._templateTab({ id: "mine", name: t("forms.cloud.tabs.mine") }),
                pane: minePane,
                onActivation: () => {

                    // Клик по вкладке — переход в «Моё облако»
                    // (в т.ч. при нахождении в режиме общего доступа)
                    if (this.mode !== "mine") this._setMode("mine");

                }
            });

            // ---------- Вкладка «Доступное для меня» ----------
            this.tabs.addTab({
                id: "available",
                links: this._templateTab({ id: "available", name: t("forms.cloud.tabs.available") }),
                pane: this._templatePane("available"),
                onActivation: () => {

                    // Клик по вкладке — переход в «Доступное для меня»
                    // (в т.ч. при нахождении в режиме общего доступа);
                    // загрузка списка ссылок выполняется внутри _setMode
                    if (this.mode !== "available") this._setMode("available");

                }
            });

            // Устанавливаем элементы списков
            this.listMine = minePane.querySelector<HTMLElement>(":scope [data-list-mine]");
            this.emptyMine = minePane.querySelector<HTMLElement>(":scope [data-empty-mine]");

            let availablePane = panes.querySelector(":scope [data-target='available']");
            this.listAvailable = availablePane?.querySelector<HTMLElement>(":scope [data-list-available]") ?? null;
            this.emptyAvailable = availablePane?.querySelector<HTMLElement>(":scope [data-empty-available]") ?? null;

            this.listShared = this.tpl.querySelector<HTMLElement>(":scope [data-list-shared]");
            this.emptyShared = this.tpl.querySelector<HTMLElement>(":scope [data-empty-shared]");

            // Скрытый input для выбора файлов
            this.fileInput = this.tpl.querySelector<HTMLInputElement>(":scope [data-file-input]");

            // ---------- Скролл «Моё облако» с дозагрузкой ----------
            // Троттлинг + проверка края по последнему элементу —
            // handlers/on_scroll.ts (раньше — подписка на каждый тик
            // с проверкой низа viewport ±120 px)
            this.osMineScrollInstance = OverlayScrollbars(minePane, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
            });

            this.scrollUnsubs.push(onScrollHandler(this, false, this.osMineScrollInstance));

            // ---------- Скролл «Общий доступ» с дозагрузкой ----------
            let scrollShared = this.tpl.querySelector<HTMLElement>(":scope [data-scroll-shared]");
            if (scrollShared) {
                this.osSharedScrollInstance = OverlayScrollbars(scrollShared, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });

                this.scrollUnsubs.push(onScrollHandler(this, true, this.osSharedScrollInstance));
            }

            // Активируем вкладку «Моё облако»
            this.tabs.activateTab("mine");

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        try {

            // Устанавливаем обработчики
            this._handlers();

            // Обновляем заголовок и хлебные крошки
            this._renderHeader();

            // Загружаем содержимое корня облака
            await getFolder(this);

            // Обновляем пустые состояния
            this._updateEmptyStates();

            // Если форма открыта по ссылке общего доступа — открываем её
            if (this.shareLinkToken) {
                let link = this.shareLinkToken;
                this.shareLinkToken = null;
                await openShareLinkHandler(this, link);
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Форма закрыта: фоновые вызовы троттлинга не трогают удалённый DOM
        this.isClosed = true;

        // Отписываемся от скролла (снимает слушатель и гасит отложенный
        // вызов троттлинга) — до destroy инстансов
        this.scrollUnsubs?.forEach(off => off?.());
        this.scrollUnsubs = [];

        // Уничтожаем скролл-инстансы
        this.osMineScrollInstance?.destroy();
        this.osSharedScrollInstance?.destroy();

        // Уничтожаем вкладки
        this.tabs?.destroy();

        // Сбрасываем ссылку на диалог ссылок
        this.shareLinksDialog = null;

        // Удаляем экземпляр формы
        Cloud.instance = null;

    }

    // ***************************************************************************
    // Переключение режима формы: "mine" | "available" | "shared"
    // ***************************************************************************
    _setMode(mode: CloudMode): void {

        // Сохраняем режим
        this.mode = mode;

        // Контейнеры вьюх живут в шаблоне — без него переключать нечего
        if (!this.tpl) return;

        // Получаем контейнеры (вкладки вынесены из viewMain и не прячутся никогда)
        let viewMain = this.tpl.querySelector(":scope [data-view-main]");
        let viewShared = this.tpl.querySelector(":scope [data-view-shared]");

        // Если общий доступ — скрываем содержимое вкладок, показываем просмотр ссылки
        if (mode === "shared") {
            viewMain?.classList.add("hidden");
            viewShared?.classList.remove("hidden");
        } else {
            viewShared?.classList.add("hidden");
            viewMain?.classList.remove("hidden");

            // Активируем нужную вкладку
            // (onActivation лишь сверяет режим и не вызывает _setMode повторно)
            this.tabs?.activateTab(mode === "available" ? "available" : "mine");

            // При входе в «Доступное для меня» — загружаем список ссылок
            if (mode === "available" && this.availableStore.size === 0) {
                getAvailableLinks(this);
            }
        }

        // Обновляем заголовок и пустые состояния
        this._renderHeader();
        this._updateEmptyStates();

    }

    // ***************************************************************************
    // Обновление заголовка и хлебных крошек в зависимости от режима
    // ***************************************************************************
    _renderHeader(): void {

        try {

            // Шапка целиком состоит из узлов шаблона
            if (!this.tpl) return;

            // Элементы шапки
            let title = this.tpl.querySelector<HTMLElement>(":scope >.header [data-title]");
            let crumbsWrap = this.tpl.querySelector<HTMLElement>(":scope >.header [data-crumbs]");
            let createAction = this.tpl.querySelector(":scope >.header [action-create-folder]");
            let uploadAction = this.tpl.querySelector(":scope >.header [action-upload]");
            let availableAction = this.tpl.querySelector(":scope >.header [action-available]");
            if (!title || !crumbsWrap) return;

            // Сбрасываем крошки
            crumbsWrap.innerHTML = "";

            // ---------- «Моё облако» и «Доступное для меня» ----------
            // Шапка в «Доступном для меня» не переписывается: заголовок, крошки
            // и действия остаются от «Моего облака» — текущий режим показывает
            // вкладка, а действия (загрузка, создание папки) работают с облаком
            if (this.mode === "mine" || this.mode === "available") {

                // Заголовок: текущая папка или корень
                let current = this.folderStack[this.folderStack.length - 1];
                title.textContent = current?.name || t("forms.cloud.root");

                // Строим цепочку крошек: корень → папки
                let crumbs: HeaderCrumb[] = [{ id: null, name: t("forms.cloud.root") }];
                this.folderStack.forEach(folder => crumbs.push({ id: folder.id, name: folder.name }));
                crumbs.forEach((crumb, index) => {
                    let crumbEl = _createCrumb(crumb.name, index < crumbs.length - 1);
                    crumbEl.addEventListener("click", () => this._navigateToCrumb(index));
                    crumbsWrap.appendChild(crumbEl);
                });

                // Показываем действия
                createAction?.classList.remove("hidden");
                uploadAction?.classList.remove("hidden");
                availableAction?.classList.remove("hidden");

                return;

            }

            // ---------- «Общий доступ» ----------
            if (this.mode === "shared") {

                // Заголовок: имя элемента ссылки или автор
                let owner = this.sharedLink?.owner;
                let ownerName = owner ? `${owner.first_name || ""} ${owner.last_name || ""}`.trim() : "";
                title.textContent = this.sharedLink?.item?.name || ownerName || t("forms.cloud.shared.root");

                // Строим цепочку крошек: корень ссылки → подпапки
                let crumbs: HeaderCrumb[] = [{ id: null, name: this.sharedLink?.item?.name || t("forms.cloud.shared.root") }];
                this.sharedPath.forEach(folder => crumbs.push({ id: folder.id, name: folder.name }));
                crumbs.forEach((crumb, index) => {
                    let crumbEl = _createCrumb(crumb.name, index < crumbs.length - 1);
                    crumbEl.addEventListener("click", () => this._navigateToSharedCrumb(index));
                    crumbsWrap.appendChild(crumbEl);
                });

                // Определяем право записи по ссылке (write / owner)
                let accessLevel = this.sharedAccessLevel || this.sharedLink?.access_level;
                let canWrite = ["owner", "write"].includes(accessLevel);

                // Показываем действия (загрузка файлов, создание папок)
                // только при праве записи
                if (canWrite) {
                    uploadAction?.classList.remove("hidden");
                    createAction?.classList.remove("hidden");
                } else {
                    uploadAction?.classList.add("hidden");
                    createAction?.classList.add("hidden");
                }

                availableAction?.classList.add("hidden");

                return;

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Переход по хлебной крошке «Моё облако»
    // @param level - Уровень в цепочке (0 — корень).
    // ***************************************************************************
    async _navigateToCrumb(level: number): Promise<void> {

        try {

            // Из «Доступного для меня» клик по крошке возвращает в «Моё облако»
            if (this.mode === "available") this._setMode("mine");

            // Обрезаем стек папок до нужного уровня
            this.folderStack = this.folderStack.slice(0, level);

            // Определяем папку уровня (или корень)
            let prev = this.folderStack[this.folderStack.length - 1];
            this.currentFolderId = prev ? prev.id : null;

            // Загружаем содержимое
            await getFolder(this);

            // Обновляем интерфейс
            this._renderHeader();
            this._updateEmptyStates();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Переход по хлебной крошке «Общий доступ»
    // @param level - Уровень в цепочке (0 — корень ссылки).
    // ***************************************************************************
    async _navigateToSharedCrumb(level: number): Promise<void> {

        try {

            // Обрезаем стек папок до нужного уровня
            this.sharedPath = this.sharedPath.slice(0, level);

            // Определяем папку уровня (или корень ссылки)
            let prev = this.sharedPath[this.sharedPath.length - 1];
            this.sharedFolderId = prev ? prev.id : null;

            // Загружаем содержимое
            await getFolder(this, { shared: true });

            // Обновляем интерфейс
            this._renderHeader();
            this._updateEmptyStates();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Показ/скрытие пустых состояний по наполнению хранилищ.
    // Пустое состояние показывается только после успешной первой загрузки:
    // до ответа и при ошибке списка не видно — иначе падение запроса
    // выглядело бы как «папок/ссылок нет»
    // ***************************************************************************
    _updateEmptyStates(): void {

        this.emptyMine?.classList.toggle("hidden", !(this.isFirstLoaded && this.store.size === 0));
        this.emptyAvailable?.classList.toggle("hidden", !(this.availableIsFirstLoaded && this.availableStore.size === 0));
        this.emptyShared?.classList.toggle("hidden", !(this.sharedIsFirstLoaded && this.sharedStore.size === 0));

    }

    // ***************************************************************************
    // Переключение типа просмотра: список / плитка (как в проводнике)
    // ***************************************************************************
    _toggleView(): void {

        // Переключаем тип просмотра
        this.view = this.view === "list" ? "grid" : "list";

        // Обновляем иконку кнопки переключения
        let viewBtn = this.tpl?.querySelector<HTMLElement>(":scope >.header [action-view]");
        if (viewBtn) {
            let newIcon = Icons.icon(this.view === "grid" ? "layout-list" : "layout-grid");
            if (newIcon) {
                newIcon.setAttribute("data-button-icon", "");
                let oldIcon = viewBtn.querySelector("[data-button-icon]");
                if (oldIcon) {
                    oldIcon.replaceWith(newIcon);
                } else {
                    viewBtn.prepend(newIcon);
                }
            }
        }

        // Применяем классы сетки к контейнерам списков
        this._applyViewClasses();

        // Перерисовываем элементы из хранилищ
        this._renderItems();

    }

    // ***************************************************************************
    // Применение классов сетки/списка к контейнерам элементов
    // ***************************************************************************
    _applyViewClasses(): void {

        // Плитка или список
        let isGrid = this.view === "grid";

        // Контейнеры списков
        [this.listMine, this.listAvailable, this.listShared].forEach(list => {
            if (!list) return;

            // Режим списка
            list.classList.toggle("flex", !isGrid);
            list.classList.toggle("flex-col", !isGrid);
            list.classList.toggle("gap-1", !isGrid);

            // Режим плитки
            list.classList.toggle("grid", isGrid);
            list.classList.toggle("grid-cols-3", isGrid);
            list.classList.toggle("gap-2", isGrid);
        });

    }

    // ***************************************************************************
    // Перерисовка элементов списков из хранилищ (при смене вида)
    // ***************************************************************************
    _renderItems(): void {

        // Строим список папок и файлов
        let buildFolderFile = (container: HTMLElement | null, store: Store<CloudItem>, mode: CloudItemMode) => {
            if (!container) return;
            container.innerHTML = "";

            store.getAll().forEach(data => {
                let element = data.item_type === "folder"
                    ? createCloudFolderItem(this, data, store, mode)
                    : createCloudFileItem(this, data, store, mode);
                container.appendChild(element);
            });
        };

        // Строим список доступных ссылок (захватываем контейнер локально —
        // сужение свойства не переносится внутрь замыкания)
        const listAvailable = this.listAvailable;
        if (listAvailable) {
            listAvailable.innerHTML = "";
            this.availableStore.getAll().forEach(data => {
                listAvailable.appendChild(createCloudAvailableItem(this, data));
            });
        }

        // Перерисовываем «Моё облако» и «Общий доступ»
        buildFolderFile(this.listMine, this.store, "mine");
        buildFolderFile(this.listShared, this.sharedStore, "shared");

    }

    // ***************************************************************************
    // Шаблон вкладки
    // @param tab - Данные вкладки.
    // @returns Элемент вкладки.
    // ***************************************************************************
    _templateTab(tab: CloudTabData): HTMLElement {

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div data-target="${tab.id}" class="item flex flex-row flex-1 justify-center flex-shrink-0 gap-2 p-2 items-center rounded-lg transition-colors duration-150 cursor-pointer hover:text-[var(--text-color)] hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] [&.active]:text-[var(--text-color)] [&.active]:font-semibold [&.active]:bg-[var(--second-bg)]">
                <span class="flex flex-row gap-2 items-center font-semibold text-sm text-center whitespace-nowrap">${tab.name}</span>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    // ***************************************************************************
    // Шаблон панели вкладки
    // @param mode - Режим панели (своё облако либо доступные ссылки).
    // @returns Элемент панели.
    // ***************************************************************************
    _templatePane(mode: "mine" | "available"): HTMLElement {

        // Параметры панели
        let isMine = mode === "mine";
        let iconName = isMine ? "cloud" : "link";
        let emptyText = isMine ? t("forms.cloud.empty.mine") : t("forms.cloud.empty.available");

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div data-target="${mode}" class="item flex flex-col w-full h-full min-h-0">
                <div class="flex flex-col gap-1 p-3 pb-6" data-list-${mode}></div>
                <div data-empty-${mode} class="hidden flex flex-col gap-2 items-center text-center text-muted p-6">
                    ${Icons.icon(iconName, { settings: { size: 40 } })?.outerHTML ?? ""}
                    <span>${emptyText}</span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    // ***************************************************************************
    // Шаблон формы
    // @returns Каркас формы.
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form cloud flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full h-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-1 items-center min-w-0">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-back"], icon: "ArrowLeft" })}
                        <div class="flex flex-col gap-0 min-w-0">
                            <span data-title class="text-sm font-semibold truncate"></span>
                            <span data-crumbs class="cdm-crumbs flex flex-row text-xs text-muted overflow-x-auto scrollbar-none"></span>
                        </div>
                    </div>
                    <div class="flex flex-row gap-1 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-view"], icon: "layout-grid" })}
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-available"], icon: "link" })}
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-upload"], icon: "cloud-upload" })}
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-create-folder"], icon: "folder-plus" })}
                    </div>
                </div>
                <div class="content w-full h-full flex flex-col gap-0 ${CDM_FORM_CONTENT_CLASSES()}">

                    <!-- Вкладки «Моё облако» / «Доступное для меня» (видны во всех режимах) -->
                    <div class="flex flex-col p-3 pb-0">
                        <div data-tabs class="p-1 w-full relative bg-[var(--second-bg)] rounded-3xl overflow-hidden">
                            <div data-tabs-list class="cdm-tabs flex flex-row gap-1 w-full rounded-3xl overflow-x-auto scrollbar-none"></div>
                        </div>
                    </div>

                    <!-- Содержимое вкладок «Моё облако» / «Доступное для меня» -->
                    <div data-view-main class="flex flex-col gap-0 w-full flex-1 min-h-0">
                        <div class="cdm-tabs-content flex w-full p-0 flex-1 min-h-0"></div>
                    </div>

                    <!-- Просмотр общего доступа по ссылке -->
                    <div data-view-shared class="hidden flex flex-col gap-0 w-full flex-1 min-h-0">
                        <div class="flex-1 min-h-0">
                            <div data-scroll-shared class="h-full">
                                <div class="flex flex-col gap-1 p-3 pb-6" data-list-shared></div>
                                <div data-empty-shared class="hidden flex flex-col gap-2 items-center text-center text-muted p-6">
                                    ${Icons.icon("cloud", { settings: { size: 40 } })?.outerHTML ?? ""}
                                    <span>${t("forms.cloud.empty.shared")}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Скрытый input для выбора файлов -->
                    <input type="file" data-file-input multiple class="hidden" />

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}

/**
 * ***************************************************************************
 * Создание элемента хлебной крошки.
 * @param name - Название крошки (отсутствие нормализуется в пустую строку,
 *   чтобы в подписи не «утекало» undefined/null).
 * @param withSlash - Добавлять разделитель в конец (по умолчанию true).
 * @returns Кнопка крошки.
 * ***************************************************************************
 */
function _createCrumb(name: string | null | undefined, withSlash = true): HTMLElement {

    // Кнопка крошки: вид задаёт `.cdm-crumbs .crumb` (css/components/controls.css)
    let crumb = document.createElement("button");
    crumb.type = "button";
    crumb.className = "crumb";
    crumb.textContent = (name ?? "") + (withSlash ? " /" : "");

    // Последняя крошка — текущее положение, объявляем его скринридеру
    if (!withSlash) {
        crumb.setAttribute("aria-current", "page");
    }

    return crumb;

}
