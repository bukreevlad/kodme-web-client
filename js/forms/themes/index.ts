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
import { getThemes } from "./functions/get_themes.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";
import { onThemesScrollHandler } from "./handlers/on_themes_scroll.js";

// Импортируем типы
import { ThemeListItem } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы тем оформления.
 */
export interface ThemesOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class Themes {

    // Переменная для хранения единственного экземпляра формы
    static instance: Themes | null = null;

    /** Настройки формы. */
    options: ThemesOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Список тем. */
    list: HTMLElement | null = null;

    /** Блок пустого состояния списка. */
    empty: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Менеджер якоря скролла. */
    listScrollManager: ScrollManager | null = null;

    /** Отписка от скролла списка. */
    _offScrollThemes: (() => void) | null = null;

    // Состояние пагинации списка (см. functions/get_themes.ts)
    isFirstLoaded = false; // первая страница загружена
    isLoadingFirst = false; // первая страница грузится
    isLoadingPrev = false; // грузится пачка старых (вверх)
    isLoadingNext = false; // грузится пачка новых (вниз)
    hasMorePrev = true; // есть ли старые записи выше списка
    hasMoreNext = true; // есть ли новые записи ниже списка
    lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

    /** Хранилище списка тем. */
    store = new Store<ThemeListItem>();

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * @param options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(options?: ThemesOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...options
        }

        // Проверяем, существует ли уже экземпляр
        if (Themes.instance) {
            return Themes.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Themes.instance = this;

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

            // NOTE(MIGRATION): из опций формы убрана мёртвая
            // openAnimationClass: передавалась строкой "slide-in-right",
            // а оверлей ждёт объект пресета { animation, settings } —
            // опция никогда не применялась

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?themes`,
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

            // Создать
            let create = this.tpl.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler());

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера (скролл-инстанс
            // создаётся в _onBeforeOpen; без него подписки не будет)
            const osInstance = this.osListScrollInstance;
            if (osInstance) this._offScrollThemes = onThemesScrollHandler(this, osInstance);

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

            // Устанавливаем список
            this.content = this.tpl.querySelector(":scope >.content");
            this.list = this.tpl.querySelector(":scope >.content [data-list]");

            // Инициализируем элементы (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });

                // Менеджер якоря скролла: вставка пачки в начало списка
                // сдвигала бы видимую часть вниз (см. functions/get_themes.ts)
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Получаем темы
            await getThemes(this);

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
        this._offScrollThemes?.();
        this._offScrollThemes = null;

        // Удаляем экземпляр формы
        Themes.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form themes flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.themes.title")}</span>
                    </div>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-create"], icon: "Plus" })}
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-0 p-2 w-full"></div>

                    ${EmptyState.create({
                        title: t("forms.themes.empty.title"),
                        description: t("forms.themes.empty.desc"),
                        icon: "palette",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector(".cdm-form");

    }

}
