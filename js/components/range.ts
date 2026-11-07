/**
 * Цветовое назначение слайдера (intent): active — цвет закрашенной части,
 * track — фон непройденной части, accent — родный кружок браузера.
 */
export type RangeIntent = "standard" | "brand" | "primary" | "warning" | "danger";

/**
 * Размер слайдера.
 */
export type RangeSize = "sm" | "md" | "lg";

/**
 * Настройки слайдера.
 */
export interface RangeOptions {
    /** Текущее значение (приводится к числу). */
    value?: number | string;
    /** Минимум (приводится к числу). */
    min?: number | string;
    /** Максимум (приводится к числу). */
    max?: number | string;
    /** Шаг (приводится к числу). */
    step?: number | string;
    /** Имя input (для форм). */
    name?: string;
    /** DOM-id input. */
    id?: string;
    /** Цветовое назначение. */
    intent?: RangeIntent;
    /** Размер. */
    size?: RangeSize;
    /** Показывать ли числовое значение сбоку. */
    showValue?: boolean;
    /** Показывать ли всплывающую подсказку на курсоре/касании. */
    showTooltip?: boolean;
    /** Показывать ли подписи пределов под слайдером. */
    showLimits?: boolean;
    /** Показывать ли кружок (thumb). */
    showThumb?: boolean;
    /** Единица измерения рядом со значением. */
    unit?: string;
    /** Дополнительные CSS-классы input. */
    classes?: string[];
    /** Вызывается при изменении значения (событие change); null — обработчика нет. */
    onChange?: ((value: string, event: Event) => void) | null;
    /** Вызывается при вводе (событие input); null — обработчика нет. */
    onInput?: ((value: string, event: Event) => void) | null;
}

/**
 * Настройки слайдера после применения дефолтов конструктора.
 */
interface ResolvedRangeOptions {
    /** Текущее значение. */
    value: number;
    /** Минимум. */
    min: number;
    /** Максимум. */
    max: number;
    /** Шаг. */
    step: number;
    /** Имя input. */
    name: string;
    /** DOM-id input. */
    id: string;
    /** Цветовое назначение. */
    intent: RangeIntent;
    /** Размер. */
    size: RangeSize;
    /** Флаг числового значения. */
    showValue: boolean;
    /** Флаг тултипа. */
    showTooltip: boolean;
    /** Флаг подписей пределов. */
    showLimits: boolean;
    /** Флаг кружка. */
    showThumb: boolean;
    /** Единица измерения. */
    unit: string;
    /** Дополнительные CSS-классы. */
    classes: string[];
    /** Коллбэк change. */
    onChange: ((value: string, event: Event) => void) | null;
    /** Коллбэк input. */
    onInput: ((value: string, event: Event) => void) | null;
}

/**
 * Цель гидратации: элемент, список элементов, документ либо компонент
 * с геттером `dom`.
 */
export type RangeHydrateTarget = HTMLElement | HTMLElement[] | Document | { dom?: Element | null };

export class Range {

    // Кружок (thumb) делаем видимым, а сам инпут прозрачным.
    // Фокус с клавиатуры обязателен: outline-2 поверх прозрачного инпута
    // рисует кольцо вокруг всей полосы слайдера
    static #baseStyles = "w-full appearance-none bg-transparent cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand)] disabled:opacity-50 disabled:pointer-events-none rounded-lg z-10 relative";

    // CSS-класс/стиль для полного скрытия кружка (thumb) во всех браузерах
    static #hideThumbStyles = "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0";

    // Варианты оформления: active — цвет закрашенной части, track — фон непройденной части
    static #variants: {
        intent: Record<RangeIntent, { active: string; track: string; accent: string }>;
        size: Record<RangeSize, string>;
    } = {
        intent: {
            standard: {
                active: "bg-[var(--text-color)]/80 dark:bg-[var(--text-color)]",
                track: "bg-[var(--color-black)]/10 dark:bg-[var(--color-white)]/10",
                accent: "accent-[var(--text-color)]"
            },
            brand: {
                active: "bg-[var(--color-brand)]",
                track: "bg-[var(--color-black)]/10 dark:bg-[var(--color-white)]/10",
                accent: "accent-[var(--color-brand)]"
            },
            primary: {
                active: "bg-blue-500",
                track: "bg-blue-500/10 dark:bg-blue-50/10",
                accent: "accent-blue-500"
            },
            warning: {
                active: "bg-amber-500",
                track: "bg-amber-500/10 dark:bg-amber-50/10",
                accent: "accent-amber-500"
            },
            danger: {
                active: "bg-red-500",
                track: "bg-red-500/10 dark:bg-red-50/10",
                accent: "accent-red-500"
            }
        },
        size: {
            sm: "h-1.5",
            md: "h-2.5",
            lg: "h-3.5"
        }
    };

    /** Настройки экземпляра (с дефолтами и числовыми приведениями). */
    options: ResolvedRangeOptions;

    /** Корневой элемент слайдера. */
    private _element: HTMLDivElement;

    /** Прозрачный range-инпут (создаётся в _createElement). */
    private _input: HTMLInputElement;

    /** Заполненная часть трека (создаётся в _createElement). */
    private _fillTrack: HTMLDivElement;

    /** Тултип (создаётся только при showTooltip). */
    private _tooltip?: HTMLDivElement;

    /** Отображение значения сбоку (создаётся только при showValue). */
    private _valueDisplay?: HTMLSpanElement;

    /**
     * @param {RangeOptions} options - Настройки слайдера
     */
    constructor({
        value = 50,
        min = 0,
        max = 100,
        step = 1,
        name = "",
        id = "",
        intent = "brand",
        size = "md",
        showValue = false,
        showTooltip = false,
        showLimits = false,
        showThumb = true,
        unit = "",
        classes = [],
        onChange = null,
        onInput = null
    }: RangeOptions = {}) {
        this.options = {
            value: Number(value),
            min: Number(min),
            max: Number(max),
            step: Number(step),
            name, id, intent, size,
            showValue, showTooltip, showLimits, showThumb, unit,
            classes, onChange, onInput
        };

        // Узлы создаются одним методом и присваиваются здесь: конструктор
        // должен инициализировать свойства сам, а не делегировать это методу
        const created = this._createElement();
        this._element = created.root;
        this._input = created.input;
        this._fillTrack = created.fillTrack;

        // Первичный просчёт визуала — когда все узлы уже на экземпляре
        this._updateVisuals();
    }

    /** Узлы, которые собирает _createElement (корень, инпут, трек). */
    private _createElement(): { root: HTMLDivElement; input: HTMLInputElement; fillTrack: HTMLDivElement } {
        const container = document.createElement("div");
        container.className = "flex flex-col gap-1 w-full";
        container.setAttribute("data-range-root", "");

        const topRow = document.createElement("div");
        topRow.className = "flex items-center justify-between gap-4 w-full relative";

        // Контейнер слайдера
        const sliderWrapper = document.createElement("div");
        sliderWrapper.className = "relative flex items-center w-full select-none";

        const intentConfig = Range.#variants.intent[this.options.intent] || Range.#variants.intent.brand;
        const sizeClass = Range.#variants.size[this.options.size] || Range.#variants.size.md;

        // 1. ФОНОВЫЙ ТРЕК (Подложка)
        const trackBg = document.createElement("div");
        trackBg.className = `absolute inset-x-0 rounded-full overflow-hidden ${sizeClass} ${intentConfig.track}`;

        // 2. АКТИВНАЯ ЗАПОЛНЕННАЯ ЧАСТЬ (Индикатор progress)
        const trackFill = document.createElement("div");
        trackFill.setAttribute("data-range-fill", "");
        trackFill.className = `h-full transition-all duration-75 rounded-full ${intentConfig.active}`;
        trackBg.appendChild(trackFill);

        // 3. HTML INPUT (Поверх трека)
        const input = document.createElement("input");
        input.type = "range";
        input.min = `${this.options.min}`;
        input.max = `${this.options.max}`;
        input.step = `${this.options.step}`;
        input.value = `${this.options.value}`;
        input.setAttribute("value", `${this.options.value}`);

        if (this.options.name) input.name = this.options.name;
        if (this.options.id) input.id = this.options.id;

        if (this.options.unit) input.dataset.unit = this.options.unit;
        if (this.options.showValue) input.dataset.showValue = "true";
        if (this.options.showTooltip) input.dataset.showTooltip = "true";

        // Формируем список классов
        const classesList = [
            Range.#baseStyles,
            sizeClass,
            intentConfig.accent,
            !this.options.showThumb ? Range.#hideThumbStyles : "", // Скрываем кружочек если showThumb === false
            ...this.options.classes
        ].filter(Boolean).join(" ");

        input.classList.add(...classesList.split(" "));

        // Собираем: Сначала фоновый трек, сверху прозрачный инпут
        sliderWrapper.appendChild(trackBg);
        sliderWrapper.appendChild(input);

        // 4. Всплывающая подсказка (Tooltip)
        if (this.options.showTooltip) {
            const tooltip = document.createElement("div");
            tooltip.setAttribute("data-range-tooltip", "");
            tooltip.className = "absolute -top-9 -translate-x-1/2 px-2 py-0.5 bg-[var(--color-black)] text-[var(--color-white)] text-xs font-semibold rounded shadow transition-opacity opacity-0 pointer-events-none z-20 dark:bg-[var(--text-color)] dark:text-[var(--color-black)]";
            this._tooltip = tooltip;
            sliderWrapper.appendChild(tooltip);

            // Показываем на курсоре, фокусе и при касании (на тач-устройствах)
            const show = () => tooltip.classList.remove("opacity-0");
            const hide = () => tooltip.classList.add("opacity-0");

            input.addEventListener("mouseenter", show);
            input.addEventListener("mouseleave", hide);
            input.addEventListener("focus", show);
            input.addEventListener("blur", hide);
            input.addEventListener("pointerdown", show);
            input.addEventListener("pointerup", hide);
            input.addEventListener("pointercancel", hide);
        }

        topRow.appendChild(sliderWrapper);

        // 5. Статическое значение сбоку
        if (this.options.showValue) {
            const valueDisplay = document.createElement("span");
            valueDisplay.setAttribute("data-range-value", "");
            valueDisplay.className = "text-sm font-semibold text-secondary dark:text-secondary min-w-[3rem] text-right";
            this._valueDisplay = valueDisplay;
            topRow.appendChild(valueDisplay);
        }

        container.appendChild(topRow);

        // 6. Подпись пределов (Limits)
        if (this.options.showLimits) {
            const limitsRow = document.createElement("div");
            limitsRow.className = "flex justify-between text-xs text-secondary dark:text-secondary px-0.5 mt-0.5";
            limitsRow.innerHTML = `
                <span>${this.options.min}${this.options.unit}</span>
                <span>${this.options.max}${this.options.unit}</span>
            `;
            container.appendChild(limitsRow);
        }

        input.addEventListener("input", (e) => this._handleInput(e));
        if (this.options.onChange) {
            input.addEventListener("change", (e) => {
                // Значение читаем с самого инпута: событие вешено на него
                if (this.options.onChange) this.options.onChange(input.value, e);
            });
        }

        return { root: container, input, fillTrack: trackFill };
    }

    private _handleInput(e: Event) {
        this._updateVisuals();
        if (this.options.onInput) {
            // Значение читаем с самого инпута: событие вешено на него
            this.options.onInput(this._input.value, e);
        }
    }

    private _updateVisuals() {
        Range.updateSliderVisuals(this._input, this._fillTrack, this._valueDisplay, this._tooltip);
    }

    /**
     * Статический метод для обновления ширины полоски и тултипа
     * @param {HTMLInputElement|null} input - Инпут слайдера.
     * @param {HTMLElement|null} [fillElement] - Заполненная часть трека.
     * @param {HTMLElement|null} [valueDisplay] - Отображение значения.
     * @param {HTMLElement|null} [tooltip] - Тултип.
     */
    static updateSliderVisuals(
        input: HTMLInputElement | null,
        fillElement?: HTMLElement | null,
        valueDisplay?: HTMLElement | null,
        tooltip?: HTMLElement | null
    ) {
        if (!input) return;

        const val = Number(input.value);
        const min = Number(input.min) || 0;
        const max = Number(input.max) || 100;
        const unit = input.dataset.unit || "";

        const percentage = max === min ? 0 : ((val - min) / (max - min)) * 100;

        // Просто меняем ширину заполнения
        if (fillElement) {
            fillElement.style.width = `${percentage}%`;
        }

        const formattedValue = `${val}${unit}`;

        if (valueDisplay) {
            valueDisplay.textContent = formattedValue;
        }

        if (tooltip) {
            tooltip.textContent = formattedValue;
            tooltip.style.left = `calc(${percentage}% + (${8 - percentage * 0.16}px))`;
        }
    }

    /**
     * Статический метод оживления (гидратации) элементов после HTML-рендера
     * @param {RangeHydrateTarget} [target=document]
     */
    static hydrate(target: RangeHydrateTarget = document) {
        let roots: Element[] = [];

        if (Array.isArray(target)) {
            roots = target.filter(el => el && el.hasAttribute?.("data-range-root"));
        } else if (target instanceof HTMLElement && target.hasAttribute("data-range-root")) {
            roots = [target];
        } else {
            // Компонент с dom-геттером либо сам элемент/документ
            let context: Element | Document | null = null;
            if ("dom" in target && target.dom) {
                context = target.dom;
            } else if (target instanceof Element || target instanceof Document) {
                context = target;
            }

            if (context) {
                roots = Array.from(context.querySelectorAll("[data-range-root]"));
            }
        }

        roots.forEach(root => {
            const input = root.querySelector<HTMLInputElement>("input[type='range']");
            if (!input || root.hasAttribute("data-range-hydrated")) return;

            const fillElement = root.querySelector<HTMLElement>("[data-range-fill]");
            const valueDisplay = root.querySelector<HTMLElement>("[data-range-value]");
            const tooltip = root.querySelector<HTMLElement>("[data-range-tooltip]");

            if (tooltip) {
                const show = () => tooltip.classList.remove("opacity-0");
                const hide = () => tooltip.classList.add("opacity-0");

                input.addEventListener("mouseenter", show);
                input.addEventListener("mouseleave", hide);
                input.addEventListener("focus", show);
                input.addEventListener("blur", hide);
                input.addEventListener("pointerdown", show);
                input.addEventListener("pointerup", hide);
                input.addEventListener("pointercancel", hide);
            }

            const handleSync = () => {
                input.setAttribute("value", input.value);
                Range.updateSliderVisuals(input, fillElement, valueDisplay, tooltip);
            };

            input.addEventListener("input", handleSync);

            // Первичный просчет при вставке в DOM
            handleSync();

            root.setAttribute("data-range-hydrated", "");
        });
    }

    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }

    get value() { return Number(this._input.value); }
    set value(val: number | string) {
        // Приведение к строке эквивалентно веб-приведению при записи в input.value
        this._input.value = String(val);
        this._updateVisuals();
    }

    toString() { return this.html; }

    static create(options?: RangeOptions) {
        return new Range(options);
    }
}
