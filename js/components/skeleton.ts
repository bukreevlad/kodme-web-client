/**
 * Тип скелетона: прямоугольный блок, несколько строк текста или круг (аватар).
 */
export type SkeletonShape = "block" | "lines" | "circle";

/**
 * Настройки скелетона.
 */
export interface SkeletonOptions {
    /** Форма скелетона. */
    shape?: SkeletonShape;
    /** Ширина (Tailwind-класс, например `"w-32"`, `"w-full"`). */
    widthClass?: string;
    /** Высота (Tailwind-класс, например `"h-4"`). Игнорируется у `lines` и `circle`. */
    heightClass?: string;
    /** Количество строк (только для формы `"lines"`). */
    lines?: number;
    /** Дополнительные CSS-классы. */
    classes?: string[];
}

/**
 * Настройки скелетона после применения дефолтов.
 */
interface ResolvedSkeletonOptions {
    /** Форма скелетона. */
    shape: SkeletonShape;
    /** Ширина. */
    widthClass: string;
    /** Высота. */
    heightClass: string;
    /** Количество строк. */
    lines: number;
    /** Дополнительные CSS-классы. */
    classes: string[];
}

/**
 * ***************************************************************************
 * SKELETON - контент-плейсхолдер на время первой загрузки.
 * ***************************************************************************
 *
 * Визуальный «призрак» будущего содержимого: серые блоки с пульсирующим
 * бликом (класс `ui-skeleton`, стили — в `css/components/controls.css`).
 * Скринридеру скелетон неинтересен: элемент помечен `aria-hidden`, а
 * состояние загрузки формы описывают другие элементы.
 *
 * Размеры задаются Tailwind-классами, а не inline-стилями, — так скелетон
 * наследует токены темы и не требует пересборки CSS.
 */
export class Skeleton {

    /** Настройки экземпляра (с дефолтами). */
    options: ResolvedSkeletonOptions;

    /** DOM-элемент скелетона. */
    private _element: HTMLElement;

    /**
     * ***************************************************************************
     * @param {SkeletonOptions} options - Настройки скелетона.
     * ***************************************************************************
     */
    constructor({
        shape = "block",
        widthClass = "w-full",
        heightClass = "h-4",
        lines = 3,
        classes = []
    }: SkeletonOptions = {}) {
        this.options = { shape, widthClass, heightClass, lines, classes };
        this._element = this._createElement();
    }

    /**
     * ***************************************************************************
     * Создание DOM-элемента по выбранной форме.
     * @returns {HTMLElement} Элемент скелетона.
     * @private
     * ***************************************************************************
     */
    private _createElement(): HTMLElement {

        // Общие классы «призрака»: форма, размер по умолчанию и скрытие
        // от скринридера
        const common = "ui-skeleton";

        let element: HTMLElement;

        if (this.options.shape === "lines") {

            // Строчный скелетон: колонка «строк», последняя — короче,
            // как реальный абзац с незаконченной строкой
            element = document.createElement("div");
            element.className = "flex flex-col gap-2";

            const count = Math.max(1, this.options.lines);
            for (let i = 0; i < count; i += 1) {
                const line = document.createElement("div");
                const isLast = i === count - 1;
                line.className = `${common} h-3.5 rounded ${isLast ? "w-3/4" : "w-full"}`;
                element.appendChild(line);
            }

            // Ширина колонки задаётся снаружи, высота строк — внутренне
            element.classList.add(...this.options.widthClass.split(" "));
            element.classList.add(...this.options.classes.filter(Boolean));

        } else if (this.options.shape === "circle") {

            // Круг: аватар или иконка
            element = document.createElement("div");
            element.className = `${common} aspect-square rounded-full shrink-0 ${this.options.widthClass}`;
            element.classList.add(...this.options.classes.filter(Boolean));

        } else {

            // Прямоугольный блок: картинка, карточка, любая область
            element = document.createElement("div");
            element.className = `${common} rounded-lg ${this.options.widthClass} ${this.options.heightClass}`;
            element.classList.add(...this.options.classes.filter(Boolean));

        }

        // Декоративный элемент: скринридер пропускает его целиком
        element.setAttribute("aria-hidden", "true");

        return element;

    }

    /**
     * ***************************************************************************
     * Геттеры.
     * ***************************************************************************
     */
    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }

    // Умное приведение к строке для шаблонных литералов
    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Фабрика прямоугольного блока (картинка, карточка).
     * @param {SkeletonOptions} options - Опции.
     * @returns {Skeleton} Экземпляр скелетона.
     * ***************************************************************************
     */
    static block(options: SkeletonOptions = {}) {
        return new Skeleton({ ...options, shape: "block" });
    }

    /**
     * ***************************************************************************
     * Фабрика строкочного скелетона (текстовый блок).
     * @param {SkeletonOptions} options - Опции.
     * @returns {Skeleton} Экземпляр скелетона.
     * ***************************************************************************
     */
    static lines(options: SkeletonOptions = {}) {
        return new Skeleton({ ...options, shape: "lines" });
    }

    /**
     * ***************************************************************************
     * Фабрика круглого скелетона (аватар).
     * @param {SkeletonOptions} options - Опции.
     * @returns {Skeleton} Экземпляр скелетона.
     * ***************************************************************************
     */
    static circle(options: SkeletonOptions = {}) {
        return new Skeleton({ ...options, shape: "circle" });
    }

}
