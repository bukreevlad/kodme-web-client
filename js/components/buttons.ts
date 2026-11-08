// Импортируем utils
import { Icons } from "../utils/icons.js";

// Импортируем helpers
import { applyAttributes } from "../utils/dom/apply_attributes.js";

/**
 * Цветовое назначение кнопки (intent).
 * `link` — текстовая кнопка-ссылка без фона (для «Войти», «Забыли пароль?»).
 */
export type ButtonIntent = "standard" | "primary" | "warning" | "danger" | "transparent" | "link";

/**
 * Форма кнопки (shape).
 */
export type ButtonShape = "none" | "square" | "circle";

/**
 * Размер кнопки. Задаёт отступы и высоту; у круглых кнопок — padding иконки.
 */
export type ButtonSize = "sm" | "md" | "lg";

/** Атрибут: строка `"name=value"` / `"name"` либо объект `{name, value}`. */
export type ButtonAttribute = string | { name: string; value?: string };

/** Параметры вызова `Icons.icon` (выведены из сигнатуры утилиты иконок). */
type IconCallOptions = NonNullable<Parameters<typeof Icons.icon>[1]>;

/**
 * Иконка в виде объекта: имя плюс настройки Tabler.
 */
export interface ButtonIcon {
    /** Имя иконки из утилиты Icons. */
    name: string;
    /** Настройки Tabler (stroke, size, color, filled, style). */
    settings?: IconCallOptions["settings"];
    /** Дополнительные CSS-классы. */
    classes?: IconCallOptions["classes"];
    /** Кастомные атрибуты корня SVG. */
    attributes?: IconCallOptions["attributes"];
}

/**
 * Настройки кнопки.
 */
export interface ButtonsOptions {
    /** Текст кнопки. */
    text?: string | undefined;
    /** Иконка: имя либо объект с именем и настройками. */
    icon?: string | ButtonIcon | null | undefined;
    /** Цветовое назначение. */
    intent?: ButtonIntent | undefined;
    /** Форма. */
    shape?: ButtonShape | undefined;
    /** Размер. */
    size?: ButtonSize | undefined;
    /** Стартовое состояние загрузки (спиннер + disabled + aria-busy). */
    loading?: boolean | undefined;
    /** Дополнительные CSS-классы. */
    classes?: string[];
    /** Атрибуты кнопки. */
    attributes?: ButtonAttribute[];
}

/**
 * Настройки кнопки после применения дефолтов конструктора.
 */
interface ResolvedButtonsOptions {
    /** Текст кнопки. */
    text?: string | undefined;
    /** Иконка. */
    icon?: string | ButtonIcon | null | undefined;
    /** Цветовое назначение. */
    intent: ButtonIntent;
    /** Форма. */
    shape: ButtonShape;
    /** Размер. */
    size: ButtonSize;
    /** Стартовое состояние загрузки. */
    loading: boolean;
    /** Дополнительные CSS-классы. */
    classes: string[];
    /** Атрибуты кнопки. */
    attributes: ButtonAttribute[];
}

// Класс
export class Buttons {

    // Декларативная карта стилей в духе Tailwind v4 (базовые утилиты).
    // Тени — токены `shadow-xs` из @theme, а не захардкоженные literal'ы.
    // Прозрачная рамка (border-transparent) компенсирует 1px бордюр полей
    // ввода и выравнивает высоту кнопок с полями; рамка невидима — фон
    // заливает её область
    static #baseStyles = "border border-transparent flex items-center justify-center gap-2 font-semibold transition duration-150 cursor-pointer outline-transparent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[.98]";

    // Варианты кнопок
    static #variants: {
        intent: Record<ButtonIntent, string>;
        shape: Record<ButtonShape, string>;
        size: Record<ButtonSize, string>;
        circleSize: Record<ButtonSize, string>;
    } = {
        intent: {
            standard: "bg-[var(--color-black)]/10 hover:bg-[var(--color-black)]/20 active:bg-[var(--color-black)]/30 dark:bg-[var(--color-white)]/5 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15",
            primary: "bg-[var(--color-brand)] hover:brightness-110 active:brightness-95 text-white shadow-xs focus-visible:outline-[var(--color-brand)]",
            warning: "bg-[var(--color-yellow)] hover:brightness-110 active:brightness-95 text-white shadow-xs dark:bg-[var(--color-yellow)] focus-visible:outline-[var(--color-yellow)]",
            danger: "bg-[var(--color-red)] hover:brightness-110 active:brightness-95 text-white shadow-xs dark:bg-[var(--color-red)] focus-visible:outline-[var(--color-red)]",
            transparent: "bg-transparent hover:bg-[var(--color-black)]/10 active:bg-[var(--color-black)]/15 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15",
            // Текстовая кнопка-ссылка: без фона и отступов, подчёркивание на hover
            link: "text-[var(--color-brand)] hover:underline underline-offset-2 rounded px-0 py-0"
        },
        shape: {
            // padding живёт в size: shape отвечает только за радиус
            none: "rounded-none",
            square: "rounded-md",
            circle: "rounded-full aspect-square"
        },
        // Размер задаёт только коробку (padding/высоту), текст базовый
        // (text-base = 14px) — кнопки не мельчают относительно корпуса и не
        // зависят от шрифта родителя. Межстрочный берём штатный для text-base
        // (1.5), как у полей ввода, — тогда высота кнопки = высоте поля с
        // тем же padding (рамку полю добавляет прозрачный бордюр из baseStyles)
        size: {
            sm: "text-base px-2.5 py-1.5 min-h-8",
            md: "text-base px-3 py-2 min-h-9",
            lg: "text-base px-4 py-2.5 min-h-10"
        },
        // У круглых кнопок отступы задают размер кружка под иконку
        // (высоты выровнены с квадратными кнопками того же размера)
        circleSize: {
            sm: "p-1.5 min-h-8",
            md: "p-2 min-h-9",
            lg: "p-2.5 min-h-10"
        }
    };

    /** Настройки экземпляра (с дефолтами). */
    options: ResolvedButtonsOptions;

    /** DOM-элемент кнопки. */
    private _element: HTMLButtonElement;

    /** Флаг состояния загрузки. */
    private _loading = false;

    /** Значение disabled до включения загрузки (чтобы не «включить» заблокированную кнопку). */
    private _disabledBeforeLoading = false;

    /**
     * ***************************************************************************
     * @param {ButtonsOptions} options - Настройки кнопки
     * ***************************************************************************
     */
    constructor({
        text,
        icon,
        intent = "standard",
        shape = "square",
        size = "md",
        loading = false,
        classes = [],
        attributes = []
    }: ButtonsOptions = {}) {
        this.options = { text, icon, intent, shape, size, loading, classes, attributes };
        this._element = this._createElement();

        // Стартовое состояние загрузки применяется после сборки элемента
        if (loading) this.setLoading(true);
    }

    /**
     * ***************************************************************************
     * Создание элемента кнопки
     * @returns {HTMLButtonElement}
     * ***************************************************************************
     */
    private _createElement(): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button"; // Правильный дефолт для кнопок в формах

        // Текст
        if (this.options.text) button.textContent = this.options.text;

        // Иконка
        if (this.options.icon) {

            let iconElement: SVGSVGElement | null = null;

            // Проверяем, является ли icon объектом
            if (typeof this.options.icon === "object" && this.options.icon !== null) {
                // Если объект - передаем name и настройки
                iconElement = Icons.icon(this.options.icon.name, {
                    settings: this.options.icon.settings || {},
                    classes: this.options.icon.classes || [],
                    attributes: this.options.icon.attributes || {}
                });
            } else if (typeof this.options.icon === "string") {
                // Если строка - передаем только имя
                iconElement = Icons.icon(this.options.icon);
            }

            // Добавляем иконку в кнопку
            if (iconElement) {
                iconElement.setAttribute("data-button-icon", "");
                button.prepend(iconElement);
            }

        }

        // Сборка классов (Tailwind v4 ориентирован на чистый CSS, пробелы склеивают утилиты).
        // У intent "link" форма и размер не применяются: текстовая кнопка не должна
        // наследовать отступы и фон квадратной кнопки
        const isLink = this.options.intent === "link";

        const variantClasses = [
            Buttons.#baseStyles,
            Buttons.#variants.intent[this.options.intent] || Buttons.#variants.intent.standard,
            ...(!isLink ? [
                Buttons.#variants.shape[this.options.shape] || Buttons.#variants.shape.square,
                this.options.shape === "circle"
                    ? Buttons.#variants.circleSize[this.options.size]
                    : Buttons.#variants.size[this.options.size]
            ] : []),
            ...this.options.classes
        ].filter(Boolean).join(" ");

        // token-based classList.add работает быстрее, если передавать массив через spread
        button.classList.add(...variantClasses.split(" "));

        // Атрибуты (современный dataset или setAttribute)
        applyAttributes(button, this.options.attributes);

        return button;
    }

    /**
     * ***************************************************************************
     * Динамическая замена или добавление иконки
     * @param {string|null} iconName - Имя иконки из утилит Icons
     * @param {IconCallOptions} [options] - Опции иконки (settings, classes, attributes)
     * ***************************************************************************
     */
    setIcon(iconName: string | null, options: IconCallOptions = {
        settings: {},
        classes: [],
        attributes: {}
    }) {

        // Обновляем имя иконки в опциях инстанса
        this.options.icon = iconName;

        // Ищем старую иконку по маркеру
        const oldIcon = this._element.querySelector("[data-button-icon]");

        // Если передали пустую строку или null — удаляем старую иконку
        if (!iconName) {
            oldIcon?.remove();
            return this;
        }

        // Создаем новый элемент иконки
        const newIconElement = Icons.icon(iconName, options);
        if (!newIconElement) return this;

        // Обязательно вешаем маркер на новую иконку
        newIconElement.setAttribute("data-button-icon", "");

        if (oldIcon) {
            oldIcon.replaceWith(newIconElement);
        } else {
            this._element.prepend(newIconElement);
        }

        return this;

    }

    /**
     * ***************************************************************************
     * Включает или выключает состояние загрузки.
     *
     * В состоянии загрузки: кнопка заблокирована (`disabled`), помечена
     * `aria-busy="true"` и показывает вращающийся спиннер слева от текста.
     * Выключение восстанавливает прежнее значение disabled — заблокированная
     * кнопка не станет активной после окончания загрузки.
     * @param {boolean} on - Включить загрузку.
     * @returns {Buttons} - Текущий экземпляр (для цепочки вызовов).
     * ***************************************************************************
     */
    setLoading(on: boolean): this {

        if (this._loading === on) return this;
        this._loading = on;

        const button = this._element;

        // Запоминаем/восстанавливаем disabled, чтобы не разблокировать
        // кнопку, которую вызывающий код заблокировал сам
        if (on) {
            this._disabledBeforeLoading = button.disabled;
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            button.classList.add("pointer-events-none");

            // Скрываем исходную иконку, чтобы не стояли рядом две
            const icon = button.querySelector("[data-button-icon]");
            if (icon instanceof SVGElement) icon.classList.add("hidden");

            // Спиннер: дуга Tabler + стандартная утилита вращения
            const spinner = Icons.icon("loader-2", { classes: ["animate-spin", "shrink-0"] });
            if (spinner) {
                spinner.setAttribute("data-button-spinner", "");
                button.prepend(spinner);
            }
        } else {
            button.disabled = this._disabledBeforeLoading;
            button.setAttribute("aria-busy", "false");
            button.classList.remove("pointer-events-none");

            button.querySelector("[data-button-spinner]")?.remove();

            const icon = button.querySelector("[data-button-icon]");
            if (icon instanceof SVGElement) icon.classList.remove("hidden");
        }

        return this;
    }

    /**
     * ***************************************************************************
     * Геттеры
     * ***************************************************************************
     */
    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }
    get loading() { return this._loading; }

    // Умное приведение к строке для шаблонных литералов `${Buttons...}`
    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Статический метод создания button
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static create(options?: ButtonsOptions) {
        return new Buttons(options);
    }

    /**
     * ***************************************************************************
     * Статический метод создания button circle
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static circle(options: ButtonsOptions = {}) {
        return new Buttons({ ...options, shape: "circle" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания button transparent
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static transparent(options: ButtonsOptions = {}) {
        return new Buttons({ ...options, intent: "transparent" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания button primary
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static primary(options: ButtonsOptions = {}) { return new Buttons({ ...options, intent: "primary" }); }

    /**
     * ***************************************************************************
     * Статический метод создания button warning
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static warning(options: ButtonsOptions = {}) { return new Buttons({ ...options, intent: "warning" }); }

    /**
     * ***************************************************************************
     * Статический метод создания button danger
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static danger(options: ButtonsOptions = {}) { return new Buttons({ ...options, intent: "danger" }); }

    /**
     * ***************************************************************************
     * Статический метод создания текстовой кнопки-ссылки (intent "link").
     * Используется вместо сырых `<button class="text-brand hover:underline">`
     * в подвалах авторизации и секциях настроек.
     * @param {ButtonsOptions} options - Опции
     * ***************************************************************************
     */
    static link(options: ButtonsOptions = {}) { return new Buttons({ ...options, intent: "link" }); }
}
