// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";
import { toastError } from "../../utils/ui/toast_error.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем config формы
import { SECTIONS, SECTION_IDS } from "./config/sections.js";

// Импортируем events
import { StoreEvents } from "./events/store/index.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Tabs } from "../../components/tabs.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем functions
import { firstLoaded } from "./functions/first_loaded.js";
import { teardown } from "./functions/teardown.js";
import { tabsMarkup, panesMarkup } from "./functions/template_markup.js";

// Ипортируем handlers
import { searchHandler } from "./handlers/search.js";
import { createBotHandler } from "./handlers/create_bot.js";
import { onScrollHandler } from "./handlers/on_scroll.js";
import { onTextKeydownHandler } from "./handlers/on_text_keydown.js";

// Импортируем типы
import type { SectionId } from "./config/sections.js";
import type { SectionPagination, SearchRecord } from "./types.js";

/**
 * Настройки формы поиска.
 */
export interface SearchOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора формы поиска.
 */
export interface SearchData {

    /** Тип начального поиска. ["channels" | "groups" | "users" | "bots"] */
    searchType?: SectionId;

    /** Разрешённые типы поиска. ["channels" | "groups" | "users" | "bots"] */
    allowSearchType?: SectionId[];

    /** Функция для возврата данных выбранного элемента. */
    callback?: (record: SearchRecord) => void;

    /** Настройки формы. */
    options?: SearchOptions;

}

// Form
export class Search {

    // Переменная для хранения единственного экземпляра формы
    static instance: Search | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * ***************************************************************************
     */
    constructor(data?: SearchData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        };

        // Переменные формы
        this.allowSearchType = data?.allowSearchType || ["channels", "groups", "users", "bots"];
        this.searchType = data?.searchType || "channels";
        this.callback = data?.callback || null;

        // Каркас: шаблон, модалка, поля ввода и вкладки
        this.tpl = null;
        this.modal = null;
        this.text = null;
        this.tabs = null;

        // Форма закрыта. Нужна из-за неблокирующей первой загрузки: ответы
        // сервера могут прийти уже после закрытия, и их нельзя писать в сторы
        // мёртвой формы (иначе DOM оживает после remove())
        this.isClosed = false;

        // Применённая строка поиска. Догрузка по скроллу едет по ней, а не по
        // «живому» значению поля ввода: иначе изменение текста без нажатия
        // «Поиск» смешивало бы новую строку со старым курсором
        this.search = "";

        // Счётчик поисковых запросов формы. Ответ применяется, только если он
        // последний: без этого два клика подряд давали список от старого запроса
        this.searchSeq = 0;

        // Отписки, собираемые при инициализации: сторы, скроллбары, поля ввода
        this.storeUnsubs = [];
        this.scrollUnsubs = [];
        this.uiUnsubs = [];

        // Время последнего тоста об ошибке догрузки по каждой категории
        this.sectionErrorToasts = {};

        // Состояние пагинации категорий (firstLoaded, loadingPrev/Next,
        // hasMorePrev/Next), сторы, списки, панели, скроллбары и менеджеры
        // якоря живут отдельными полями с ключом SectionId и перечисляются
        // ниже — в конструкторе их циклом по конфигу больше не создают.
        // Неинициализированное состояние пагинации — undefined, что для всех
        // проверок эквиваленто «не загружено / данных больше нет неизвестно»

        // Форма уже открыта
        if (Search.instance) {

            // Определяем, куда просят открыть форму. null означает «по умолчанию»
            const target = data?.options?.insertInto ||
                document.querySelector(".cdm-form.home .left");

            // Форму нельзя перенести в другой контейнер на живую: DOM уже вставлен,
            // и смена options.insertInto ничего не переместит. Также нельзя достроить
            // на живую searchType/allowSearchType — вкладки к этому моменту уже
            // собраны и скрытие применено. Поэтому в обоих случаях закрываем старую
            // форму и создаём новую (см. B1 чеклиста).
            const current = Search.instance.options?.insertInto;
            const needsRebuild = current !== target || data?.searchType || data?.allowSearchType;
            if (needsRebuild) {
                Search.instance.modal?.close();
                Search.instance = null;

            } else {

                // Тот же контейнер — форма на месте, дообновляем её параметры.
                // Иначе сценарий «Назначить модератора» (group-moderators-manager)
                // потерял бы callback и молча открыл профиль пользователя.
                // Применяется только callback: searchType/allowSearchType уже
                // зашиты в собранные вкладки, поэтому их смена требует пересборки
                // (см. условие выше).
                if (data?.callback) Search.instance.callback = data.callback;

                // Возвращаем форму на передний план (кнопка «Поиск» в шапке,
                // пока форма уже открыта, иначе не делает ничего — см. B2)
                Search.instance.modal?.activate?.();
                return Search.instance;

            }

        }

        // Сохраняем ссылку на текущий экземпляр
        Search.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: SearchOptions;

    // Разрешённые и стартовая категории, callback выбора
    allowSearchType: SectionId[];
    searchType: SectionId;
    callback: ((record: SearchRecord) => void) | null;

    // Каркас: шаблон, модалка, поле поиска, вкладки
    tpl: HTMLElement | null;
    modal: Overlay | null;
    text: HTMLInputElement | null;
    tabs: Tabs | null;

    // Форма закрыта (поздние ответы сети не воскрешают DOM)
    isClosed: boolean;

    // Применённая строка поиска и счётчик запросов
    search: string;
    searchSeq: number;

    // Отписки: сторы, скролл, поля ввода
    storeUnsubs: Array<() => void>;
    scrollUnsubs: Array<() => void>;
    uiUnsubs: Array<() => void>;

    // Время последнего тоста об ошибке догрузки по каждой категории
    sectionErrorToasts: Partial<Record<SectionId, number>>;

    // Хранилища категорий поиска (ключи — SECTION_IDS)
    stores: Record<SectionId, Store<SearchRecord>> = {
        channels: new Store<SearchRecord>(),
        groups: new Store<SearchRecord>(),
        users: new Store<SearchRecord>(),
        bots: new Store<SearchRecord>()
    };

    // Списки и панели категорий (заполняются в _onBeforeOpen из шаблона)
    lists: Record<SectionId, HTMLElement | null> = {
        channels: null,
        groups: null,
        users: null,
        bots: null
    };
    panes: Record<SectionId, HTMLElement | null> = {
        channels: null,
        groups: null,
        users: null,
        bots: null
    };

    // Скроллбары панелей и менеджеры якоря скролла (создаются в _onBeforeOpen)
    scrollInstances: Record<SectionId, OverlayScrollbars | null> = {
        channels: null,
        groups: null,
        users: null,
        bots: null
    };
    scrollManagers: Record<SectionId, ScrollManager | null> = {
        channels: null,
        groups: null,
        users: null,
        bots: null
    };

    // Состояние пагинации категорий (см. functions/load_section.ts)
    pagination: Record<SectionId, SectionPagination> = {
        channels: {},
        groups: {},
        users: {},
        bots: {}
    };

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        StoreEvents.init(this);

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
                url: `?search`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {

            Logger.error("[app][search][open]:", error);

            // Откатываем регистрацию экземпляра. Иначе Search.instance остался бы
            // у недостроенной формы, и все следующие new Search() возвращали бы
            // её — форма перестала бы открываться до перезагрузки страницы
            Search.instance = null;

        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть
            const close = this.tpl?.querySelector<HTMLElement>(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Поиск
            const search = this.tpl?.querySelector<HTMLElement>(`:scope >.header [action-search]`);
            search?.addEventListener("click", () => searchHandler(this));

            // Создать бота
            const createBot = this.tpl?.querySelector<HTMLElement>(`:scope >.content [action-create-bot]`);
            createBot?.addEventListener("click", () => createBotHandler(this));

            // =========================
            // Клавиатура
            // =========================

            // Enter в поле поиска запускает поиск. Раньше обработчиков клавиатуры
            // в форме не было, и запрос срабатывал только по клику на кнопку
            const unsubKeydown = onTextKeydownHandler(this);
            if (unsubKeydown) this.uiUnsubs.push(unsubKeydown);

            // =========================
            // Догрузка при скролле
            // =========================

            // Подписываемся по конфигу категорий. Каждая подписка изолирована:
            // раньше одно исключение на первом же `.on("scroll")` глушилось
            // общим catch и теряло все четыре.
            for (const id of SECTION_IDS) {

                try {

                    const unsub = onScrollHandler(this, SECTIONS[id], this.scrollInstances[id]);
                    if (unsub) this.scrollUnsubs.push(unsub);

                } catch (error) {

                    // Одна упавшая вкладка не должна отнимать догрузку остальным
                    Logger.error(`[app][search][_handlers][${id}]:`, error);

                }

            }

        } catch (error) {

            // Кнопки уже навешены: пользователь получает рабочую форму поиска,
            // которая просто не догружает. Поэтому ошибку показываем, а не
            // молча проглатываем в лог
            Logger.error("[app][search][_handlers]:", error);

            toastError(error, {
                context: "[app][search][_handlers]",
                fallback: window._lc?.forms?.search?.toasts?.load_error
            });

        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<boolean | void> {

        try {

            // Устанавливаем элементы
            this.text = this.tpl?.querySelector<HTMLInputElement>(`:scope >.header [name="text"]`) ?? null;

            // Записываем tab контейнер
            // Лента вкладок живёт между шапкой и контентом (не внутри
            // шапки, как раньше) — поэтому селектор ведёт на data-tabs,
            // а не на .header
            const links = this.tpl?.querySelector<HTMLElement>(":scope >[data-tabs] >[data-tabs-list]");
            const panes = this.tpl?.querySelector<HTMLElement>(":scope >.content .cdm-tabs-content");

            // Без контейнеров вкладок форма не имеет смысла: дальше код всё равно
            // полез бы обращаться к несуществующим панелям
            if (!links || !panes) {
                Logger.error("[app][search][on-before-open]: не найдены контейнеры вкладок");
                return false;
            }

            const tabs = new Tabs([
                { tabs: links, scrollType: "horizontal" }
            ], panes, { isSlider: true });
            this.tabs = tabs;

            // Устанавливаем панели списков
            // Панели и списки — по конфигу категорий: имена свойств выводятся
            // из SECTION_IDS, поэтому новая категория не требует правки здесь
            for (const id of SECTION_IDS) {

                this.panes[id] = this.tpl?.querySelector<HTMLElement>(
                    `:scope >.content .cdm-tabs-content [data-target="${id}"]`
                ) ?? null;

                this.lists[id] = this.tpl?.querySelector<HTMLElement>(
                    `:scope >.content .cdm-tabs-content [data-list="${id}"]`
                ) ?? null;

            }

            // Панель нужна каждой категории: без неё не будет скроллбара,
            // а форма откроется сломанной (см. F4 — обработчики вешаются на все)
            for (const id of SECTION_IDS) {
                if (!this.panes[id] || !this.lists[id]) {
                    Logger.error(`[app][search][on-before-open]: не найдена панель вкладки «${id}»`);
                    return false;
                }
            }

            // Отключаем не разрешенные табы
            for (const id of SECTION_IDS) {
                if (!this.allowSearchType.includes(id)) tabs.hiddenTab(id);
            }

            // Инициализируем скроллбары по конфигу категорий: инстанс и
            // менеджер якоря живут в записи категории, поэтому новая категория
            // не требует правки этого метода
            for (const id of SECTION_IDS) {

                // invariant: панели проверены выше — элемент собран из шаблона
                const instance = OverlayScrollbars(this.panes[id]!, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
                this.scrollInstances[id] = instance;

                // Якорь скролла категории: вставка пачки prev в начало
                // списка не должна сдвигать видимую часть панели (см.
                // functions/load_section.ts); ключ — от id категории,
                // как и у прочего состояния пагинации
                this.scrollManagers[id] = new ScrollManager(instance);
            }

            // Активируем стартовую вкладку.
            // Делаем до загрузки данных, чтобы пользователь сразу видел нужную
            // вкладку, а не «Сообщества» из шаблона (раньше активация была
            // в самом конце firstLoaded и происходила после сети).
            // searchType сверяем с allowSearchType: иначе можно активировать
            // скрытую панель и получить форму без содержимого.
            const startTab = this.allowSearchType.includes(this.searchType)
                ? this.searchType
                : this.allowSearchType[0];
            if (startTab) tabs.activateTab(startTab);

            // Первая загрузка.
            // Важно: НЕ ждём здесь. Overlay.open() вызывает onBeforeOpen до вставки
            // в DOM, поэтому await блокировал бы показ формы на всё время сети.
            // Данные подставятся позже через события item::added (см. A1 чеклиста).
            // catch обязателен: промис не await-ится, и отказ без него стал бы
            // необработанным в консоли.
            firstLoaded(this).catch((error) => {
                Logger.error("[app][search][first-loaded]:", error);
            });

        } catch (error) {

            Logger.error("[app][search][on-before-open]:", error);

            toastError(error, {
                context: "[app][search][on-before-open]",
                fallback: window._lc?.forms?.search?.toasts?.open_error
            });

            // Открывать форму, которая не собралась, бессмысленно: пользователь
            // получит пустое окно без вкладок. Overlay.open() сам вызовет close()
            return false;

        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Единая точка выхода: снимает подписки, разрушает скроллбары,
        // чистит сторы. Раньше здесь были только сторы, а четыре инстанса
        // OverlayScrollbars оставались с наблюдателями и слушателями scroll
        // на отсоединённых панелях
        teardown(this);

        // Снимаем регистрацию экземпляра, но только если он всё ещё наш.
        // При пересборке формы старая закрывается, и её onBeforeClose
        // выполняется синхронно, раньше создания новой. Проверка — страховка
        // на случай, если закрытие станет асинхронным: иначе старая форма
        // снесла бы регистрацию новой, и следующий new Search() завёл бы
        // вторую копию
        if (Search.instance === this) {
            Search.instance = null;
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form search flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-col h-auto gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">

                    <div class="flex flex-row gap-2 w-full items-center justify-between">
                        <div class="flex flex-row gap-2 w-full items-center">
                            ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                            ${Inputs.transparent({ placeholder: window._lc.forms.search.search, name: "text", classes: ["w-full"] })}
                        </div>
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-search"], icon: "Search" })}
                    </div>

                </div>

                <div data-tabs class="flex w-full pt-[var(--form-header-height)] max-w-[var(--form-max-content-width)] m-auto">
                    <div data-tabs-list class="cdm-tabs flex flex-row gap-1 w-full p-1 overflow-x-auto scrollbar-none">
                        ${tabsMarkup()}
                    </div>
                </div>

                 <div class="content w-full flex flex-col gap-0 max-w-[var(--form-max-content-width)] m-auto overflow-hidden flex-1 min-h-0 pb-[var(--form-footer-height)]">

                    <div class="cdm-tabs-content flex h-full w-full">
                        ${panesMarkup()}
                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
