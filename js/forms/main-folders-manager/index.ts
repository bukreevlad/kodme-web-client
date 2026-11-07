// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем functions
import { getFolders } from "./functions/get_folders.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { onFoldersScrollHandler } from "./handlers/on_folders_scroll.js";

// Импортируем forms
import { MainFolderCreate } from "../main-folder-create/index.js";

// Импортируем типы
import type { MainFoldersManagerChoice, MainFoldersManagerFolder } from "./types.js";

/**
 * Настройки формы менеджера папок.
 */
export interface MainFoldersManagerOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы менеджера папок.
 */
export interface MainFoldersManagerData {

    /** Настройки формы. */
    options?: MainFoldersManagerOptions;

    /** Функция для возврата данных выбранного элемента (режим выбора папки). */
    callback?: (folder: MainFoldersManagerChoice) => void;

    /** Папки которые выбраны в вызвавшей форме. */
    selectedFolders?: string[];

}

// Form
export class MainFoldersManager {

    // Переменная для хранения единственного экземпляра формы
    static instance: MainFoldersManager | null = null;

    // Настройки формы
    options: MainFoldersManagerOptions;

    // Переменные формы
    callback: ((folder: MainFoldersManagerChoice) => void) | null;
    selectedFolders: string[];

    // Каркас: шаблон, модалка, элементы и instance скролла/менеджера якоря
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    list: HTMLElement | null;
    hero: HTMLElement | null;
    empty: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null; // overlayScroll instance
    listScrollManager: ScrollManager | null; // менеджер якоря скролла
    _offScrollFolders: (() => void) | null; // отписка от скролла списка

    // Состояние пагинации списка (см. functions/get_folders.ts)
    isFirstLoaded: boolean; // первая страница загружена
    isLoadingFirst: boolean; // первая страница грузится
    isLoadingPrev: boolean; // грузится пачка старых (вверх)
    isLoadingNext: boolean; // грузится пачка новых (вниз)
    hasMorePrev: boolean; // есть ли старые папки выше списка
    hasMoreNext: boolean; // есть ли новые папки ниже списка
    lastErrorToastAt: number; // время последнего тоста ошибки (троттлинг)

    // Хранилище списка папок
    store: Store<MainFoldersManagerFolder>;

    /**
     * ***************************************************************************
     * Форма менеджера папок пользователя.
     * @param data - Данные.
     * @param data.options - Настройки формы.
     * @param data.callback - Функция для возврата данных выбранного элемента.
     * @param data.selectedFolders - Папки которые выбраны.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data?: MainFoldersManagerData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        }

        // Переменные формы
        this.callback = data?.callback || null;
        this.selectedFolders = data?.selectedFolders || [];

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.hero = null;
        this.empty = null;
        this.osListScrollInstance = null; // overlayScroll instance
        this.listScrollManager = null; // менеджер якоря скролла
        this._offScrollFolders = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_folders.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые папки выше списка
        this.hasMoreNext = true; // есть ли новые папки ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Хранилище списка папок
        this.store = new Store<MainFoldersManagerFolder>();

        // Проверяем, существует ли уже экземпляр
        if (MainFoldersManager.instance) {
            return MainFoldersManager.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        MainFoldersManager.instance = this;

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?main-folders-manager`,
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

            // Создать папку (из шапки и пустого состояния)
            let create = this.tpl.querySelectorAll("[action-create-folder]");
            create?.forEach((button) => button?.addEventListener("click", () => new MainFolderCreate()));

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollFolders = onFoldersScrollHandler(this, this.osListScrollInstance);

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
            this.list = this.tpl.querySelector(":scope >.content [data-list]");
            this.hero = this.tpl.querySelector(":scope >.content [data-hero]");
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Менеджер якоря скролла: вставка пачки в начало списка
            // сдвигала бы видимую часть вниз (см. functions/get_folders.ts)
            if (this.osListScrollInstance) {
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Получаем папки (пустое состояние в конце загрузки обновляет
            // сам загрузчик через updateEmptyState)
            await getFolders(this);

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

        // Снимаем подписку на скролл (внутри — отписка и cancel троттлинга)
        this._offScrollFolders?.();
        this._offScrollFolders = null;

        // Удаляем экземпляр формы
        MainFoldersManager.instance = null;

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Переключаем пустое состояние (hero / список / empty)
    // ***************************************************************************
    updateEmptyState(): void {

        // До первой загрузки не гадаем: показывать «папок нет» рано, а сбой
        // первого запроса ≠ пустой список
        if (!this.isFirstLoaded) return;

        // Если папок нет — показываем пустое состояние, иначе hero и список
        let hasFolders = this.store?.size > 0;

        // Прячем пустое состояние, если есть папки
        this.empty?.classList.toggle("hidden", hasFolders);

        // Прячем hero, если папок нет
        this.hero?.classList.toggle("hidden", !hasFolders);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form main-folders-manager flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
                        intent: "transparent",
                        shape: "circle",
                        attributes: ["action-close"],
                        icon: "ArrowLeft"
                    })}
                    <span class="font-semibold text-base truncate">${window._lc.forms.main_folders_manager.title}</span>
                    ${Buttons.create({
                        intent: "standard",
                        shape: "circle",
                        attributes: ["action-create-folder"],
                        icon: "Plus"
                    })}
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <!-- Шапка с описанием формы -->
                        <div data-hero class="flex flex-col gap-3 p-5 items-center text-center rounded-lg bg-[var(--second-bg)]">
                            <div data-hero-icon class="flex items-center justify-center w-14 h-14 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                ${Icons.icon("Folder", { settings: { filled: true, size: 28, stroke: 1 } })?.outerHTML ?? ""}
                            </div>
                            <span class="text-sm text-muted max-w-[22rem]">${window._lc.forms.main_folders_manager.subtitle}</span>
                        </div>

                        <!-- Список папок -->
                        <div data-list class="flex flex-col gap-1 p-2 rounded-lg bg-[var(--second-bg)] empty:hidden"></div>

                        <!-- Пустое состояние -->
                        ${EmptyState.create({
                            title: window._lc.forms.main_folders_manager.empty_title,
                            description: window._lc.forms.main_folders_manager.empty_desc,
                            icon: "folder-open",
                            compact: true,
                            attributes: ["data-empty"],
                            // Без фона и скруглений: в центрированной колонке
                            // плашка — просто компактный текст по центру
                            classes: ["hidden"],
                            action: {
                                text: window._lc.forms.main_folders_manager.create_folder,
                                icon: "plus",
                                attributes: ["action-create-folder"]
                            }
                        })}

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}