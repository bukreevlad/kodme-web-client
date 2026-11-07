// Импортируем типы
import type { AnimationPreset } from "../../config/animations.js";
import type { FitMode } from "../../utils/dom/anchored_positioner.js";
import type { MoveAndResizeController } from "../../utils/move_and_resize_controller.js";

/**
 * ***************************************************************************
 * OVERLAY_TYPES - контракты системы слоёв поверх интерфейса.
 * ***************************************************************************
 *
 * Здесь лежат только типы: базовый контракт экземпляра (`OverlayLike`),
 * контракты пресета и капабилти, а также нормализованные настройки.
 *
 * Почему контракты отдельно от `Overlay`:
 * пресеты и капабилти типизируются по минимальному контракту, а не по классу.
 * Это разрывает циклическую зависимость «класс ссылается на пресеты,
 * пресеты — на класс» и не даёт контрактам «утащить» за собой всю реализацию.
 */

/**
 * Метаданные закрытия слоя (`startX` — смещение контента при закрытии свайпом).
 */
export interface OverlayCloseMeta {
    /** Смещение контента в пикселях, если закрытие идёт свайпом. */
    startX?: number;
}

/**
 * Сохранённая геометрия окна (позиция и размеры в пикселях).
 */
export interface OverlayGeometry {
    /** Позиция слева. */
    left: number;
    /** Позиция сверху. */
    top: number;
    /** Ширина. */
    width: number;
    /** Высота. */
    height: number;
}

/**
 * Данные для восстановления геометрии (все поля необязательны).
 */
export interface OverlayGeometryData {
    /** Ширина в пикселях. */
    width?: number;
    /** Высота в пикселях. */
    height?: number;
    /** Позиция слева в пикселях. */
    left?: number;
    /** Позиция сверху в пикселях. */
    top?: number;
}

/**
 * Настройки слоя после слияния дефолтов пресета и вызова.
 *
 * Поля настроек (кроме `id` и хуков жизненного цикла) объявлены опциональными:
 * пресеты дают разные наборы дефолтов (у поповера нет `wrapPadding`, у формы —
 * `resize`), и итоговый объект собирается слиянием. Хуки (`onBeforeOpen`,
 * `onOpen`, `onBeforeClose`, `onAfterClose`) обязательны: конструктор
 * нормализует их до no-op, чтобы чтение не падало на undefined.
 */
export interface ResolvedOverlayOptions {
    /** Уникальный идентификатор слоя. */
    id: string;
    /** URL для интеграции с историей навигации. */
    url?: string | null;
    /** Куда монтировать обёртку (по умолчанию `document.body`). */
    insertInto?: HTMLElement | null | undefined;
    /** Закрывать ли по Escape (только верхний слой). */
    closeOnEsc?: boolean | undefined;
    /** Закрывать ли по клику на оверлей. */
    closeOnOverlay?: boolean | undefined;
    /** Показывать ли затемняющий оверлей. */
    overlay?: boolean | undefined;
    /** Размытие под оверлеем. */
    overlayBlur?: boolean;
    /** Классы отступов обёртки. */
    wrapPadding?: string | null;
    /** Можно ли менять размер окна. */
    resize?: boolean;
    /** Перетаскивание окна: флаг либо объект с ручкой. */
    move?: boolean | { enabled?: boolean; element?: HTMLElement | undefined } | null;
    /** Закрытие по свайпу: сторона свайпа. */
    closeOnSwipe?: { direction: "left" | "right" } | null;
    /** Элементы и селекторы, где свайп отключён. */
    ignoreSwipeElements?: (string | HTMLElement)[] | null;
    /** Точка привязки поповера по X. */
    x?: number;
    /** Точка привязки поповера по Y. */
    y?: number;
    /** Отступ от якоря: число либо массив `[top, right, bottom, left]`. */
    margin?: number | number[] | undefined;
    /** Элемент-якорь для позиционирования. */
    targetNode?: HTMLElement | null | undefined;
    /** Сторона и выравнивание относительно якоря. */
    targetNodeDirection?: string | string[] | undefined;
    /** Что делать при нехватке места: переворот либо ужатие. */
    fit?: FitMode;
    /** Не подменять `insertInto` на мобильных. */
    notReplaceInsertIntoIsMobile?: boolean;
    /** Не подменять классы анимации на мобильных. */
    notReplaceAnimationClassIsMobile?: boolean;
    /** Кастомная анимация открытия `{ animation, settings }`. */
    openAnimationClass?: AnimationPreset | null;
    /** Кастомная анимация закрытия `{ animation, settings }`. */
    closeAnimationClass?: AnimationPreset | null;
    /** Доступное имя слоя (`aria-label`); без него имя берётся из заголовка `[data-title]`. */
    ariaLabel?: string | undefined;
    /** Ловушка фокуса: Tab/Shift+Tab циклится внутри контента (дефолт модалки — `true`). */
    focusTrap?: boolean | undefined;
    /** Возврат фокуса на элемент-триггер при закрытии (дефолт модалки/формы — `true`). */
    focusReturn?: boolean | undefined;
    /** Хук перед открытием: возврат `false` может отменить открытие. Всегда заполнен (дефолт пресета либо no-op). */
    onBeforeOpen: () => boolean | void | Promise<boolean | void>;
    /** Хук после монтирования в DOM. Всегда заполнен (дефолт пресета либо no-op). */
    onOpen: () => void | Promise<void>;
    /** Хук перед закрытием. Всегда заполнен (дефолт пресета либо no-op). */
    onBeforeClose: () => void | Promise<void>;
    /** Хук после удаления из DOM. Всегда заполнен (дефолт пресета либо no-op). */
    onAfterClose: () => void;
}

/**
 * Настройки, передаваемые в конструктор (свободный набор ключей пресета).
 */
export interface OverlayOptions {
    /** Тип оверлея: ключ реестра пресетов (`"form"`, `"modal"`, `"popover"`). */
    type: string;
    /** Уникальный идентификатор (по умолчанию UUID). */
    id?: string;
    /** URL для интеграции с историей навигации. */
    url?: string | null;
    /** Куда монтировать обёртку. */
    insertInto?: HTMLElement | null | undefined;
    /** Закрывать ли по Escape. */
    closeOnEsc?: boolean | undefined;
    /** Закрывать ли по клику на оверлей. */
    closeOnOverlay?: boolean | undefined;
    /** Показывать ли затемняющий оверлей. */
    overlay?: boolean | undefined;
    /** Размытие под оверлеем. */
    overlayBlur?: boolean;
    /** Классы отступов обёртки. */
    wrapPadding?: string | null;
    /** Можно ли менять размер окна. */
    resize?: boolean;
    /** Перетаскивание окна. */
    move?: boolean | { enabled?: boolean; element?: HTMLElement | undefined } | null;
    /** Закрытие по свайпу. */
    closeOnSwipe?: { direction: "left" | "right" } | null;
    /** Элементы и селекторы, где свайп отключён. */
    ignoreSwipeElements?: (string | HTMLElement)[] | null;
    /** Точка привязки поповера по X. */
    x?: number;
    /** Точка привязки поповера по Y. */
    y?: number;
    /** Отступ от якоря. */
    margin?: number | number[] | undefined;
    /** Элемент-якорь для позиционирования. */
    targetNode?: HTMLElement | null | undefined;
    /** Сторона и выравнивание относительно якоря. */
    targetNodeDirection?: string | string[] | undefined;
    /** Что делать при нехватке места. */
    fit?: FitMode;
    /** Не подменять `insertInto` на мобильных. */
    notReplaceInsertIntoIsMobile?: boolean;
    /** Не подменять классы анимации на мобильных. */
    notReplaceAnimationClassIsMobile?: boolean;
    /** Кастомная анимация открытия. */
    openAnimationClass?: AnimationPreset | null;
    /** Кастомная анимация закрытия. */
    closeAnimationClass?: AnimationPreset | null;
    /** Доступное имя слоя (`aria-label`). */
    ariaLabel?: string | undefined;
    /** Ловушка фокуса (только модалки). */
    focusTrap?: boolean | undefined;
    /** Возврат фокуса на триггер при закрытии. */
    focusReturn?: boolean | undefined;
    /** Хук перед открытием. */
    onBeforeOpen?: () => boolean | void | Promise<boolean | void>;
    /** Хук после монтирования в DOM. */
    onOpen?: () => void | Promise<void>;
    /** Хук перед закрытием. */
    onBeforeClose?: () => void | Promise<void>;
    /** Хук после удаления из DOM. */
    onAfterClose?: () => void;
}

/**
 * Минимальный контракт экземпляра слоя, который знают пресеты и капабилти.
 *
 * Часть полей (`resizeObserver`, `_setPosition` и т.п.) назначается на
 * экземпляр капабилти и пресетами, поэтому здесь они объявлены как
 * необязательные: контейнер без соответствующей капабилти их не имеет.
 */
export interface OverlayLike {
    /** Контент слоя (к моменту вызова пресетов — всегда элемент). */
    content: HTMLElement;
    /** Обёртка слоя (создаётся при открытии). */
    wrap: HTMLElement | null;
    /** Элемент затемнения внутри обёртки. */
    overlay: HTMLElement | null;
    /** Нормализованные настройки. */
    options: ResolvedOverlayOptions;
    /** Пресет типа. */
    preset: OverlayPreset;
    /** Связанный обработчик ресайза/скролла (для привязки к window). */
    boundResize: EventListener | null;

    // --- Состояние капабилти геометрии (назначается на экземпляр) ---

    /** Наблюдатель размеров окна. */
    resizeObserver?: ResizeObserver | null;
    /** Контроллер перемещения и ресайза. */
    moveAndResizeController?: MoveAndResizeController | null;
    /** Флаг ручного позиционирования. */
    isManuallyPositioned?: boolean;
    /** Сохранённая геометрия окна. */
    geometry?: OverlayGeometry | null;

    // --- Состояние капабилти safe_area (назначается на экземпляр) ---

    /** Наблюдатель высот шапки/футера (пересчёт --form-header-height/-footer). */
    panelHeightsObserver?: ResizeObserver | null;

    // --- Методы капабилти и пресетов (назначаются на экземпляр) ---

    /** Первичная расстановка окна (капабилти геометрии). */
    _setPosition?: () => void;
    /** Перевод окна из Flexbox в абсолютное позиционирование. */
    _disableAutoPositioning?: () => void;
    /** Обновление контроллера перемещения/ресайза. */
    _updateMoveAndResizeController?: () => void;

    /** Закрытие слоя с метаданными. */
    close(meta?: OverlayCloseMeta): void | Promise<void>;
}

/**
 * Методы капабилти: копируются на экземпляр слоя через `Object.assign`.
 */
export type OverlayCapabilityMethods = Record<string, (this: OverlayLike, ...args: never[]) => unknown>;

/**
 * Имена капабилти (ключи реестра `CAPABILITIES`).
 */
export type OverlayCapabilityName = "safe_area" | "swipe" | "window_geometry" | "popover_geometry";

/**
 * Состояние капабилти: кладётся на экземпляр слоя через `Object.assign`.
 */
export type OverlayCapabilityState = Record<string, unknown>;

/**
 * Контракт капабилти — необязательного куска поведения слоя.
 */
export interface OverlayCapability {
    /** Имя капабилти (ключ в реестре пресетов). */
    name: string;
    /** Порог срабатывания капабилти (используется свайпом). */
    threshold?: number;
    /** Начальные значения, которые кладутся на экземпляр. */
    state?: OverlayCapabilityState;
    /** Методы, которые копируются на экземпляр. */
    methods?: OverlayCapabilityMethods;
    /** Этап: до монтирования в DOM. */
    init?: (overlay: OverlayLike) => void;
    /** Этап: после монтирования, до `onOpen`. */
    onMounted?: (overlay: OverlayLike) => void;
    /** Этап: после `onOpen`. */
    afterOpen?: (overlay: OverlayLike) => void;
    /** Этап: при закрытии. */
    destroy?: (overlay: OverlayLike) => void;
}

/**
 * Контракт пресета типа оверлея (оформление, дефолты, анимации).
 */
export interface OverlayPreset {
    /** Имя типа (ключ вызова: `type: "modal"`). */
    name: string;
    /** Базовый класс, который вешается на контент (если не задан — нигде). */
    rootClass?: string;
    /** Селектор оверлея внутри обёртки. */
    overlaySelector: string;
    /** Навешивать ли `rootClass` на контент самому. */
    forceRootClass?: boolean;
    /** Отменяет ли `onBeforeOpen === false` открытие. */
    cancelOnBeforeOpen: boolean;
    /** Ждать ли завершения `onOpen` перед регистрацией в навигации. */
    awaitOnOpen: boolean;
    /** Имена капабилти этого типа. */
    capabilities: OverlayCapabilityName[];
    /** Селектор пунктов меню (только popover). */
    itemSelector?: string;
    /** Публичные методы типа, которые копируются на экземпляр. */
    methods?: OverlayCapabilityMethods;
    /** Дефолты настроек типа. */
    options: Partial<ResolvedOverlayOptions>;
    /** Предобработка настроек (мобильные переопределения). */
    prepare?: (options: OverlayOptions) => OverlayOptions;
    /** Шаблон обёртки. */
    template: () => HTMLElement;
    /** Подготовка обёртки перед монтированием. */
    initWrap?: (overlay: OverlayLike) => void;
    /** Анимация контента при открытии. */
    openContentAnimation?: (overlay: OverlayLike) => Animation | null;
    /** Анимация оверлея при открытии. */
    openOverlayAnimation?: (overlay: OverlayLike) => Animation | null;
    /** Анимации контента при закрытии. */
    closeAnimations?: (overlay: OverlayLike, meta: OverlayCloseMeta) => Animation[];
    /** Анимации оверлея при закрытии. */
    closeOverlayAnimations?: (overlay: OverlayLike, meta: OverlayCloseMeta) => Animation[];
    /** Есть ли что снимать с DOM. */
    canClose: (overlay: OverlayLike) => boolean;
}
