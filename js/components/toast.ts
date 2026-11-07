/**
 * ***************************************************************************
 * Импортируем config
 * ***************************************************************************
 */
import { scaleUp } from "../config/animations.js";

/**
 * ***************************************************************************
 * Импортируем utils
 * ***************************************************************************
 */
import { Icons } from "../utils/icons.js";
import { GestureController } from "../utils/gesture_controller.js";

/**
 * Тип тоста: определяет иконку статуса и цвет акцента. `default` —
 * нейтральное оформление без иконки.
 */
export type ToastType = "success" | "warning" | "error" | "info" | "default";

/**
 * Позиция тоста на экране.
 */
export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";

/**
 * Контент тоста: текст, объект Error либо готовый DOM-узел.
 */
export type ToastContent = string | Error | Node | null | undefined;

/**
 * Настройки тоста (см. также {@link Toast.DEFAULTS}).
 */
export interface ToastOptions {
    /** Тип оформления (неизвестный откатывается к дефолтному). */
    type?: ToastType | string;
    /** Длительность показа в мс (0 — не скрывается сам). */
    duration?: number | string;
    /** Позиция на экране (неизвестная откатывается к дефолтной). */
    position?: ToastPosition | string;
    /** Вызывается при полном закрытии тоста. */
    onClose?: () => void;
    /** ID для дедупликации: повторный тост с тем же id обновляет показанный. */
    id?: string | number | null;
    /** Закрывать ли тост по клику по плашке. */
    closeOnClick?: boolean;
    /** Ставить ли тост на паузу при наведении/фокусе. */
    pauseOnHover?: boolean;
    /** Показывать ли полосу оставшегося времени. */
    progress?: boolean;
    /** Включить ли свайп для закрытия. */
    swipe?: boolean;
    /** Максимум тостов одновременно на одной позиции. */
    maxInPosition?: number | string;
}

/**
 * Настройки после нормализации: все поля обязательны и приведены к
 * валидным значениям.
 */
export interface NormalizedToastOptions {
    /** Тип оформления. */
    type: ToastType;
    /** Длительность показа в мс. */
    duration: number;
    /** Позиция на экране. */
    position: ToastPosition;
    /** Коллбэк полного закрытия. */
    onClose: () => void;
    /** ID дедупликации. */
    id: string | number | null;
    /** Флаг закрытия по клику. */
    closeOnClick: boolean;
    /** Флаг паузы при наведении/фокусе. */
    pauseOnHover: boolean;
    /** Флаг полосы оставшегося времени. */
    progress: boolean;
    /** Флаг свайпа для закрытия. */
    swipe: boolean;
    /** Максимум тостов на позиции. */
    maxInPosition: number;
}

/**
 * Параметры закрытия тоста.
 */
export interface ToastCloseOptions {
    /** Убрать тост без анимации. */
    immediate?: boolean;
}

/**
 * Записанная подписка для последующей отписки.
 */
interface TrackedListener {
    /** Цель события. */
    target: EventTarget | null;
    /** Тип события. */
    type: string;
    /** Обработчик. */
    handler: EventListener;
    /** Опции addEventListener/removeEventListener. */
    options?: AddEventListenerOptions | undefined;
}

/**
 * ***************************************************************************
 * Класс Toast - всплывающее уведомление.
 *
 * Карточка с цветовым акцентом, иконкой статуса, кнопкой закрытия, полосой
 * оставшегося времени, свайпом для закрытия, паузой по наведению/фокусу,
 * дедупликацией по `id` и ограничением стопки. Вёрстка — `css/components/toast.css`.
 *
 * Старый вызов `new Toast(content, { type, duration, position, onClose })`
 * поддерживается полностью, но новый код зовёт хелперы:
 * `Toast.success()`, `Toast.error()`, `Toast.warning()`, `Toast.info()`.
 * ***************************************************************************
 */
export class Toast {

    /**
     * ***************************************************************************
     * Дефолтные настройки. Позиция `top-right` — де-факто стандарт проекта,
     * раньше дефолтом был `bottom-center`, поэтому вызовы без позиции
     * переводятся на явный.
     * ***************************************************************************
     */
    static DEFAULTS: NormalizedToastOptions = {
        type: "info",
        duration: 3000,
        position: "top-right",
        onClose: () => { },
        id: null,
        closeOnClick: true,
        pauseOnHover: true,
        progress: true,
        swipe: true,
        maxInPosition: 4
    };

    /**
     * ***************************************************************************
     * Предопределенные позиции для отображения тостов через Tailwind классы.
     * ***************************************************************************
     */
    static positions: Record<ToastPosition, string> = {
        "top-right": "fixed z-[9999] p-4 pt-[calc(1rem+var(--safeareatop))] pr-[calc(1rem+var(--safearearight))] flex flex-col pointer-events-none gap-2 top-[var(--safeareatop)] right-[var(--safearearight)] items-end",
        "top-left": "fixed z-[9999] p-4 pt-[calc(1rem+var(--safeareatop))] pl-[calc(1rem+var(--safearealeft))] flex flex-col pointer-events-none gap-2 top-[var(--safeareatop)] left-[var(--safearealeft)] items-start",
        "bottom-right": "fixed z-[9999] p-4 pb-[calc(1rem+var(--safeareabottom))] pr-[calc(1rem+var(--safearearight))] flex flex-col pointer-events-none gap-2 bottom-[var(--safeareabottom)] right-[var(--safearearight)] items-end",
        "bottom-left": "fixed z-[9999] p-4 pb-[calc(1rem+var(--safeareabottom))] pl-[calc(1rem+var(--safearealeft))] flex flex-col pointer-events-none gap-2 bottom-[var(--safeareabottom)] left-[var(--safearealeft)] items-start",
        "top-center": "fixed z-[9999] w-full p-4 pt-[calc(1rem+var(--safeareatop))] px-[calc(1rem+var(--safearealeft))] flex flex-col pointer-events-none gap-2 top-[var(--safeareatop)] left-1/2 -translate-x-1/2 items-center",
        "bottom-center": "fixed z-[9999] w-full p-4 pb-[calc(1rem+var(--safeareabottom))] px-[calc(1rem+var(--safearealeft))] flex flex-col pointer-events-none gap-2 bottom-[var(--safeareabottom)] left-1/2 -translate-x-1/2 items-center"
    };

    /**
     * ***************************************************************************
     * Описание типов: иконка статуса и цвет акцента. Цвета берём из
     * дизайн-системы (`--color-*`), а не из палитры Tailwind, чтобы тосты
     * совпадали с остальным интерфейсом в обеих темах.
     * ***************************************************************************
     */
    static types: Record<ToastType, { icon: string | null; accent: string; assertive: boolean }> = {
        success: { icon: "circle-check", accent: "var(--color-green)", assertive: false },
        warning: { icon: "alert-triangle", accent: "var(--color-yellow)", assertive: false },
        error: { icon: "alert-circle", accent: "var(--color-red)", assertive: true },
        info: { icon: "info-circle", accent: "var(--color-brand)", assertive: false },
        default: { icon: null, accent: "var(--text-secondary)", assertive: false }
    };

    /**
     * ***************************************************************************
     * Реестры: `instances` — дедупликация по `id`, `active` — живые тосты
     * (нужен для ограничения стопки).
     * ***************************************************************************
     */
    static instances = new Map<string | number, Toast>();
    static active = new Set<Toast>();

    /** Исходные настройки из вызова (для дедупликации). */
    rawOptions: ToastOptions;

    /** Нормализованные настройки. */
    options: NormalizedToastOptions;

    /** Контент: строка либо DOM-узел. */
    content: string | Node;

    /** Корневой элемент тоста. */
    toastElement: HTMLElement | null;

    /** Контейнер текста. */
    contentElement: HTMLElement | null;

    /** Полоса оставшегося времени (только при progress и duration > 0). */
    progressElement: HTMLElement | null;

    /** Контроллер жестов свайпа. */
    gesture: GestureController | null;

    /** Живая область позиции (общий контейнер тостов). */
    container: HTMLElement | null;

    /** Кнопка закрытия. */
    closeButton: HTMLElement | null;

    /** Флаг закрытия (для идемпотентности close). */
    isClosed: boolean;

    /** Флаг полного уничтожения. */
    isDestroyed: boolean;

    /** Флаг паузы таймера. */
    isPaused: boolean;

    /** Оставшееся время показа в мс. */
    remaining: number;

    /** Момент старта таймера (performance.now). */
    startedAt: number;

    /** Момент последнего свайпа (защита от двойного закрытия click'ом). */
    lastSwipeAt: number;

    /** Причины паузы (наведение, фокус, скрытая вкладка). */
    pauseReasons: Set<string>;

    /** Записанные подписки для отписки в _unbind. */
    listeners: TrackedListener[];

    /** Таймер закрытия. */
    closeTimer: ReturnType<typeof setTimeout> | null;

    /** Страховочный таймер закрытия (если анимация не доиграет). */
    closeFallbackTimer: ReturnType<typeof setTimeout> | null;

    /**
     * ***************************************************************************
     * Конструктор.
     * @param {ToastContent} content - Текст, объект Error или готовый узел.
     * @param {ToastOptions} [options] - Настройки (см. {@link Toast.DEFAULTS}).
     * @returns {Toast} Экземпляр тоста (при дедупликации — уже показанный).
     * ***************************************************************************
     */
    constructor(content: ToastContent, options: ToastOptions = {}) {
        // Исходные опции храним отдельно от нормализованных: при дедупликации
        // обновлять уже показанный тост нужно только тем, что реально
        // передали, иначе дефолты затрют его собственные настройки
        this.rawOptions = { ...(options || {}) };
        this.options = Toast._normalizeOptions(options);
        this.content = Toast._resolveContent(content);

        this.toastElement = null;
        this.contentElement = null;
        this.progressElement = null;
        this.gesture = null;
        this.container = null;
        this.closeButton = null;

        // Состояние закрытия: нужно, чтобы close() был идемпотентным,
        // а повторный тост с тем же id не подхватывал уходящий элемент
        this.isClosed = false;
        this.isDestroyed = false;
        this.isPaused = false;
        this.remaining = this.options.duration;
        this.startedAt = 0;
        this.lastSwipeAt = 0;

        // Причины паузы (наведение, фокус, скрытая вкладка) — их может быть
        // несколько одновременно, тост оживает только когда пусто
        this.pauseReasons = new Set();
        this.listeners = [];
        this.closeTimer = null;
        this.closeFallbackTimer = null;

        // Дедупликация: повторный тост с тем же id обновляет уже показанный,
        // а не плодит копии. Поэтому конструктор возвращает чужой экземпляр.
        const existing = this.options.id ? Toast.instances.get(this.options.id) : null;
        if (existing && !existing.isClosed) {
            return existing.update(content, this.rawOptions);
        }

        if (this.options.id) {
            Toast.instances.set(this.options.id, this);
        }

        this._createElements();
        this._bind();

        this.open();
    }

    /**
     * ***************************************************************************
     * Хелпер успеха: короткий «всё прошло» тост.
     * @param {ToastContent} content - Контент тоста.
     * @param {ToastOptions} [options] - Настройки (см. {@link Toast.DEFAULTS}).
     * @returns {Toast} Экземпляр тоста.
     * ***************************************************************************
     */
    static success(content: ToastContent, options: ToastOptions = {}) {
        return new Toast(content, { ...options, type: "success" });
    }

    /**
     * ***************************************************************************
     * Хелпер ошибки. Помечается `role="alert"`, чтобы программы чтения
     * с экрана произнесли текст сразу.
     * @param {ToastContent} content - Контент тоста.
     * @param {ToastOptions} [options] - Настройки (см. {@link Toast.DEFAULTS}).
     * @returns {Toast} Экземпляр тоста.
     * ***************************************************************************
     */
    static error(content: ToastContent, options: ToastOptions = {}) {
        return new Toast(content, { ...options, type: "error" });
    }

    /**
     * ***************************************************************************
     * Хелпер предупреждения.
     * @param {ToastContent} content - Контент тоста.
     * @param {ToastOptions} [options] - Настройки (см. {@link Toast.DEFAULTS}).
     * @returns {Toast} Экземпляр тоста.
     * ***************************************************************************
     */
    static warning(content: ToastContent, options: ToastOptions = {}) {
        return new Toast(content, { ...options, type: "warning" });
    }

    /**
     * ***************************************************************************
     * Хеллер обычного уведомления.
     * @param {ToastContent} content - Контент тоста.
     * @param {ToastOptions} [options] - Настройки (см. {@link Toast.DEFAULTS}).
     * @returns {Toast} Экземпляр тоста.
     * ***************************************************************************
     */
    static info(content: ToastContent, options: ToastOptions = {}) {
        return new Toast(content, { ...options, type: "info" });
    }

    /**
     * ***************************************************************************
     * Явный тост с полным набором настроек (в отличие от хелперов, не
     * переопределяет `type`).
     * @param {ToastContent} content - Контент тоста.
     * @param {ToastOptions} [options] - Настройки (см. {@link Toast.DEFAULTS}).
     * @returns {Toast} Экземпляр тоста.
     * ***************************************************************************
     */
    static custom(content: ToastContent, options: ToastOptions = {}) {
        return new Toast(content, options);
    }

    /**
     * ***************************************************************************
     * Проверка, что тип входит в предопределённые (type-guard).
     * @param {unknown} value - Проверяемое значение.
     * @returns {value is ToastType} - Является ли значение известным типом.
     * ***************************************************************************
     */
    static _isType(value: unknown): value is ToastType {
        return typeof value === "string" && value in Toast.types;
    }

    /**
     * ***************************************************************************
     * Проверка, что позиция входит в предопределённые (type-guard).
     * @param {unknown} value - Проверяемое значение.
     * @returns {value is ToastPosition} - Является ли значение известной позицией.
     * ***************************************************************************
     */
    static _isPosition(value: unknown): value is ToastPosition {
        return typeof value === "string" && value in Toast.positions;
    }

    /**
     * ***************************************************************************
     * Приводит настройки к валидному виду: неизвестная позиция и тип
     * не ломают тост, а откатываются к дефолтам.
     * @param {ToastOptions} [options] - Настройки из вызова.
     * @returns {NormalizedToastOptions} Нормализованные настройки.
     * ***************************************************************************
     */
    static _normalizeOptions(options: ToastOptions = {}): NormalizedToastOptions {
        const merged: ToastOptions = { ...Toast.DEFAULTS, ...(options || {}) };

        // Неизвестная позиция откатывается к дефолтной
        const position = Toast._isPosition(merged.position) ? merged.position : Toast.DEFAULTS.position;

        // Пустой тип равносилен нейтральному оформлению
        const rawType = merged.type ?? "";
        const type = Toast._isType(rawType) ? rawType : (rawType ? Toast.DEFAULTS.type : "default");

        // `duration: 0` — тост не скрывается сам, это осмысленный режим;
        // `?? NaN` нужен, чтобы пропущенное поле ушло в ту же ветку
        // «некорректное значение → дефолт», что и раньше (+undefined = NaN)
        const durationRaw = merged.duration ?? Number.NaN;
        const duration = Number.isFinite(+durationRaw) ? Math.max(0, +durationRaw) : Toast.DEFAULTS.duration;
        const maxInPositionRaw = merged.maxInPosition ?? Number.NaN;
        const maxInPosition = Math.max(1, +maxInPositionRaw || Toast.DEFAULTS.maxInPosition);

        // Некорректный коллбэк заменяем пустым, чтобы не падать на onClose
        const onClose = typeof merged.onClose === "function" ? merged.onClose : () => { };

        return {
            type,
            duration,
            position,
            onClose,
            id: merged.id ?? null,
            closeOnClick: merged.closeOnClick ?? Toast.DEFAULTS.closeOnClick,
            pauseOnHover: merged.pauseOnHover ?? Toast.DEFAULTS.pauseOnHover,
            progress: merged.progress ?? Toast.DEFAULTS.progress,
            swipe: merged.swipe ?? Toast.DEFAULTS.swipe,
            maxInPosition
        };
    }

    /**
     * ***************************************************************************
     * Приводит контент к строке или узлу. Раньше `new Toast(error)` молча
     * показывал пустую плашку: объект Error не был ни строкой, ни элементом.
     * @param {ToastContent} content - Исходный контент.
     * @returns {string|Node} Готовый к вставке контент.
     * ***************************************************************************
     */
    static _resolveContent(content: ToastContent): string | Node {
        if (content instanceof Error) {
            return content.message || String(content);
        }

        if (content instanceof HTMLElement || content instanceof Node) {
            return content;
        }

        if (content === null || content === undefined) {
            return "";
        }

        return String(content);
    }

    /**
     * ***************************************************************************
     * Создаёт контейнер позиции (живую область) и сам тост.
     * @returns {void}
     * ***************************************************************************
     */
    _createElements() {
        const { position } = this.options;
        const containerId = `cdm-toast-container-${position}`;
        const existingContainer = document.getElementById(containerId);

        // Живая область (контейнер) живёт всё время работы приложения: если
        // удалять её, когда она пуста, то первый тост на позиции попадает
        // в только что созданную область и часть программ чтения с экрана
        // его молча пропускает
        this.container = existingContainer || this._templateContainer(containerId, position);
        if (!existingContainer) {
            document.body.appendChild(this.container);
        }

        this.toastElement = this._templateToast();

        // Акцент и длительность нужны и CSS, и анимации прогресс-бара
        this.toastElement.style.setProperty("--toast-accent", Toast.types[this.options.type].accent);
        this.toastElement.style.setProperty("--toast-duration", `${this.options.duration}ms`);

        // Сторона въезда выезда: раньше все позиции анимировались одинаково,
        // и тост на левом краю выезжал из-за правого
        const [vertical, side] = position.split("-");
        this.toastElement.dataset.vertical = vertical;
        this.toastElement.dataset.side = side === "left" || side === "right" ? side : "center";
        this.toastElement.dataset.state = "enter";
        this.toastElement.dataset.paused = "false";

        // Ошибки читаем настойчиво, остальное — спокойно
        this.toastElement.setAttribute("role", Toast.types[this.options.type].assertive ? "alert" : "status");

        this._renderContent();
        this._renderProgress();
        this._renderIcon();
        this._renderCloseButton();

        // Живая область должна существовать ДО того, как в неё что-то
        // вставили, иначе часть программ чтения с экрана молча пропустит
        // первый тост на позиции. Поэтому в свежий контейнер тост
        // кладём на следующем кадре
        if (existingContainer) {
            this._append();
        } else {
            requestAnimationFrame(() => this._append());
        }

        Toast.active.add(this);
        this._trimStack();
    }

    /**
     * ***************************************************************************
     * Вставляет тост в контейнер: сверху позиции — снизу, иначе — сверху,
     * чтобы новый тост всегда был ближе к краю экрана.
     * @returns {void}
     * ***************************************************************************
     */
    _append() {
        const container = this.container;
        const toastElement = this.toastElement;
        if (!container || !toastElement) return;

        if (this.options.position.startsWith("top")) {
            container.appendChild(toastElement);
        } else {
            container.prepend(toastElement);
        }
    }

    /**
     * ***************************************************************************
     * Наполняет контент тоста. Строка идёт через `textContent`: раньше
     * использовался `innerHTML`, и текст из сервера или от бота был
     * потенциальным XSS-вектором.
     * @returns {void}
     * ***************************************************************************
     */
    _renderContent() {
        // Элементы создаются в _createElements(): без тоста рендерить нечего
        const toastElement = this.toastElement;
        if (!toastElement) return;

        const contentElement = toastElement.querySelector<HTMLElement>(".cdm-toast-content");
        if (!contentElement) return;

        this.contentElement = contentElement;

        if (this.content instanceof Node) {
            contentElement.replaceChildren(this.content);
        } else {
            contentElement.textContent = this.content;
        }
    }

    /**
     * ***************************************************************************
     * Добавляет иконку статуса. Для нейтрального тоста икона не нужна —
     * в тексте может быть что угодно, а визуальный шум лишний.
     * @returns {void}
     * ***************************************************************************
     */
    _renderIcon() {
        const iconName = Toast.types[this.options.type].icon;
        if (!iconName) return;

        const icon = Icons.icon(iconName, { settings: { size: 16 } });
        if (!icon) return;

        // Разметка — наши строки: контейнер иконки в шаблоне всегда есть
        const wrapper = this.toastElement?.querySelector<HTMLElement>(".cdm-toast-icon");
        if (!wrapper) return;

        wrapper.appendChild(icon);
    }

    /**
     * ***************************************************************************
     * Добавляет крестик. Это единственный элемент тоста, доступный с клавиатуры,
     * поэтому подпись берётся из локализации.
     * @returns {void}
     * ***************************************************************************
     */
    _renderCloseButton() {
        // Разметка — наши строки: кнопка закрытия в шаблоне всегда есть
        const button = this.toastElement?.querySelector<HTMLElement>(".cdm-toast-close");
        if (!button) return;

        const icon = Icons.icon("x", { settings: { size: 14 } });

        button.setAttribute("aria-label", window._lc?.components?.toast?.close ?? "Закрыть");
        if (icon) button.appendChild(icon);

        this.closeButton = button;
    }

    /**
     * ***************************************************************************
     * Добавляет полосу оставшегося времени. При `duration: 0` тост не
     * скрывается сам, поэтому полоса вводила бы в заблуждение.
     * @returns {void}
     * ***************************************************************************
     */
    _renderProgress() {
        // Разметка — наши строки: полоса в шаблоне всегда есть
        const progress = this.toastElement?.querySelector<HTMLElement>(".cdm-toast-progress");
        if (!progress) return;

        // При `duration: 0` тост не скрывается сам, а при `progress: false`
        // полоса просто лишняя — убираем её из разметки, иначе анимация
        // ширины всё равно отработает
        if (!this.options.progress || this.options.duration <= 0) {
            progress.remove();
            return;
        }

        this.progressElement = progress;
    }

    /**
     * ***************************************************************************
     * Ограничивает стопку: лишние (самые старые) тосты уходят сразу, без
     * анимации — серия ошибок иначе закрывает весь экран.
     * @returns {void}
     * ***************************************************************************
     */
    _trimStack() {
        const stack = [...Toast.active]
            .filter(toast => !toast.isClosed && toast.options.position === this.options.position);

        while (stack.length > this.options.maxInPosition) {
            stack.shift()?.close({ immediate: true });
        }
    }

    /**
     * ***************************************************************************
     * Разметка контейнера позиции: это «живая область» — всё, что в неё
     * попадёт, программы чтения с экрана произнесут вслух. Без неё тост
     * об ошибке для незрячего пользователя — просто молчание.
     * @param {string} id - Идентификатор контейнера.
     * @param {ToastPosition} positionKey - Ключ позиции.
     * @returns {HTMLElement} Контейнер.
     * ***************************************************************************
     */
    _templateContainer(id: string, positionKey: ToastPosition) {
        const div = document.createElement("div");
        div.id = id;
        div.setAttribute("role", "status");
        div.setAttribute("aria-live", "polite");
        div.setAttribute("aria-atomic", "false");
        div.className = Toast.positions[positionKey];

        return div;
    }

    /**
     * ***************************************************************************
     * Разметка тоста. Собирается нашими же строками, поэтому innerHTML
     * здесь безопасен: данные пользователя попадают только через textContent.
     * @returns {HTMLElement} Элемент тоста.
     * ***************************************************************************
     */
    _templateToast() {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
            <div class="cdm-toast pointer-events-auto relative flex w-fit min-w-[13rem] max-w-[calc(100vw-2rem)] items-start gap-2.5 overflow-hidden rounded-xl border py-2.5 pr-2 pl-3 text-left text-sm leading-snug backdrop-blur-md select-none">
                <span class="cdm-toast-icon mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full" aria-hidden="true"></span>
                <div class="cdm-toast-content min-w-0 flex-1 break-words"></div>
                <button class="cdm-toast-close -mt-0.5 -mr-0.5 shrink-0 cursor-pointer rounded-md p-1 transition-colors duration-150" type="button"></button>
                <span class="cdm-toast-progress absolute inset-x-0 bottom-0 h-0.5" aria-hidden="true"></span>
            </div>
        `;

        // invariant: разметка выше — наши же строки, первым узлом всегда
        // div-тост; если это не так, шаблон сломан и дальше падать будет в любом случае
        const element = wrapper.firstElementChild;
        if (!(element instanceof HTMLElement)) {
            throw new TypeError("Toast: разметка тоста не содержит корневого элемента");
        }

        return element;
    }

    /**
     * ***************************************************************************
     * Вешает обработчики: закрытие, пауза по наведению/фокусу, свайп,
     * переключение анимаций и остановка таймера в скрытой вкладке.
     * @returns {void}
     * ***************************************************************************
     */
    _bind() {
        // Контекст: элемент создаётся в _createElements() до вызова
        const toast = this.toastElement;
        if (!toast) return;

        // Смена состояния enter → open и open → closing по событию анимации.
        // Слушаем на самом тосте и фильтруем `event.target`: анимация
        // прогресс-бара тоже всплывает сюда с тем же событием
        this._listen(toast, "animationend", (event) => {
            if (event.target !== toast || this.isClosed) return;

            if (toast.dataset.state === "enter") {
                toast.dataset.state = "open";
            } else if (toast.dataset.state === "closing") {
                this._destroy();
            }
        });

        // Клик по плашке закрывает тост, но клик по ссылке или кнопке
        // внутри контента — это действие пользователя, а не закрытие
        this._listen(toast, "click", (event) => {
            if (!this.options.closeOnClick) return;
            // invariant: клик всегда исходит от элемента дерева документа
            if (!(event.target instanceof Element)) return;
            if (event.target.closest("a, button, input, [role='button']")) return;

            // После свайпа браузер досылает click — не закрываем тост дважды
            if (Date.now() - this.lastSwipeAt < 300) return;

            this.close();
        });

        this._listen(this.closeButton, "click", (event) => {
            event.stopPropagation();
            this.close();
        });

        // Escape снимает тост, если фокус внутри него
        this._listen(toast, "keydown", (event) => {
            // invariant: событие keydown всегда несёт KeyboardEvent
            if (event instanceof KeyboardEvent && event.key === "Escape") this.close();
        });

        // Пауза: наведение мышью и фокус с клавиатуры дают время прочитать
        if (this.options.pauseOnHover) {
            this._listen(toast, "mouseenter", () => this._pause("hover"));
            this._listen(toast, "mouseleave", () => this._resume("hover"));
            this._listen(toast, "focusin", () => this._pause("focus"));
            this._listen(toast, "focusout", () => this._resume("focus"));
        }

        // Свайп для закрытия: горизонтальный, вертикальный жест остаётся
        // прокрутке страницы
        if (this.options.swipe) {
            this._setupSwipe();
        }

        this._bindTimer();
    }

    /**
     * ***************************************************************************
     * Таймер и скрытая вкладка: ушедшей в фон вкладке тост не нужен, но и
     * сгорать в фоне он не должен — иначе пользователь вернётся и не увидит
     * ошибку, которую уже не прочитать.
     * @returns {void}
     * ***************************************************************************
     */
    _bindTimer() {
        this._listen(document, "visibilitychange", () => {
            if (document.hidden) {
                this._pause("hidden");
            } else {
                this._resume("hidden");
            }
        });
    }

    /**
     * ***************************************************************************
     * Настраивает свайп через GestureController: тост едет за пальцем,
     * короткий свайп отменяется с возвратом, длинный — закрывает тост.
     * @returns {void}
     * ***************************************************************************
     */
    _setupSwipe() {
        // Контекст: элемент создаётся в _createElements() до вызова;
        // локальная ссылка нужна и для сужения, и чтобы колбэки жестов
        // не читали поле, которое _destroy() может обнулить
        const toast = this.toastElement;
        if (!toast) return;

        this.gesture = new GestureController(toast, {
            threshold: 8,
            swipe: {
                directions: ["left", "right"],
                commitDistance: 60,
                onStart: () => {
                    toast.dataset.swiping = "true";
                },
                onMove: (dx) => {
                    toast.style.transform = `translateX(${dx}px)`;
                    // Чем дальше уехал тост, тем прозрачнее он становится
                    toast.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / 240));
                },
                onCommit: () => {
                    this.lastSwipeAt = Date.now();
                    // Тост уже «уехал» за пальцем, анимация выезда его дёрнула бы
                    // назад — удаляем сразу
                    toast.dataset.swiping = "false";
                    this.close({ immediate: true });
                },
                onCancel: () => {
                    toast.dataset.swiping = "false";
                    toast.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out";
                    toast.style.transform = "";
                    toast.style.opacity = "";

                    setTimeout(() => {
                        if (this.isClosed || !this.toastElement) return;
                        this.toastElement.style.transition = "";
                    }, 260);
                }
            }
        });
    }

    /**
     * ***************************************************************************
     * Регистрирует обработчик, чтобы снять его в `_unbind`.
     * @param {EventTarget|null} target - Цель события.
     * @param {string} type - Тип события.
     * @param {EventListener} handler - Обработчик.
     * @param {AddEventListenerOptions} [options] - Опции addEventListener.
     * @returns {void}
     * ***************************************************************************
     */
    _listen(target: EventTarget | null, type: string, handler: EventListener, options?: AddEventListenerOptions) {
        if (!target) return;

        target.addEventListener(type, handler, options);
        this._track(target, type, handler, options);
    }

    /**
     * ***************************************************************************
     * Запоминает подписку для последующей отписки.
     * @param {EventTarget|null} target - Цель события.
     * @param {string} type - Тип события.
     * @param {EventListener} handler - Обработчик.
     * @param {AddEventListenerOptions} [options] - Опции addEventListener.
     * @returns {void}
     * ***************************************************************************
     */
    _track(target: EventTarget | null, type: string, handler: EventListener, options?: AddEventListenerOptions) {
        this.listeners.push({ target, type, handler, options });
    }

    /**
     * ***************************************************************************
     * Снимает все подписки и уничтожает контроллер жестов: он слушает
     * `document`, и без destroy() эти обработчики оставались бы висеть
     * на каждом закрытом тосте.
     * @returns {void}
     * ***************************************************************************
     */
    _unbind() {
        this.listeners.forEach(({ target, type, handler, options }) => {
            target?.removeEventListener(type, handler, options);
        });
        this.listeners = [];

        this.gesture?.destroy();
        this.gesture = null;
    }

    /**
     * ***************************************************************************
     * Ставит тост на паузу по одной из причин. Причины копятся: если тост
     * наведён и вкладка скрыта, он оживёт только когда исчезнут обе.
     * @param {string} reason - Причина паузы.
     * @returns {void}
     * ***************************************************************************
     */
    _pause(reason: string) {
        if (this.options.duration <= 0 || this.isClosed) return;

        // Элемент есть только у показанного тоста — пауза ему не нужна
        const toast = this.toastElement;
        if (!toast) return;

        this.pauseReasons.add(reason);
        if (this.isPaused) return;

        this.isPaused = true;
        this.remaining = Math.max(0, this.remaining - (performance.now() - this.startedAt));
        this._clearTimer();
        toast.dataset.paused = "true";
    }

    /**
     * ***************************************************************************
     * Снимает паузу по одной из причин.
     * @param {string} reason - Причина паузы.
     * @returns {void}
     * ***************************************************************************
     */
    _resume(reason: string) {
        if (!this.isPaused) return;

        // Элемент есть только у показанного тоста — без него возобновлять нечего
        const toast = this.toastElement;
        if (!toast) return;

        this.pauseReasons.delete(reason);
        if (this.pauseReasons.size > 0) return;

        this.isPaused = false;
        toast.dataset.paused = "false";
        this._startTimer();
    }

    /**
     * ***************************************************************************
     * Показывает тост и запускает таймер.
     * @returns {void}
     * ***************************************************************************
     */
    open() {
        if (!this.toastElement) {
            this._createElements();
            this._bind();
        }

        this.remaining = this.options.duration;
        this._startTimer();
    }

    /**
     * ***************************************************************************
     * Запускает таймер закрытия на оставшееся время.
     * @returns {void}
     * ***************************************************************************
     */
    _startTimer() {
        this._clearTimer();

        if (this.options.duration <= 0) return;

        this.startedAt = performance.now();
        this.closeTimer = setTimeout(() => this.close(), this.remaining);
    }

    /**
     * ***************************************************************************
     * Сбрасывает таймер закрытия.
     * @returns {void}
     * ***************************************************************************
     */
    _clearTimer() {
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
    }

    /**
     * ***************************************************************************
     * Перезапускает анимацию прогресс-бара (нужно при смене длительности).
     * @returns {void}
     * ***************************************************************************
     */
    _restartProgress() {
        if (!this.progressElement) return;

        this.progressElement.style.animation = "none";

        // Без reflow браузер не заметит смены и анимация не перезапустится
        void this.progressElement.offsetWidth;

        this.progressElement.style.removeProperty("animation");
    }

    /**
     * ***************************************************************************
     * Обновляет уже показанный тост: контент, тип и таймер. Используется
     * дедупликацией по `id` — вместо второй одинаковой плашки пользователь
     * видит одну с обновлённым текстом.
     * @param {ToastContent} [content] - Новый контент.
     * @param {ToastOptions} [options] - Новые настройки (тип, длительность).
     * @returns {Toast} Этот же экземпляр.
     * ***************************************************************************
     */
    update(content?: ToastContent, options: ToastOptions = {}) {
        if (this.isClosed || this.isDestroyed) return this;

        // Обновлять можно только показанный тост (элемент уже создан)
        const toast = this.toastElement;
        if (!toast) return this;

        if (content !== undefined && content !== null) {
            this.content = Toast._resolveContent(content);
            this._renderContent();
        }

        // Тип и длительность меняем только явно переданными значениями,
        // иначе повторный тост с id сбросил бы настройки первого
        if (options.type && options.type !== this.options.type && Toast._isType(options.type)) {
            this.options.type = options.type;
            toast.style.setProperty("--toast-accent", Toast.types[options.type].accent);
            toast.setAttribute("role", Toast.types[options.type].assertive ? "alert" : "status");
        }

        if (options.duration !== undefined && +options.duration !== this.options.duration) {
            this.options.duration = Math.max(0, +options.duration);
            toast.style.setProperty("--toast-duration", `${this.options.duration}ms`);
        }

        this.remaining = this.options.duration;
        this.isPaused = false;
        this.pauseReasons.clear();
        toast.dataset.paused = "false";

        this._restartProgress();
        this._startTimer();

        // Подсветим обновление, иначе пользователь не заметит смену текста
        toast.animate(scaleUp.animation, scaleUp.settings);

        return this;
    }

    /**
     * ***************************************************************************
     * Закрывает тост. Идемпотентно: повторный вызов (например, из двух
     * обработчиков подряд) не дублирует анимацию и `onClose`.
     * @param {ToastCloseOptions} [options] - Параметры закрытия.
     * @returns {Toast} Этот же экземпляр.
     * ***************************************************************************
     */
    close({ immediate = false }: ToastCloseOptions = {}) {
        if (this.isClosed) return this;

        this.isClosed = true;
        this._clearTimer();

        if (this.options.id) {
            Toast.instances.delete(this.options.id);
        }

        if (!this.toastElement) {
            this._destroy();
            return this;
        }

        if (immediate) {
            this._destroy();
            return this;
        }

        this.toastElement.dataset.state = "closing";

        // Страховка на случай, если анимация не доиграет (вкладка в фоне,
        // prefers-reduced-motion с отключёнными анимациями)
        this.closeFallbackTimer = setTimeout(() => this._destroy(), 500);
    }

    /**
     * ***************************************************************************
     * Полностью убирает тост: снимает подписки, удаляет узел и вызывает
     * `onClose` ровно один раз.
     * @returns {void}
     * ***************************************************************************
     */
    _destroy() {
        if (this.isDestroyed) return;

        this.isDestroyed = true;
        this.isClosed = true;

        this._clearTimer();

        if (this.closeFallbackTimer) {
            clearTimeout(this.closeFallbackTimer);
            this.closeFallbackTimer = null;
        }

        this._unbind();

        this.toastElement?.remove();
        this.toastElement = null;
        this.contentElement = null;
        this.progressElement = null;
        this.container = null;

        Toast.active.delete(this);

        this.options.onClose();
    }

    /**
     * ***************************************************************************
     * Возвращает корневой узел тоста (например, чтобы вставить в него
     * дополнительные элементы после создания).
     * @returns {HTMLElement|null} Элемент тоста.
     * ***************************************************************************
     */
    getElement() {
        return this.toastElement;
    }
}
