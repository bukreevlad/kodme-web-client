// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";

// Импортируем functions
import { getStickerPaks } from "./functions/get_paks.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { createPakHandler } from "./handlers/create_pak.js";
import { onPaksScrollHandler } from "./handlers/on_paks_scroll.js";

// Импортируем типы
import { StickerPakItem } from "./types.js";

/**
 * Настройки формы паков стикеров.
 */
export interface StickerPaksOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class StickerPaks {

    // Переменная для хранения единственного экземпляра формы
    static instance: StickerPaks | null = null;

    /** Настройки формы. */
    options: StickerPaksOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Список паков. */
    list: HTMLElement | null = null;

    /** Блок пустого состояния списка. */
    empty: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Отписка от скролла списка. */
    _offScrollPaks: (() => void) | null = null;

    // Состояние пагинации списка (см. functions/get_paks.ts)
    isFirstLoaded = false; // первая страница загружена
    isLoading = false; // страница грузится
    hasMore = true; // есть ли продолжение после текущей страницы
    offset = 0; // смещение следующей страницы (по полученным страницам)
    lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

    /** Хранилище списка паков. */
    store = new Store<StickerPakItem>();

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * @param options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(options?: StickerPaksOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...options
        }

        // Проверяем, существует ли уже экземпляр
        if (StickerPaks.instance) {
            return StickerPaks.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        StickerPaks.instance = this;

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
                type: "form",
                url: `?stickers`,
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
            Logger.error("[app][sticker-paks][open]:", error);
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

            // Создать пак
            let create = this.tpl.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createPakHandler());

            // =========================

            // При скролле списка: троттлинг, проверка нижней границы и защита
            // от параллельных запросов — внутри хендлера (скролл-инстанс
            // создаётся в _onBeforeOpen; без него подписки не будет)
            const osInstance = this.osListScrollInstance;
            if (osInstance) this._offScrollPaks = onPaksScrollHandler(this, osInstance);

        } catch (error) {
            Logger.error("[app][sticker-paks][handlers]:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем список
            this.content = this.tpl.querySelector(":scope >.content");
            this.list = this.tpl.querySelector(":scope >.content [data-list]");

            // Инициализируем элементы (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Получаем паки
            await getStickerPaks(this);

        } catch (error) {
            Logger.error("[app][sticker-paks][before-open]:", error);
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
        this._offScrollPaks?.();
        this._offScrollPaks = null;

        // Удаляем экземпляр формы
        StickerPaks.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form sticker-paks flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${window._lc.forms.sticker_paks.title}</span>
                    </div>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-create"], icon: "Plus" })}
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-0 p-2 w-full"></div>

                    ${EmptyState.create({
                        title: window._lc.forms.sticker_paks.empty.title,
                        description: window._lc.forms.sticker_paks.empty.desc,
                        icon: "sticker",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector(".cdm-form");

    }

}
