/**
 * Цветовое назначение бейджа (intent).
 */
export type BadgeIntent = "standard" | "primary" | "success" | "warning" | "danger" | "info";

/**
 * Размер бейджа; `dot` — режим компактной точки без текста.
 */
export type BadgeSize = "sm" | "md" | "lg" | "dot";

/**
 * Настройки бейджа.
 */
export interface BadgesOptions {
    /** Число или текст внутри бейджа. */
    value?: number | string | null;
    /** Максимальное число (например: 99 превратится в "99+"). */
    max?: number | null;
    /** Показывать ли бейдж, если значение равно 0. */
    showZero?: boolean;
    /** Режим компактной точки без текста. */
    dot?: boolean;
    /** Цветовое назначение. */
    intent?: BadgeIntent;
    /** Размер. */
    size?: BadgeSize;
    /** Доступное имя для скринридера (aria-label); для dot-режима не нужно —
        точка декоративна и скрывается от скринридера автоматически. */
    label?: string | undefined;
    /** Дополнительные CSS-классы. */
    classes?: string[];
    /** Атрибуты: строки `"name=value"` / `"name"` либо объекты `{name, value}`. */
    attributes?: Array<string | { name: string; value?: string }>;
}

/**
 * ***************************************************************************
 * Класс для создания и управления бейджами (Badges)
 * ***************************************************************************
 */
export class Badges {

    // Декларативная карта стилей Tailwind v4 (базовые утилиты)
    static #baseStyles = "inline-flex items-center justify-center align-middle shrink-0 font-semibold rounded-full transition-all duration-200 select-none whitespace-nowrap leading-none box-border";

    // Стили для полного физического и визуального схлопывания в 0px
    static #zeroSizeClasses = "w-0 min-w-0 h-0 p-0 text-[0px] opacity-0 scale-0 pointer-events-none overflow-hidden";

    // Варианты стилей
    static #variants: { intent: Record<BadgeIntent, string>; size: Record<BadgeSize, string> } = {
        intent: {
            standard: "bg-[var(--color-black)]/10 text-secondary dark:bg-[var(--color-white)]/15 dark:text-secondary",
            primary: "bg-[var(--color-brand)] text-white dark:bg-[var(--color-brand)]",
            success: "bg-emerald-600 text-white dark:bg-emerald-500",
            warning: "bg-amber-500 text-white dark:bg-amber-600",
            danger: "bg-red-600 text-white dark:bg-red-500",
            info: "bg-sky-500 text-white dark:bg-sky-600"
        },
        size: {
            sm: "min-w-4 h-4 px-1 text-[0.625rem]",
            md: "min-w-5 h-5 px-1.5 text-xs",
            lg: "min-w-6 h-6 px-2 text-sm",
            dot: "w-2.5 h-2.5 min-w-0 p-0"
        }
    };

    /** Настройки экземпляра. */
    options: BadgesOptions;

    /** DOM-элемент бейджа. */
    private _element: HTMLSpanElement;

    /**
     * ***************************************************************************
     * @param {BadgesOptions} options - Настройки бейджа
     * ***************************************************************************
     */
    constructor({
        value = null,
        max = null,
        showZero = false,
        dot = false,
        intent = "danger",
        size = "md",
        label,
        classes = [],
        attributes = []
    }: BadgesOptions = {}) {
        this.options = { value, max, showZero, dot, intent, size, label, classes, attributes };
        this._element = this._createElement();

        // Доступное имя: точка-индикатор декоративна и скрывается от
        // скринридера, счётчик наоборот должен иметь читаемую подпись
        if (dot) {
            this._element.setAttribute("aria-hidden", "true");
        } else if (label) {
            this._element.setAttribute("aria-label", label);
        }

        // Устанавливаем стартовое значение и размерное состояние
        this.setValue(value);
    }

    /**
     * ***************************************************************************
     * Создание DOM-элемента <span>
     * ***************************************************************************
     */
    private _createElement(): HTMLSpanElement {
        const badge = document.createElement("span");

        const variantClasses = [
            Badges.#baseStyles,
            Badges.#variants.intent[this.options.intent ?? "danger"] || Badges.#variants.intent.danger,
            ...(this.options.classes ?? [])
        ].filter(Boolean).join(" ");

        badge.classList.add(...variantClasses.split(" "));

        // Парсинг и установка атрибутов
        (this.options.attributes ?? []).forEach(attr => {
            if (!attr) return;

            if (typeof attr === "string" && attr.includes("=")) {
                const [name = "", ...valueParts] = attr.split("=");
                badge.setAttribute(name, valueParts.join("="));
            } else if (typeof attr === "object") {
                // Объект без имени в легаси уходил в setAttribute и получал
                // "[object Object]" — сохраняем ту же сериализацию DOM
                if (attr.name) {
                    badge.setAttribute(attr.name, attr.value || "");
                } else {
                    badge.setAttribute(String(attr), "");
                }
            } else {
                badge.setAttribute(attr, "");
            }
        });

        return badge;
    }

    /**
     * ***************************************************************************
     * Обновление значения с динамической подменой размеров на 0px
     * @param {number|string|null} value
     * ***************************************************************************
     */
    setValue(value: number | string | null) {
        this.options.value = value;

        const hasValue = value !== null && value !== undefined && value !== "";
        const isZero = Number(value) === 0;

        const shouldShow = this.options.dot || (hasValue && (!isZero || this.options.showZero));

        if (!this.options.dot) {
            if (hasValue && typeof value === "number" && this.options.max && value > this.options.max) {
                this._element.textContent = `${this.options.max}+`;
            } else {
                this._element.textContent = hasValue ? String(value) : "";
            }
        }

        // Определяем нужный размер
        const targetSize: BadgeSize = this.options.dot
            ? "dot"
            : (Badges.#variants.size[this.options.size ?? "md"] ? (this.options.size ?? "md") : "md");

        const activeSizeClasses = Badges.#variants.size[targetSize].split(" ");
        const zeroClasses = Badges.#zeroSizeClasses.split(" ");

        if (shouldShow) {
            // Удаляем нулевые классы и восстанавливаем целевой размер
            this._element.classList.remove(...zeroClasses);
            this._element.classList.add(...activeSizeClasses);
        } else {
            // Удаляем классы размера и сжимаем элементы до 0px
            this._element.classList.remove(...activeSizeClasses);
            this._element.classList.add(...zeroClasses);
        }

        return this;
    }

    /**
     * ***************************************************************************
     * Динамическая смена цвета (intent)
     * @param {BadgeIntent} intentName
     * ***************************************************************************
     */
    setIntent(intentName: BadgeIntent) {
        if (!Badges.#variants.intent[intentName]) return this;

        // Удаляем прежний цвет
        Object.values(Badges.#variants.intent).forEach(cls => {
            cls.split(" ").forEach(c => this._element.classList.remove(c));
        });

        this.options.intent = intentName;
        this._element.classList.add(...Badges.#variants.intent[intentName].split(" "));
        return this;
    }

    /**
     * ***************************************************************************
     * Динамическая смена размера
     * @param {BadgeSize} sizeName
     * ***************************************************************************
     */
    setSize(sizeName: BadgeSize) {
        if (!Badges.#variants.size[sizeName]) return this;

        // Удаляем старые варианты размеров из элемента
        Object.values(Badges.#variants.size).forEach(cls => {
            cls.split(" ").forEach(c => this._element.classList.remove(c));
        });

        this.options.size = sizeName;

        // Пересчитываем видимость и активные классы
        return this.setValue(this.options.value ?? null);
    }

    /**
     * ***************************************************************************
     * Геттеры
     * ***************************************************************************
     */
    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }
    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Статические фабричные методы
     * ***************************************************************************
     */
    static create(options?: BadgesOptions) { return new Badges(options); }
    static primary(options: BadgesOptions = {}) { return new Badges({ ...options, intent: "primary" }); }
    static success(options: BadgesOptions = {}) { return new Badges({ ...options, intent: "success" }); }
    static warning(options: BadgesOptions = {}) { return new Badges({ ...options, intent: "warning" }); }
    static danger(options: BadgesOptions = {}) { return new Badges({ ...options, intent: "danger" }); }
    static dot(options: BadgesOptions = {}) { return new Badges({ ...options, dot: true }); }

}
