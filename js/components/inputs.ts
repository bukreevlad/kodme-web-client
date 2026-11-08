// Импортируем utils
import { Icons } from "../utils/icons.js";

// Импортируем helpers
import { applyAttributes } from "../utils/dom/apply_attributes.js";

/**
 * Цветовое назначение поля ввода (intent).
 */
export type InputIntent = "standard" | "primary" | "warning" | "danger" | "transparent";

/**
 * Форма поля ввода (shape).
 */
export type InputShape = "input" | "textarea" | "search";

/**
 * Размер поля ввода.
 */
export type InputSize = "sm" | "md" | "lg";

/** Атрибут: строка `"name=value"` / `"name"` либо объект `{name, value}`. */
export type InputAttribute = string | { name: string; value?: string };

/**
 * Настройки поля ввода.
 */
export interface InputsOptions {
    /** Тип input (text, email, password, number, etc.). */
    type?: string | undefined;
    /** Подсказка внутри поля. */
    placeholder?: string;
    /** Значение поля. */
    value?: string | undefined;
    /** Имя поля (для форм). */
    name?: string;
    /** Минимальное значение (number/range). */
    min?: string | undefined;
    /** Максимальное значение (number/range). */
    max?: string | undefined;
    /** DOM-id элемента. */
    id?: string;
    /** Цветовое назначение. */
    intent?: InputIntent | undefined;
    /** Форма. */
    shape?: InputShape | undefined;
    /** Размер. */
    size?: InputSize | undefined;
    /** Иконка слева (для search или с иконкой). */
    icon?: string | null;
    /** Позиция иконки: `left` или `right`. */
    iconPosition?: "left" | "right" | undefined;
    /** Дополнительные CSS-классы. */
    classes?: string[];
    /** Атрибуты элемента. */
    attributes?: InputAttribute[];
    /** Флаг для создания textarea. */
    isTextarea?: boolean;
    /** Количество строк для textarea. */
    rows?: number | undefined;
    /** Стартовое состояние ошибки валидации (aria-invalid + класс invalid). */
    invalid?: boolean | undefined;
    /** Текст ошибки под полем (показывается при invalid). */
    errorText?: string | undefined;
    /** Авто-высота textarea по содержимому (field-sizing: content). */
    autoSize?: boolean | undefined;
}

/**
 * Настройки поля ввода после применения дефолтов конструктора.
 */
interface ResolvedInputsOptions {
    /** Тип input. */
    type: string;
    /** Подсказка внутри поля. */
    placeholder: string;
    /** Значение поля. */
    value: string;
    /** Имя поля. */
    name: string;
    /** Минимальное значение. */
    min: string;
    /** Максимальное значение. */
    max: string;
    /** DOM-id элемента. */
    id: string;
    /** Цветовое назначение. */
    intent: InputIntent;
    /** Форма. */
    shape: InputShape;
    /** Размер. */
    size: InputSize;
    /** Иконка. */
    icon: string | null;
    /** Позиция иконки. */
    iconPosition: "left" | "right";
    /** Дополнительные CSS-классы. */
    classes: string[];
    /** Атрибуты элемента. */
    attributes: InputAttribute[];
    /** Флаг для создания textarea. */
    isTextarea: boolean;
    /** Количество строк для textarea. */
    rows: number;
    /** Стартовое состояние ошибки. */
    invalid: boolean;
    /** Текст ошибки под полем. */
    errorText: string;
    /** Авто-высота textarea. */
    autoSize: boolean;
}

export class Inputs {

    // Базовые стили для всех полей ввода
    static #baseStyles = "w-full transition-colors duration-200 focus-visible:outline-2 disabled:opacity-50 disabled:pointer-events-none outline-transparent placeholder:text-[var(--text-muted)]";

    // Варианты исполнения полей. Padding задаётся только размером (size),
    // форма (shape) отвечает за радиус и рамку
    static #variants: { intent: Record<InputIntent, string>; shape: Record<InputShape, string>; size: Record<InputSize, string> } = {
        intent: {
            standard: "bg-white border-[var(--color-black)]/10 hover:border-[var(--color-black)]/20 focus-visible:border-[var(--color-brand)] focus-visible:outline-[var(--color-brand)]/20 dark:bg-[var(--color-black)]/30 dark:border-[var(--color-white)]/10 dark:hover:border-[var(--color-white)]/20 dark:focus-visible:border-[var(--color-brand)] dark:focus-visible:outline-[var(--color-brand)]/20",
            primary: "bg-[var(--color-brand)]/50 border-[var(--color-brand)]/50 hover:border-[var(--color-brand)]/70 focus-visible:border-[var(--color-brand)] focus-visible:outline-[var(--color-brand)]/20 dark:bg-[var(--color-brand)]/20 dark:border-[var(--color-brand)]/50 dark:hover:border-[var(--color-brand)]/70 dark:focus-visible:border-[var(--color-brand)] dark:focus-visible:outline-[var(--color-brand)]/20",
            warning: "bg-amber-50/50 border-amber-200/50 hover:border-amber-300/70 focus-visible:border-amber-600 focus-visible:outline-amber-600/20 dark:bg-amber-900/20 dark:border-amber-700/50 dark:hover:border-amber-600/70 dark:focus-visible:border-amber-600 dark:focus-visible:outline-amber-500/20",
            danger: "bg-red-50/50 border-red-200/50 hover:border-red-300/70 focus-visible:border-red-600 focus-visible:outline-red-600/20 dark:bg-red-900/20 dark:border-red-700/50 dark:hover:border-red-600/70 dark:focus-visible:border-red-600 dark:focus-visible:outline-red-500/20",
            transparent: "bg-transparent border-transparent"
        },
        shape: {
            input: "rounded-md border",
            textarea: "rounded-md border resize-y",
            search: "rounded-full border pl-10" // С отступом для иконки поиска
        },
        // Размер задаёт только коробку (padding), текст базовый (text-base =
        // 14px) — поля не мельчают относительно корпуса. Межстрочный держим
        // штатным для text-base (1.5), а не ужимаем: тут бывают textarea и
        // редактор сообщений, которым нужен комфортный интерлиньяж
        size: {
            sm: "text-base px-2.5 py-1.5",
            md: "text-base p-2",
            lg: "text-base px-4 py-2.5"
        }
    };

    /** Настройки экземпляра (с дефолтами). */
    options: ResolvedInputsOptions;

    /** Внешний DOM-элемент: поле ввода либо обёртка (иконка и/или текст ошибки). */
    private _element: HTMLElement;

    /** Само поле ввода (input/textarea) — геттеры значения работают через него. */
    private _field: HTMLInputElement | HTMLTextAreaElement;

    /** Текст ошибки под полем (создаётся только при errorText или setInvalid с текстом). */
    private _errorElement: HTMLParagraphElement | null = null;

    /**
     * ***************************************************************************
     * @param {InputsOptions} options - Настройки поля ввода
     * ***************************************************************************
     */
    constructor({
        type = "text",
        placeholder = "",
        value = "",
        name = "",
        min = "",
        max = "",
        id = "",
        intent = "standard",
        shape = "input",
        size = "md",
        icon = null,
        iconPosition = "left",
        classes = [],
        attributes = [],
        isTextarea = false,
        rows = 4,
        invalid = false,
        errorText = "",
        autoSize = false
    }: InputsOptions = {}) {
        this.options = {
            type, placeholder, value, name, min, max, id, intent, shape, size,
            icon, iconPosition, classes, attributes, isTextarea, rows,
            invalid, errorText, autoSize
        };

        // Узлы создаются одним методом: конструктор должен инициализировать
        // свойства сам, а не делегировать это методу (строгая проверка типов)
        const created = this._createElement();
        this._element = created.outer;
        this._field = created.field;

        // Стартовое состояние ошибки применяется после сборки DOM
        if (invalid || errorText) this.setInvalid(invalid, errorText || undefined);
    }

    /**
     * ***************************************************************************
     * Создание DOM-дерева поля: само поле (+ опциональные обёртки иконки и
     * текста ошибки).
     * @returns {{ outer: HTMLElement; field: HTMLInputElement | HTMLTextAreaElement }} -
     *   Внешний элемент для разметки и реальное поле ввода.
     * ***************************************************************************
     */
    private _createElement(): { outer: HTMLElement; field: HTMLInputElement | HTMLTextAreaElement } {
        let element: HTMLInputElement | HTMLTextAreaElement;

        // Создаем input или textarea
        if (this.options.isTextarea) {
            const textarea = document.createElement("textarea");
            textarea.rows = this.options.rows;
            element = textarea;

            // Авто-высота по содержимому: нативное field-sizing не требует
            // ручного просчёта высоты (поддержка — современные браузеры)
            if (this.options.autoSize) element.classList.add("field-sizing-content");
        } else {
            const input = document.createElement("input");
            input.type = this.options.type || "text";
            if (this.options.min) input.min = this.options.min;
            if (this.options.max) input.max = this.options.max;
            element = input;
        }

        if (this.options.placeholder) element.placeholder = this.options.placeholder;
        if (this.options.value) element.value = this.options.value;

        // Атрибуты name и id
        if (this.options.name) element.name = this.options.name;
        if (this.options.id) element.id = this.options.id;

        // Определяем форму (для инпута с иконкой нужен специальный класс)
        let shapeClass = Inputs.#variants.shape[this.options.shape] || Inputs.#variants.shape.input;

        // Если есть иконка и это не textarea - добавляем отступ
        if (this.options.icon && !this.options.isTextarea) {
            if (this.options.iconPosition === "left") {
                shapeClass += " pl-10";
            } else if (this.options.iconPosition === "right") {
                shapeClass += " pr-10";
            }
        }

        // Сборка классов
        const variantClasses = [
            Inputs.#baseStyles,
            Inputs.#variants.intent[this.options.intent] || Inputs.#variants.intent.standard,
            shapeClass,
            Inputs.#variants.size[this.options.size] || Inputs.#variants.size.md,
            ...this.options.classes
        ].filter(Boolean).join(" ");

        element.classList.add(...variantClasses.split(" "));

        // Добавляем атрибуты
        applyAttributes(element, this.options.attributes);

        // Наружу отдаём внешний элемент (поле, поле с иконкой или колонку с
        // ошибкой), а реальное поле возвращаем отдельно — геттеры значения
        // работают через него
        let outer: HTMLElement = element;
        // Если есть иконка и это НЕ textarea - оборачиваем в div с иконкой
        if (this.options.icon && !this.options.isTextarea) {
            const wrapper = document.createElement("div");
            wrapper.className = "relative w-full";
            wrapper.appendChild(outer);

            // Создаем иконку
            const iconElement = Icons.icon(this.options.icon);
            if (iconElement) {
                const iconWrapper = document.createElement("div");
                const position = this.options.iconPosition === "left" ? "left" : "right";
                iconWrapper.className = `absolute inset-y-0 ${position}-0 flex items-center ${position === "left" ? "pl-3" : "pr-3"} pointer-events-none`;
                iconWrapper.appendChild(iconElement);
                wrapper.appendChild(iconWrapper);
            }

            outer = wrapper;
        }

        // Если задан текст ошибки — создаём подпись под полем и отдаём
        // колонку: поле (+ иконка) сверху, текст ошибки снизу
        if (this.options.errorText) {
            const column = document.createElement("div");
            column.className = "w-full flex flex-col";
            column.appendChild(outer);

            const error = document.createElement("p");
            error.setAttribute("data-input-error", "");
            // Ошибка должна объявляться скринридером при появлении
            error.setAttribute("aria-live", "polite");
            error.textContent = this.options.errorText;
            error.classList.add("hidden");
            column.appendChild(error);

            this._errorElement = error;
            outer = column;
        }

        return { outer, field: element };
    }

    /**
     * ***************************************************************************
     * Устанавливает или снимает состояние ошибки валидации.
     *
     * Синхронизирует всё сразу: визуальный класс `invalid` (глобальный стиль
     * в controls.css), `aria-invalid` для скринридера и видимость текста
     * ошибки. Текст можно передать динамически — он перезапишет статичный
     * `errorText`.
     * @param {boolean} on - Включить состояние ошибки.
     * @param {string} [message] - Текст ошибки (переопределяет errorText).
     * @returns {Inputs} - Текущий экземпляр (для цепочки вызовов).
     * ***************************************************************************
     */
    setInvalid(on: boolean, message?: string): this {

        const field = this._field;

        // Визуальный класс и aria-состояние
        field.classList.toggle("invalid", on);
        if (on) {
            field.setAttribute("aria-invalid", "true");
            field.setAttribute("data-invalid", "");
        } else {
            field.removeAttribute("aria-invalid");
            field.removeAttribute("data-invalid");
        }

        // Текст ошибки: показываем/скрываем подпись
        const error = this._errorElement;

        if (error) {
            if (message !== undefined) {
                error.textContent = message;
                this.options.errorText = message;
            }
            error.classList.toggle("hidden", !on);

            // Связываем подпись с полем для скринридера
            if (on) {
                if (!error.id) {
                    error.id = `input-error-${field.name || field.id || Math.random().toString(36).slice(2, 9)}`;
                }
                field.setAttribute("aria-describedby", error.id);
            } else {
                field.removeAttribute("aria-describedby");
            }
        }

        return this;
    }

    /**
     * ***************************************************************************
     * Геттеры
     * ***************************************************************************
     */
    get dom() { return this._element; }

    /** Само поле ввода (input/textarea), минуя обёртки. */
    get field() { return this._field; }
    get html() { return this._element.outerHTML; }

    // Получить значение: читаем с реального поля, даже если наружу
    // отдаётся обёртка с иконкой или текстом ошибки
    get value(): string {
        return this._field.value;
    }

    // Установить значение
    set value(val: string) {
        this._field.value = val;
    }

    // Умное приведение к строке
    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Статический метод создания input
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static create(options?: InputsOptions) {
        return new Inputs(options);
    }

    /**
     * ***************************************************************************
     * Статический метод создания testarea
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static textarea(options: InputsOptions = {}) {
        return new Inputs({ ...options, isTextarea: true, shape: "textarea" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input поиска
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static search(options: InputsOptions = {}) {
        return new Inputs({
            ...options,
            type: "search",
            shape: "search",
            icon: "search",
            iconPosition: "left"
        });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input email
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static email(options: InputsOptions = {}) {
        return new Inputs({ ...options, type: "email" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input number
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static number(options: InputsOptions = {}) {
        return new Inputs({ ...options, type: "number" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input password
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static password(options: InputsOptions = {}) {
        return new Inputs({ ...options, type: "password" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input primary
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static primary(options: InputsOptions = {}) {
        return new Inputs({ ...options, intent: "primary" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input warning
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static warning(options: InputsOptions = {}) {
        return new Inputs({ ...options, intent: "warning" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input danger
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static danger(options: InputsOptions = {}) {
        return new Inputs({ ...options, intent: "danger" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания input transparent
     * @param {InputsOptions} options - Опции
     * ***************************************************************************
     */
    static transparent(options: InputsOptions = {}) {
        return new Inputs({ ...options, intent: "transparent" });
    }

    /**
     * ***************************************************************************
     * Помечает или снимает ошибку валидации на поле.
     *
     * Универсальный вход для обработчиков валидации: принимает как компонент
     * `Inputs`, так и сырой DOM-элемент из шаблона (`querySelector`). Синхронно
     * обновляет визуальный класс `invalid`, `aria-invalid` и `data-invalid`.
     * @param {HTMLElement|Inputs|null} target - Поле, компонент или null.
     * @param {boolean} on - Включить или снять ошибку.
     * ***************************************************************************
     */
    static markInvalid(target: HTMLElement | Inputs | null | undefined, on: boolean): void {
        if (!target) return;

        if (target instanceof Inputs) {
            target.setInvalid(on);
            return;
        }

        target.classList.toggle("invalid", on);
        if (on) {
            target.setAttribute("aria-invalid", "true");
            target.setAttribute("data-invalid", "");
        } else {
            target.removeAttribute("aria-invalid");
            target.removeAttribute("data-invalid");

            // Подпись ошибки ищем по соседству (компонент оборачивает поле колонкой)
            const column = target.closest(".flex.flex-col");
            column?.querySelector<HTMLElement>("[data-input-error]")?.classList.add("hidden");
        }
    }

    /**
     * ***************************************************************************
     * Снимает состояние ошибки у поля по DOM-элементу или компоненту.
     *
     * Удобный короткий вызов `markInvalid(target, false)` для обработчиков.
     * @param {HTMLElement|Inputs|null} target - Поле, компонент или null.
     * ***************************************************************************
     */
    static clearInvalid(target: HTMLElement | Inputs | null | undefined): void {
        Inputs.markInvalid(target, false);
    }
}
