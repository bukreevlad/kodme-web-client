// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем utils
import { Logger } from "../utils/logs/logger.js";

/**
 * Конфигурация одной ленты заголовков табов.
 */
export interface TabLinkConfig {
    /** Элемент-контейнер заголовков табов. */
    tabs: HTMLElement;
    /** Тип скролла ленты (по умолчанию горизонтальный). */
    scrollType?: "horizontal" | "vertical";
}

/**
 * Дополнительные настройки менеджера табов.
 */
export interface TabsOptions {
    /** Включить анимацию слайдера (как в Telegram). */
    isSlider?: boolean;
    /** Множитель скорости скролла колесиком мыши (0 — выключить). */
    mouseWheelSpeed?: number;
}

/**
 * Параметры добавления нового таба.
 */
export interface AddTabOptions {
    /** ID таба (become `data-target` ссылки и панели). */
    id: string;
    /** HTML-строка, элемент либо массив элементов-заголовков. */
    links: string | HTMLElement | HTMLElement[];
    /** HTML-строка либо элемент контента таба. */
    pane: string | HTMLElement;
    /** Функция, вызываемая при активации таба. */
    onActivation?: (targetId: string) => void;
}

// Tabs
export class Tabs {

    /** Счётчик экземпляров — для генерации уникальных id (aria-controls). */
    static #instanceCounter = 0;

    /** Конфигурации лент заголовков. */
    tabLinks: TabLinkConfig[];

    /** Элемент-контейнер контентных панелей (null — табы без контента не работают). */
    tabPanes: HTMLElement | null;

    /** Флаг режима слайдера. */
    isSlider: boolean;

    /** Множитель скорости скролла колесиком. */
    mouseWheelSpeed: number;

    /** Индекс активного таба (для направления анимации слайдера). */
    currentIndex: number;

    /** ID активного таба. */
    currentId: string;

    /** Актуальные элементы заголовков (все `.item` во всех лентах). */
    tabLinksElements: HTMLElement[];

    /** Актуальные элементы контентных панелей (все `.item`). */
    tabPanesElements: HTMLElement[];

    /** Реестр колбэков активации по id таба. */
    activationCallbacks: Record<string, (targetId: string) => void>;

    /** Уникальный префикс id этого экземпляра (aria-controls/labelledby). */
    private _uid: string;

    /** Связанный обработчик клавиатуры лент (стрелки/Home/End/Enter/Space). */
    private _boundHandleKeydown: (event: KeyboardEvent) => void;

    /**
     * ***************************************************************************
     * Создает менеджер табов.
     * @param {TabLinkConfig|TabLinkConfig[]} linksConfig - Объект или массив объектов конфигурации лент.
     * @param {HTMLElement|null} panes - Элемент, содержащий контент (без него менеджер не инициализируется).
     * @param {TabsOptions} [options] - Дополнительные настройки.
     * ***************************************************************************
     */
    constructor(linksConfig: TabLinkConfig | TabLinkConfig[], panes: HTMLElement | null, options: TabsOptions = {}) {

        // Приводим входную конфигурацию к массиву объектов
        this.tabLinks = Array.isArray(linksConfig) ? linksConfig : [linksConfig];
        this.tabPanes = panes;

        // Инициализируем все свойства до проверок: при невалидном конфиге
        // конструктор завершается досрочно, но объект всё равно возвращается
        // вызывающему — его поля обязаны быть определены
        this.isSlider = options.isSlider || false;
        this.mouseWheelSpeed = options.mouseWheelSpeed !== undefined ? options.mouseWheelSpeed : 1.5; // скорость скролла колесом
        this.currentIndex = 0;
        this.currentId = "";
        this.tabLinksElements = [];
        this.tabPanesElements = [];

        // Хранилище для колбэков активации
        this.activationCallbacks = {};

        // Уникальный префикс для id и связанный обработчик клавиатуры
        Tabs.#instanceCounter += 1;
        this._uid = `cdm-tabs-${Tabs.#instanceCounter}`;
        this._boundHandleKeydown = this.handleLinkKeydown;

        // Проверка настроек
        if (this.tabLinks.length === 0 || !this.tabLinks[0]?.tabs || !this.tabPanes) {
            Logger.error(`TabManager: Элементы links или panes не переданы.`);
            return;
        }

        // Синхронизируем списки элементов
        this.updateElementsLists();

        // Если включен режим слайдера, добавляем класс анимации контенту
        if (this.isSlider) {
            this.tabPanes.classList.add("is-slider");
        }

        // Автоматически определяем начальный активный таб из HTML первой панели
        const activeIndex = this.tabLinksElements.findIndex(link => link.classList.contains("active"));
        if (activeIndex !== -1) {
            this.currentIndex = activeIndex;
            // Атрибут обязателен по разметке, но по типу его отсутствие → "",
            // чтобы falsy-проверки ниже работали и с пустой строкой
            const activeLink = this.tabLinksElements[activeIndex];
            if (activeLink) this.currentId = activeLink.getAttribute("data-target") ?? "";
        }

        // Инициализация обработчиков событий
        this.initEventListeners();

        // Доступность: role, aria-selected, roving tabindex и id для связей
        this._enhanceA11y();

        // Сразу центрируем/докручиваем стартовый активный таб без анимации во всех лентах
        if (this.currentId) {
            this.scrollToActiveLink(false);
        }

    }

    /**
     * ***************************************************************************
     * Внутренний метод для синхронизации JS-массивов с актуальным DOM.
     * ***************************************************************************
     */
    updateElementsLists() {
        this.tabLinksElements = [];
        this.tabLinks.forEach(config => {
            if (config?.tabs) {
                this.tabLinksElements.push(...Array.from(config.tabs.querySelectorAll<HTMLElement>(".item")));
            }
        });

        // Без контейнера панелей синхронизировать нечего — он уже проверен
        // в конструкторе, но метод публичный и вызывается повторно
        this.tabPanesElements = this.tabPanes
            ? Array.from(this.tabPanes.querySelectorAll<HTMLElement>(".item"))
            : [];
    }

    // ***************************************************************************
    // Назначает обработчики кликов для заголовков табов.
    // ***************************************************************************
    initEventListeners() {

        // Клик на табы во всех панелях
        this.tabLinksElements.forEach(link => {
            this.bindLinkEvent(link);
        });

        // Клавиатурная навигация лент (стрелки, Home/End, Enter/Space)
        this.tabLinks.forEach(config => {
            if (config?.tabs) {
                config.tabs.removeEventListener("keydown", this._boundHandleKeydown);
                config.tabs.addEventListener("keydown", this._boundHandleKeydown);
            }
        });

        // Назначаем скролл колесиком мыши напрямую на каждый контейнер ленты табов
        if (this.mouseWheelSpeed > 0) {
            this.tabLinks.forEach(config => {
                if (config?.tabs) {
                    config.tabs.removeEventListener("wheel", this.handleWheel);
                    config.tabs?.addEventListener("wheel", this.handleWheel, { passive: false });
                }
            });
        }

    }

    /**
     * ***************************************************************************
     * Проставляет ARIA-атрибуты и id на лентах, заголовках и панелях.
     *
     * Метод идемпотентен: вызывается в конструкторе и после addTab, а все
     * атрибуты ставятся только при отсутствии. Существующие классы `.item`,
     * `.active` и `data-target` не трогаются — на них завязана логика форм.
     * @private
     * ***************************************************************************
     */
    private _enhanceA11y(): void {

        // 1. Ленты заголовков → role="tablist" с ориентацией из типа скролла
        this.tabLinks.forEach(config => {
            const container = config?.tabs;
            if (!container) return;

            container.setAttribute("role", "tablist");
            const orientation = (config.scrollType || "horizontal") === "vertical" ? "vertical" : "horizontal";
            container.setAttribute("aria-orientation", orientation);
        });

        // 2. Заголовки → role="tab", roving tabindex, aria-controls на панель
        this.tabLinksElements.forEach(link => {
            const targetId = link.getAttribute("data-target") || "";
            link.setAttribute("role", "tab");
            this._ensureId(link, `tab-${targetId}`);

            const pane = this.tabPanesElements.find(p => p.getAttribute("data-target") === targetId);
            if (pane) {
                const paneId = this._ensureId(pane, `pane-${targetId}`);
                link.setAttribute("aria-controls", paneId);
                pane.setAttribute("role", "tabpanel");
                pane.setAttribute("aria-labelledby", link.id);
            }

            // Roving tabindex: табуем только активный заголовок ленты
            const isActive = link.classList.contains("active");
            link.setAttribute("aria-selected", isActive ? "true" : "false");
            link.tabIndex = isActive ? 0 : -1;
        });

        // 3. Панели → role="tabpanel" (в т.ч. панели без заголовка в лентах)
        this.tabPanesElements.forEach(pane => {
            const targetId = pane.getAttribute("data-target") || "";
            pane.setAttribute("role", "tabpanel");
            this._ensureId(pane, `pane-${targetId}`);
        });

        // 4. Гарантия: в каждой ленте хотя бы один заголовок с tabIndex 0,
        // иначе с клавиатуры в табы вообще не попасть
        this.tabLinks.forEach(config => {
            const container = config?.tabs;
            if (!container) return;

            const links = Array.from(container.querySelectorAll<HTMLElement>(".item"));
            if (links.some(link => link.tabIndex === 0)) return;

            const first = links.find(link => !link.classList.contains("hidden"));
            if (first) first.tabIndex = 0;
        });

    }

    /**
     * ***************************************************************************
     * Гарантирует уникальный id у элемента (для aria-controls/labelledby).
     * @param {HTMLElement} element - Целевой элемент.
     * @param {string} suffix - Суффикс id из data-target.
     * @returns {string} - Итоговый id элемента.
     * @private
     * ***************************************************************************
     */
    private _ensureId(element: HTMLElement, suffix: string): string {
        if (!element.id) {
            // data-target может содержать символы, недопустимые в id
            const safeSuffix = suffix.replace(/[^a-zA-Z0-9_-]/g, "-");
            element.id = `${this._uid}-${safeSuffix}`;
        }
        return element.id;
    }

    /**
     * ***************************************************************************
     * Обработчик клавиатуры ленты табов (WAI-ARIA, manual activation):
     * стрелки/Home/End перемещают фокус между заголовками, Enter/Space
     * активируют таб с фокусом.
     * ***************************************************************************
     */
    handleLinkKeydown = (event: KeyboardEvent) => {

        const container = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        if (!container) return;

        const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
        const isPrev = event.key === "ArrowLeft" || event.key === "ArrowUp";
        const isHome = event.key === "Home";
        const isEnd = event.key === "End";

        // Enter/Space — активация сфокусированного заголовка
        if (event.key === "Enter" || event.key === " ") {
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && container.contains(focused) && focused.hasAttribute("data-target")) {
                const targetId = focused.getAttribute("data-target");
                if (targetId && targetId !== this.currentId) {
                    event.preventDefault();
                    this.activateTab(targetId);
                }
            }
            return;
        }

        if (!isNext && !isPrev && !isHome && !isEnd) return;

        // Только видимые заголовки этой ленты участвуют в навигации
        const links = Array.from(container.querySelectorAll<HTMLElement>(".item"))
            .filter(link => !link.classList.contains("hidden"));
        if (links.length === 0) return;

        event.preventDefault();

        // Точка отсчёта: текущий фокус либо активный таб при первом нажатии
        const activeElement = document.activeElement;
        const focused = activeElement instanceof HTMLElement && container.contains(activeElement)
            ? activeElement
            : links.find(link => link.classList.contains("active")) ?? links[0] ?? null;
        if (!focused) return;

        const currentIndex = links.indexOf(focused);
        let nextIndex = currentIndex;

        if (isNext) nextIndex = (currentIndex + 1) % links.length;
        else if (isPrev) nextIndex = (currentIndex - 1 + links.length) % links.length;
        else if (isHome) nextIndex = 0;
        else if (isEnd) nextIndex = links.length - 1;

        const next = links[nextIndex];
        if (!next) return;

        // Roving tabindex: переносим табуляцию и фокус, сам таб не активируем
        links.forEach(link => { link.tabIndex = -1; });
        next.tabIndex = 0;
        next.focus();

    }

    /**
     * ***************************************************************************
     * Внутренний метод для привязки события клика к конкретной ссылке.
     * @param {HTMLElement} link - Заголовок таба.
     * ***************************************************************************
     */
    bindLinkEvent(link: HTMLElement) {
        link.removeEventListener("click", this.handleLinkClick);
        link?.addEventListener("click", this.handleLinkClick);
    }

    /**
     * ***************************************************************************
     * Обработчик прокрутки колесиком мыши (с учетом направления скролла ленты)
     * ***************************************************************************
     */
    handleWheel = (event: WheelEvent) => {
        if (event.deltaY !== 0) {
            // invariant: слушатель вешается на элементы-контейнеры лент
            if (!(event.currentTarget instanceof HTMLElement)) return;
            const container = event.currentTarget;

            // Ищем конфиг текущего контейнера, чтобы узнать его тип скролла
            const config = this.tabLinks.find(c => c.tabs === container);
            const scrollType = config?.scrollType || "horizontal";

            event.preventDefault(); // Блокируем дефолтный скролл страницы

            if (scrollType === "vertical") {
                // Плавный вертикальный скролл ленты
                container.scrollBy({
                    top: event.deltaY * this.mouseWheelSpeed,
                    behavior: "smooth"
                });
            } else {
                // Переводим вертикальный скролл мыши в горизонтальный
                container.scrollBy({
                    left: event.deltaY * this.mouseWheelSpeed,
                    behavior: "smooth"
                });
            }
        }
    }

    handleLinkClick = (event: Event) => {
        event.preventDefault();
        // invariant: слушатель вешается на элементы-заголовки табов
        if (!(event.currentTarget instanceof HTMLElement)) return;
        const targetId = event.currentTarget.getAttribute("data-target");
        if (targetId) {
            this.activateTab(targetId);
        }
    }

    /**
     * ***************************************************************************
     * Автоматически прокручивает ленты табов, чтобы активные элементы встали по центру.
     * @param {boolean} [smooth=true] - плавный скролл или мгновенный.
     * ***************************************************************************
     */
    scrollToActiveLink(smooth = true) {
        // Проходимся по каждому контейнеру табов независимо
        this.tabLinks.forEach(config => {
            const container = config?.tabs;
            if (!container) return;

            // Находим активную кнопку конкретно внутри ТЕКУЩЕГО контейнера
            const activeLink = Array.from(container.querySelectorAll<HTMLElement>(".item"))
                .find(link => link.getAttribute("data-target") === this.currentId);

            if (!activeLink) return;

            const scrollType = config.scrollType || "horizontal";

            if (scrollType === "vertical") {
                // Расчет позиции для центрирования таба по вертикали
                const viewportHeight = container.clientHeight;
                const linkOffsetTop = activeLink.offsetTop;
                const linkHeight = activeLink.clientHeight;

                const targetScrollTop = linkOffsetTop - (viewportHeight / 2) + (linkHeight / 2);

                container.scrollTo({
                    top: targetScrollTop,
                    behavior: smooth ? "smooth" : "auto"
                });
            } else {
                // Расчет позиции для центрирования таба по горизонтали
                const viewportWidth = container.clientWidth;
                const linkOffsetLeft = activeLink.offsetLeft;
                const linkWidth = activeLink.clientWidth;

                const targetScrollLeft = linkOffsetLeft - (viewportWidth / 2) + (linkWidth / 2);

                container.scrollTo({
                    left: targetScrollLeft,
                    behavior: smooth ? "smooth" : "auto"
                });
            }
        });
    }

    /**
     * ***************************************************************************
     * Программно или по клику активирует указанный таб.
     * @param {string} targetId - ID таба (data-target).
     * ***************************************************************************
     */
    activateTab(targetId: string) {
        let isTabFound = false;
        let newIndex = this.currentIndex;
        this.currentId = targetId;

        // Находим индекс нового таба по первой панели, чтобы понять направление анимации
        if (this.isSlider && this.tabLinks[0]?.tabs) {
            const firstPanelLinks = Array.from(this.tabLinks[0].tabs.querySelectorAll<HTMLElement>(".item"));
            newIndex = firstPanelLinks.findIndex(link => link.getAttribute("data-target") === targetId);
        }

        // Обновление заголовков табов (подсветит активные элементы во ВСЕХ панелях синхронно)
        this.tabLinksElements.forEach((link) => {
            const linkTargetId = link.getAttribute("data-target");
            if (linkTargetId === targetId) {
                link.classList.add("active");
                link.setAttribute("aria-selected", "true");
                link.tabIndex = 0;
                isTabFound = true;
            } else {
                link.classList.remove("active");
                link.setAttribute("aria-selected", "false");
                link.tabIndex = -1;
            }
        });

        // Обновление контента табов
        this.tabPanesElements.forEach((pane) => {
            const tabTargetId = pane.getAttribute("data-target");

            if (this.isSlider) {
                pane.classList.remove("slide-next-enter", "slide-next-leave", "slide-prev-enter", "slide-prev-leave");

                if (tabTargetId === targetId) {
                    pane.classList.add("active");
                    if (newIndex > this.currentIndex) {
                        pane.classList.add("slide-next-enter");
                    } else if (newIndex < this.currentIndex) {
                        pane.classList.add("slide-prev-enter");
                    }
                } else if (pane.classList.contains("active")) {
                    pane.classList.remove("active");
                    if (newIndex > this.currentIndex) {
                        pane.classList.add("slide-next-leave");
                    } else if (newIndex < this.currentIndex) {
                        pane.classList.add("slide-prev-leave");
                    }
                }
            } else {
                if (tabTargetId === targetId) {
                    pane.classList.add("active");
                    isTabFound = true;
                } else {
                    pane.classList.remove("active");
                }
            }
        });

        // Выносим слушатель за пределы цикла: вешаем только на активную панель
        if (this.isSlider) {
            const activePane = this.tabPanesElements.find(pane => pane.getAttribute("data-target") === targetId);

            if (activePane) {
                const onTransitionEnd = (event: Event) => {
                    if (event.target === activePane) {
                        activePane.removeEventListener("transitionend", onTransitionEnd);
                        activePane.removeEventListener("animationend", onTransitionEnd);

                        // Чистим классы анимации со всех панелей
                        this.tabPanesElements.forEach(p => {
                            p.classList.remove("slide-next-enter", "slide-next-leave", "slide-prev-enter", "slide-prev-leave");
                        });

                        // Оживляем скроллбар
                        const osInstance = OverlayScrollbars(activePane);
                        if (osInstance) osInstance.update(true);
                    }
                };

                activePane?.addEventListener("transitionend", onTransitionEnd);
                activePane?.addEventListener("animationend", onTransitionEnd);
            }
        }

        // Обновляем текущий индекс
        if (this.isSlider && newIndex !== -1) {
            this.currentIndex = newIndex;
        }

        // Если слайдер выключен, дергаем скролл контента сразу
        if (!this.isSlider) {
            const activePane = this.tabPanesElements.find(pane => pane.getAttribute("data-target") === targetId);
            if (activePane) {
                const osInstance = OverlayScrollbars(activePane);
                if (osInstance) osInstance.update(true);
            }
        }

        // Вызываем умный скролл для всех лент табов
        this.scrollToActiveLink(true);

        if (!isTabFound && newIndex === -1) {
            Logger.warn(`TabManager: Таб или контент с ID "${targetId}" не найден.`);
        }

        // Если для этого таба зарегистрирована функция onActivation, вызываем её
        if (typeof this.activationCallbacks[targetId] === 'function') {
            this.activationCallbacks[targetId](targetId);
        }

    }

    /**
     * ***************************************************************************
     * Программно скрывает указанный таб и его контент во всех панелях.
     * @param {string} targetId - ID таба (data-target).
     * ***************************************************************************
     */
    hiddenTab(targetId: string) {
        let isTabFound = false;

        this.tabLinksElements.forEach(link => {
            if (link.getAttribute("data-target") === targetId) {
                link.classList.add("hidden");
                // Скрытый заголовок исключаем и из фокуса, и из дерева
                // доступности — видимости CSS одному недостаточно
                link.setAttribute("aria-hidden", "true");
                link.tabIndex = -1;
                isTabFound = true;
            }
        });

        this.tabPanesElements.forEach(pane => {
            if (pane.getAttribute("data-target") === targetId) {
                pane.classList.add("hidden");
                pane.classList.remove("active");
                pane.setAttribute("aria-hidden", "true");
                isTabFound = true;
            }
        });

        if (!isTabFound) {
            Logger.warn(`TabManager: Не удалось скрыть таб "${targetId}", так как он не найден.`);
            return;
        }

        if (this.currentId === targetId) {
            const nextAvailableLink = this.tabLinksElements.find(link => !link.classList.contains("hidden"));
            const nextTargetId = nextAvailableLink?.getAttribute("data-target");
            if (nextTargetId) {
                this.activateTab(nextTargetId);
            }
        }
    }

    /**
     * ***************************************************************************
     * Добавляет новый таб во все панели навигации и его контент в конец списков.
     * @param {AddTabOptions} options - Параметры нового таба.
     * ***************************************************************************
     */
    addTab(options: AddTabOptions = {
        id: "",
        links: "",
        pane: "",
        onActivation: () => { }
    }) {

        // Защита от дубликатов: проверяем, нет ли уже таба с таким id
        const exists = this.tabLinksElements.some(link => link.getAttribute("data-target") === options?.id);
        if (exists) {
            Logger.warn(`TabManager: Таб с id "${options?.id}" уже существует.`);
            return;
        }

        // Сохраняем функцию onActivation, если она передана
        if (typeof options?.onActivation === 'function') {
            this.activationCallbacks[options.id] = options.onActivation;
        }

        // Рендер кнопок табов во все панели
        this.tabLinks.forEach((config, index) => {
            const container = config?.tabs;
            if (!container) return;

            let currentLinkElem: Node | null;

            if (Array.isArray(options?.links)) {
                // Если передан массив элементов, извлекаем .tabs из конфига соответствующего индекса
                currentLinkElem = options?.links[index] || options?.links[0] || null;
            } else if (options?.links instanceof HTMLElement) {
                currentLinkElem = (index === 0) ? options?.links : options?.links.cloneNode(true);
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = options?.links?.trim();
                currentLinkElem = tempDiv.firstChild;
            }

            // invariant: вызывающий код передаёт корневой HTML-элемент —
            // иначе setAttribute упадёт на не-элементе
            if (!(currentLinkElem instanceof HTMLElement)) {
                throw new TypeError(`TabManager: addTab: links должен приводиться к HTML-элементу (id "${options?.id}")`);
            }

            // Выставляем обязательные атрибуты и классы
            currentLinkElem.setAttribute('data-target', options?.id);
            currentLinkElem.classList.add('item');

            // Добавляем кнопку в текущую панель
            container.appendChild(currentLinkElem);

            // Навешиваем событие клика на свежий элемент
            this.bindLinkEvent(currentLinkElem);
        });

        // Рендер контента таба (pane)
        let paneElem: Node | null;
        if (options?.pane instanceof HTMLElement) {
            paneElem = options?.pane;
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = options?.pane.trim();
            paneElem = tempDiv.firstChild;
        }

        // invariant: вызывающий код передаёт корневой HTML-элемент —
        // иначе setAttribute упадёт на не-элементе
        if (!(paneElem instanceof HTMLElement)) {
            throw new TypeError(`TabManager: addTab: pane должен приводиться к HTML-элементу (id "${options?.id}")`);
        }

        paneElem.setAttribute('data-target', options?.id);
        paneElem.classList.add('item');

        // Без контейнера панелей контент таба вставить некуда —
        // падаем с явной ошибкой вместо обращения к null
        if (!this.tabPanes) {
            throw new TypeError(`TabManager: addTab: контейнер panes не задан (id "${options?.id}")`);
        }

        this.tabPanes.appendChild(paneElem);

        // Пересобираем глобальные списки элементов
        this.updateElementsLists();

        // Проставляем ARIA/id новым элементам (метод идемпотентен)
        this._enhanceA11y();
    }

    /**
     * ***************************************************************************
     * Полностью удаляет таб и его контент из DOM-дерева изо всех панелей.
     * @param {string} targetId - ID таба (data-target).
     * ***************************************************************************
     */
    removeTab(targetId: string) {
        const matchingLinks = this.tabLinksElements.filter(link => link.getAttribute("data-target") === targetId);
        const paneIndex = this.tabPanesElements.findIndex(pane => pane.getAttribute("data-target") === targetId);

        if (matchingLinks.length === 0 && paneIndex === -1) {
            Logger.warn(`TabManager: Нечего удалять. Таб с ID "${targetId}" не найден.`);
            return;
        }

        if (this.currentId === targetId) {
            const fallbackLink = this.tabLinksElements.find(link => link.getAttribute("data-target") !== targetId && !link.classList.contains("hidden"));
            const fallbackTargetId = fallbackLink?.getAttribute("data-target");
            if (fallbackTargetId) {
                this.activateTab(fallbackTargetId);
            } else {
                this.currentId = "";
                this.currentIndex = 0;
            }
        }

        // Удаляем слушатели и сами элементы
        matchingLinks.forEach(link => {
            link.removeEventListener("click", this.handleLinkClick);
            link.remove();
        });

        if (paneIndex !== -1) {
            this.tabPanesElements[paneIndex]?.remove();
        }

        this.updateElementsLists();

        if (this.isSlider && this.currentId && this.tabLinks[0]?.tabs) {
            const firstPanelLinks = Array.from(this.tabLinks[0].tabs.querySelectorAll<HTMLElement>(".item"));
            this.currentIndex = firstPanelLinks.findIndex(link => link.getAttribute("data-target") === this.currentId);
        }
    }

    /**
     * ***************************************************************************
     * Возвращает DOM-элемент контента (pane) по его ID (data-target).
     * @param {string} targetId - ID таба (data-target).
     * @returns {HTMLElement|null} - Элемент панели либо null, если не найдена.
     * ***************************************************************************
     */
    getPane(targetId: string): HTMLElement | null {
        const pane = this.tabPanesElements.find(p => p.getAttribute("data-target") === targetId);
        if (!pane) {
            Logger.warn(`TabManager: Контентная панель с ID "${targetId}" не найдена.`);
            return null;
        }
        return pane;
    }

    /**
     * ***************************************************************************
     * Скрывает или показывает навигацию (заголовки) табов на всех панелях.
     * @param {boolean} isHidden - Скрыть ли навигацию.
     * ***************************************************************************
     */
    toggleNavigation(isHidden: boolean) {
        this.tabLinks.forEach(config => {
            if (config?.tabs) {
                let parent = config?.tabs.parentNode;
                // invariant: заголовки табов всегда вложены в элемент-родитель
                if (parent instanceof HTMLElement) {
                    parent.classList.toggle("hidden", isHidden);
                }
            }
        });
    }

    /**
     * ***************************************************************************
     * Метод для ручного уничтожения инстанса (чистит память и события)
     * ***************************************************************************
     */
    destroy() {
        this.tabLinksElements.forEach(link => {
            link.removeEventListener("click", this.handleLinkClick);
        });

        this.tabLinks.forEach(config => {
            if (config?.tabs) {
                config.tabs.removeEventListener("wheel", this.handleWheel);
                config.tabs.removeEventListener("keydown", this._boundHandleKeydown);
            }
        });
    }
}
