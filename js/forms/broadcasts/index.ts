// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем functions
import { getCasts } from "./functions/get_casts.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { menuHandler } from "./handlers/menu.js";
import { createCastHandler } from "./handlers/create_cast.js";
import { onCastsScrollHandler } from "./handlers/on_casts_scroll.js";

// Импортируем типы
import type { BroadcastCast } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы трансляций.
 */
export interface BroadcastsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface BroadcastsData {

    /** Callback: вместо открытия воспроизведения вызывается с записью списка. */
    callback?: ((data: BroadcastCast) => void) | null;

    /** Настройки формы. */
    options?: BroadcastsOptions;

}

// Form
export class Broadcasts {

    // Переменная для хранения единственного экземпляра формы
    static instance: Broadcasts | null = null;

    /**
     * ***************************************************************************
     * Форма «Трансляции».
     * @param data - Данные.
     * @param data.callback - Callback.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data?: BroadcastsData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container"),
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.empty = null; // блок пустого состояния
        this.osListScrollInstance = null; // overlayScroll instance
        this.listScrollManager = null; // менеджер якоря скролла
        this._offScrollCasts = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_casts.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вниз)
        this.isLoadingNext = false; // грузится пачка новых (вверх)
        this.hasMorePrev = true; // есть ли старые записи ниже списка
        this.hasMoreNext = true; // есть ли новые записи выше списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Переменные формы
        this.callback = data?.callback || null;

        // Хранилище списка трансляций
        this.store = new Store<BroadcastCast>();

        // Проверяем, существует ли уже экземпляр
        if (Broadcasts.instance) {
            return Broadcasts.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Broadcasts.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: BroadcastsOptions;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;
    content: HTMLElement | null = null;

    // Элементы списка и пустого состояния
    list: HTMLElement | null = null;
    empty: HTMLElement | null = null;

    // Скролл-инстанс и менеджер якоря
    osListScrollInstance: OverlayScrollbars | null = null;
    listScrollManager: ScrollManager | null = null;

    // Отписка от скролла списка
    _offScrollCasts: (() => void) | null = null;

    // Состояние пагинации списка
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Callback: вместо открытия воспроизведения вызывается с записью списка
    callback: ((data: BroadcastCast) => void) | null;

    // Хранилище списка трансляций
    store: Store<BroadcastCast>;

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
                url: `?broadcasts`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
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

            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Контекстное меню
            let menu = this.tpl.querySelector(":scope >.header [action-menu]");
            menu?.addEventListener("click", (event) => menuHandler(event, this));

            // Кнопка «Создать трансляцию» в пустом состоянии
            let create = this.tpl.querySelector(":scope >.content [action-create-cast]");
            create?.addEventListener("click", () => createCastHandler(this));

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollCasts = onCastsScrollHandler(this, this.osListScrollInstance);

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

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Менеджер якоря скролла: вставка пачки в начало списка
            // сдвигала бы видимую часть вниз (см. functions/get_casts.ts)
            if (this.osListScrollInstance) {
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Сообщаем системе, что форма открыта
            window.dispatchEvent(new CustomEvent("[app][form]::opened", {
                detail: {
                    id: this.modal?.options.id,
                    data: {
                        instance: this,
                        title: t("forms.broadcasts.title")
                    }
                }
            }));

            // Получаем трансляции
            await getCasts(this);

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
        this._offScrollCasts?.();
        this._offScrollCasts = null;

        // Очищаем хранилище
        this.store?.removeAll();

        // Удаляем экземпляр формы
        Broadcasts.instance = null;

        // Сообщаем системе, что форма закрыта
        window.dispatchEvent(new CustomEvent("[app][form]::closed", {
            detail: { id: this.modal?.options.id }
        }));

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form broadcasts flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.broadcasts.title")}</span>
                    </div>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: "dots-vertical" })}
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 w-full"></div>

                    ${EmptyState.create({
                        title: t("forms.broadcasts.empty.title"),
                        description: t("forms.broadcasts.empty.desc"),
                        icon: "video",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"],
                        action: {
                            text: t("forms.broadcasts.empty.create"),
                            icon: "plus",
                            attributes: ["action-create-cast"]
                        }
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
