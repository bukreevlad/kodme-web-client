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
import { getContacts } from "./functions/get_contacts.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { onContactsScrollHandler } from "./handlers/on_contacts_scroll.js";

// Импортируем типы
import type { ContactRecord } from "./types.js";

/**
 * Настройки формы контактов.
 */
export interface ContactsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class Contacts {

    // Переменная для хранения единственного экземпляра формы
    static instance: Contacts | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: ContactsOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.empty = null; // блок пустого состояния
        this.osListScrollInstance = null; // overlayScroll instance
        this.listScrollManager = null; // менеджер якоря скролла
        this._offScrollContacts = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_contacts.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые записи выше списка
        this.hasMoreNext = true; // есть ли новые записи ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Хранилище списка контактов
        this.store = new Store<ContactRecord>();

        // Проверяем, существует ли уже экземпляр
        if (Contacts.instance) {
            return Contacts.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Contacts.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: ContactsOptions;

    // Каркас: шаблон, модалка, элементы
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;
    content: HTMLElement | null = null;
    list: HTMLElement | null = null;
    empty: HTMLElement | null = null;

    // Скроллбар списка и менеджер якоря
    osListScrollInstance: OverlayScrollbars | null = null;
    listScrollManager: ScrollManager | null = null;

    // Отписка от скролла списка
    _offScrollContacts: (() => void) | null = null;

    // Состояние пагинации списка
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Хранилище списка контактов
    store: Store<ContactRecord>;

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
                type: "form",
                url: `?contacts`,
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

            // Закрыть
            const close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollContacts = onContactsScrollHandler(this, this.osListScrollInstance);
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
            this.content = this.tpl?.querySelector<HTMLElement>(":scope >.content") ?? null;
            this.list = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-list]") ?? null;

            // Инициализируем скролл
            // invariant: onBeforeOpen вызывается после _template — контейнер
            // контента собран из наших строк
            this.osListScrollInstance = OverlayScrollbars(this.content!, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
            });

            // Менеджер якоря скролла: вставка пачки в начало списка
            // сдвигала бы видимую часть вниз (см. functions/get_contacts.ts)
            this.listScrollManager = new ScrollManager(this.osListScrollInstance);

            // Блок пустого состояния списка
            this.empty = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-empty]") ?? null;

            // Получаем контакты
            await getContacts(this);

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
        this._offScrollContacts?.();
        this._offScrollContacts = null;

        // Очищаем хранилище
        this.store?.removeAll();

        // Удаляем экземпляр формы
        Contacts.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form contacts flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${window._lc.forms.contacts.title}</span>
                    </div>
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-0 p-2 w-full"></div>

                    ${EmptyState.create({
                        title: window._lc.forms.contacts.empty.title,
                        description: window._lc.forms.contacts.empty.desc,
                        icon: "users",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
