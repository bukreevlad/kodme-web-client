/**
 * Настройки кругового индикатора загрузки.
 */
export interface ProgressIndicatorOptions {
    /** Размер в % (ширина и высота контейнера). */
    width?: string;
    /** Максимальный размер контейнера. */
    maxWidth?: string;
    /** Цвет обводки фоновой окружности. */
    stroke?: string;
    /** Ширина линии. */
    strokeWidth?: number | string;
    /** Радиус линии (viewBox 40x40). */
    radius?: number;
    /** Цвет линии прогресса. */
    color?: string;
    /** Фоновый цвет окружности. */
    bgColor?: string;
}

/**
 * ***************************************************************************
 * ProgressIndicator - Компонент кругового индикатора загрузки.
 * Создает адаптивный SVG, который занимает 100% контейнера.
 * ***************************************************************************
 */
export class ProgressIndicator {

    /** Размер в %. */
    width: string;

    /** Максимальный размер. */
    maxWidth: string;

    /** Цвет обводки фоновой окружности. */
    stroke: string;

    /** Ширина линии. */
    strokeWidth: number | string;

    /** Радиус линии. */
    radius: number;

    /** Цвет линии прогресса. */
    color: string;

    /** Фоновый цвет окружности. */
    bgColor: string;

    /** Длина окружности (математика для stroke-dashoffset). */
    circumference: number;

    /** Флаг режима бесконечного вращения. */
    isProcessing = false;

    /** Последний отображённый процент (для восстановления aria-valuenow
        после режима processing). */
    private _lastPercent = 0;

    /** Корневой элемент компонента. */
    container: HTMLElement;

    /** SVG-элемент (задаёт анимацию вращения). */
    svgElement: SVGSVGElement | null = null;

    /** Линия прогресса (окружность со stroke-dashoffset). */
    progressLine: SVGElement | null = null;

    /**
     * ***************************************************************************
     * Конструктор
     * @param {ProgressIndicatorOptions} [options] - Параметры
     * ***************************************************************************
     */
    constructor(options: ProgressIndicatorOptions = {}) {

        // Настройки по умолчанию
        this.width = options.width || "90%";
        this.maxWidth = options.maxWidth || "auto";
        this.stroke = options.stroke || "transparent";
        this.strokeWidth = options.strokeWidth || 4;
        this.color = options.color || "#ffffff";
        this.bgColor = options.bgColor || "rgba(0, 0, 0, 0.1)";

        // Математика для SVG (радиус 18 при viewBox 40x40)
        this.radius = options.radius || 18;
        this.circumference = 2 * Math.PI * this.radius;

        // Создаем DOM элементы
        this.container = document.createElement("div");
        this.container.className = "ui-progress-indicator";

        // Скрываем от скринридера декоративную графику и описываем прогресс
        // стандартными aria-атрибутами
        this.container.setAttribute("role", "progressbar");
        this.container.setAttribute("aria-valuemin", "0");
        this.container.setAttribute("aria-valuemax", "100");
        this.container.setAttribute("aria-valuenow", "0");

        this.initStyles();
        this.render();

    }

    /**
     * ***************************************************************************
     * Инициализация внутренних стилей (Scoped)
     * ***************************************************************************
     */
    initStyles(): void {
        Object.assign(this.container.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: this.width,
            height: this.width,
            maxWidth: this.maxWidth,
            maxHeight: this.maxWidth,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.3s ease",
            zIndex: "10"
        });
    }

    /**
     * ***************************************************************************
     * Рендеринг SVG структуры
     * ***************************************************************************
     */
    render(): void {
        this.container.innerHTML = `
            <svg class="progress-svg" viewBox="0 0 40 40" style="transform: rotate(-90deg); width: 100%; height: 100%;">
                <circle 
                    cx="20" cy="20" r="${this.radius}" 
                    fill="${this.bgColor}" 
                    stroke="${this.stroke}" 
                    stroke-width="${this.strokeWidth}"
                />
                <circle 
                    class="progress-line"
                    cx="20" cy="20" r="${this.radius}" 
                    fill="none" 
                    stroke="${this.color}" 
                    stroke-width="${this.strokeWidth}"
                    stroke-linecap="round"
                    style="
                        stroke-dasharray: ${this.circumference};
                        stroke-dashoffset: ${this.circumference};
                        transition: stroke-dashoffset 0.3s ease;
                    "
                />
            </svg>
            <style>
                @keyframes ui-progress-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        this.svgElement = this.container.querySelector<SVGSVGElement>(".progress-svg");
        this.progressLine = this.container.querySelector<SVGElement>(".progress-line");
    }

    /**
     * ***************************************************************************
     * Возвращает готовый DOM-элемент для вставки
     * @returns {HTMLElement}
     * ***************************************************************************
     */
    getElement(): HTMLElement {
        return this.container;
    }

    /**
     * ***************************************************************************
     * Обновляет состояние прогресса
     * @param {number} percent - Процент загрузки (0 - 100)
     * ***************************************************************************
     */
    update(percent: number): void {

        // Если включен режим обработки — выключаем его
        if (this.isProcessing) this.stopProcessing();

        // Ограничиваем значения
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        // Минимальный порог видимости: если 0, показываем 5%, 
        // чтобы пользователь видел, что процесс пошел
        const displayPercent = percent === 0 ? 5 : percent;
        this._lastPercent = displayPercent;

        // Прогресс доступен скринридеру через aria-valuenow
        this.container.setAttribute("aria-valuenow", `${displayPercent}`);

        // Расчет отступа
        const offset = this.circumference - (displayPercent / 100 * this.circumference);
        if (!this.progressLine) return;
        this.progressLine.style.strokeDashoffset = `${offset}`;

    }

    /**
     * ***************************************************************************
     * Включает режим бесконечного вращения
     * ***************************************************************************
     */
    setProcessing(): void {
        if (this.isProcessing) return;

        // Элементы ищутся в разметке — при их отсутствии анимировать нечего
        if (!this.progressLine || !this.svgElement) return;

        this.isProcessing = true;

        // Режим неопределённого прогресса: значение скрываем, помечаем busy
        this.container.removeAttribute("aria-valuenow");
        this.container.setAttribute("aria-busy", "true");

        // Делаем линию короткой (примерно 25% окружности)
        const shortLength = this.circumference * 0.75;
        this.progressLine.style.strokeDashoffset = `${shortLength}`;

        // Запускаем вращение самого SVG
        this.svgElement.style.animation = "ui-progress-spin 1s linear infinite";
    }

    /**
     * ***************************************************************************
     * Выключает режим вращения
     * ***************************************************************************
     */
    stopProcessing(): void {
        this.isProcessing = false;
        this.container.setAttribute("aria-busy", "false");
        this.container.setAttribute("aria-valuenow", `${this._lastPercent}`);
        if (!this.svgElement) return;
        this.svgElement.style.animation = "none";
    }

    /**
     * ***************************************************************************
     * Мягко скрывает компонент (opacity 0)
     * ***************************************************************************
     */
    hide(): void {
        this.container.style.opacity = "0";
    }

    /**
     * ***************************************************************************
     * Показывает компонент обратно
     * ***************************************************************************
     */
    show(): void {
        this.container.style.opacity = "1";
    }

    /**
     * ***************************************************************************
     * Полное удаление из DOM
     * ***************************************************************************
     */
    destroy(): void {
        this.hide();
        setTimeout(() => this.container.remove(), 400);
    }

}
