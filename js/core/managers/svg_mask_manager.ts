/**
 * Менеджер для создания и управления SVG масками/паттернами с возможностью динамической смены цвета
 * @class
 * @classdesc Преобразует SVG в раскрашенный PNG паттерн для использования в качестве фона
 */
export class SvgMaskManager {

    /** Контейнер для размещения слоев (null после destroy). */
    container: HTMLElement | null;

    /** URL текущего SVG файла (null после destroy). */
    svgUrl: string | null;

    /** CSS переменная для цвета паттерна по умолчанию. */
    currentColorVar = "--svg-pattern-color";

    /** Ширина паттерна в пикселях. */
    currentWidth = 250;

    /** Слой с фоновым градиентом. */
    bgLayer: HTMLElement | null = null;

    /** Слой с паттерном. */
    patternLayer: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Создает экземпляр менеджера SVG масок
     * @param {HTMLElement} element - DOM элемент, в который будут добавлены слои с паттерном
     * @param {string} svgUrl - URL к SVG файлу, который будет использован как паттерн
     * ***************************************************************************
     */
    constructor(element: HTMLElement, svgUrl: string) {
        this.container = element;
        this.svgUrl = svgUrl;
    }

    /**
     * ***************************************************************************
     * Преобразует CSS переменную в ее фактическое значение цвета
     * @param {string} color - Цвет в формате CSS (может содержать var(--name))
     * @returns {string} Реальное значение цвета (rgb/hex/название цвета)
     *
     * @example
     * // Возвращает "rgb(255, 0, 0)" если переменная определена
     * resolveColor('var(--svg-pattern-color)');
     *
     * @example
     * // Возвращает "#ff0000" без изменений
     * resolveColor('#ff0000');
     * ***************************************************************************
     */
    resolveColor(color: string): string {
        if (color.startsWith("var(")) {
            // Извлекаем название переменной из var(--name)
            const match = color.match(/var\(([^)]+)\)/);
            if (match) {
                const varName = (match[1] ?? "").trim();
                // Получаем значение переменной из стилей документа
                return getComputedStyle(document.documentElement)
                    .getPropertyValue(varName).trim();
            }
        }
        return color;
    }

    /*****************************************************************************
     * Инициализирует менеджер: создает слои и загружает паттерн
     * @param {string} [color=`var(${this.currentColorVar})`] - Цвет для заливки паттерна
     * @param {number} [targetWidth=this.currentWidth] - Желаемая ширина паттерна в пикселях
     * @returns {Promise<void>}
     * @throws {Error} Может выбросить ошибку при проблемах с загрузкой SVG или рендерингом
     *
     * @example
     * // Инициализация с параметрами по умолчанию
     * await svgMaskManager.init();
     *
     * @example
     * // Инициализация с кастомным цветом и шириной
     * await svgMaskManager.init('#ff0000', 300);
     * ***************************************************************************
     */
    async init(color = `var(${this.currentColorVar})`, targetWidth = this.currentWidth): Promise<void> {
        // Вычисляем реальный цвет для Canvas
        const actualColor = this.resolveColor(color);

        // Создаем слои при первом вызове
        if (!this.bgLayer) {
            this.bgLayer = document.createElement("div");
            this.patternLayer = document.createElement("div");
            this.setupLayers();
        }

        // Загружаем SVG файл (ошибка пробрасывается вызывающему коду — он её логирует)
        const svgUrl = this.svgUrl;
        if (!svgUrl) {
            throw new Error("SvgMaskManager.init: URL SVG не задан (менеджер после destroy()?)");
        }
        const response = await fetch(svgUrl);
        const svgText = await response.text();

        // Рендерим SVG в PNG с применением цвета
        const dataUrl = await this.rasterizeSvgWithColor(svgText, actualColor, targetWidth);

        // Применяем полученное изображение как фон паттерна
        const patternLayer = this.patternLayer;
        if (!patternLayer) return;

        patternLayer.style.backgroundImage = `url(${dataUrl})`;
        patternLayer.style.backgroundSize = `${targetWidth}px auto`;
        patternLayer.style.backgroundRepeat = "repeat";
    }

    /**
     * ***************************************************************************
     * Растеризует SVG в PNG с применением указанного цвета
     * @param {string} svgText - Содержимое SVG файла в виде строки
     * @param {string} color - Цвет для заливки (реальное значение, не CSS переменная)
     * @param {number} width - Желаемая ширина выходного изображения
     * @returns {Promise<string>} Data URL полученного PNG изображения
     * @private
     *
     * @description
     * Процесс растеризации:
     * 1. Парсит SVG для получения пропорций
     * 2. Создает Blob и загружает как изображение
     * 3. Рендерит на canvas с учетом DPR для ретина дисплеев
     * 4. Применяет цвет через composite operation
     *
     * @throws {Error} Может выбросить ошибку при проблемах с рендерингом
     * ***************************************************************************
     */
    async rasterizeSvgWithColor(svgText: string, color: string, width: number): Promise<string> {
        return new Promise<string>((resolve, reject) => {

            try {

                // 🔴 ВАЖНО: перекрашиваем SVG ДО canvas
                svgText = this.applyColorToSvg(svgText, color);

                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                const svgElement = svgDoc.querySelector("svg");

                // Разбор битого SVG даёт документ-ошибку без корневого <svg>:
                // без проверки дальше упали бы на null-доступе
                if (!svgElement) {
                    throw new Error("rasterizeSvgWithColor: в разобранном документе нет элемента <svg>");
                }

                // Оригинальные размеры SVG: атрибут может отсутствовать
                // или быть не числом — тогда NaN → fallback на viewBox
                const origW = parseFloat(svgElement.getAttribute("width") ?? "") || svgElement.viewBox.baseVal.width;
                const origH = parseFloat(svgElement.getAttribute("height") ?? "") || svgElement.viewBox.baseVal.height;

                // Рассчитываем высоту с сохранением пропорций
                const aspectRatio = origH / origW;
                const height = width * aspectRatio;

                // Учитываем плотность пикселей устройства (для Retina дисплеев)
                const dpr = window.devicePixelRatio || 1;

                const img = new Image();
                const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
                const url = URL.createObjectURL(svgBlob);

                img.onload = () => {
                    const canvas = document.createElement("canvas");

                    // Устанавливаем физические размеры canvas с учетом DPR
                    canvas.width = width * dpr;
                    canvas.height = height * dpr;

                    const ctx = canvas.getContext("2d");

                    // Нет контекста — отклоняем промис, иначе он зависнет
                    // без ответа и без ошибки в логе
                    if (!ctx) {
                        URL.revokeObjectURL(url);
                        reject(new Error("SvgMaskManager: не удалось получить контекст canvas 2d"));
                        return;
                    }

                    // Масштабируем контекст для работы в логических пикселях
                    ctx.scale(dpr, dpr);

                    // Включаем высококачественное сглаживание
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";

                    // Рисуем SVG на canvas в логических размерах
                    ctx.drawImage(img, 0, 0, width, height);

                    // Получаем PNG данные и освобождаем ресурсы
                    const pngData = canvas.toDataURL("image/png");
                    URL.revokeObjectURL(url);
                    resolve(pngData);
                };

                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error("Failed to load SVG image"));
                };

                img.src = url;

            } catch (error) {
                reject(error);
            }


        });
    }

    /**
     * Перекрашивает fill/stroke существующих элементов SVG указанным цветом.
     * @param {string} svgText - Исходное содержимое SVG.
     * @param {string} color - Цвет для заливки и обводки.
     * @returns {string} SVG в виде строки с примененным цветом.
     */
    applyColorToSvg(svgText: string, color: string): string {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");

        const svgElement = svgDoc.querySelector("svg");

        if (!svgElement) return svgText;

        // Удаляем существующие fill/stroke
        const elements = svgDoc.querySelectorAll("*");

        elements.forEach(el => {

            // Если элемент имеет stroke
            if (el.hasAttribute("stroke")) {
                el.setAttribute("stroke", color);
            }

            // Если элемент имеет fill (но не none)
            if (el.hasAttribute("fill") &&
                el.getAttribute("fill") !== "none") {

                el.setAttribute("fill", color);
            }

            // ВАЖНО: обработка style=""
            const style = el.getAttribute("style");

            if (style) {
                const newStyle = style
                    .replace(/stroke:[^;]+/g, `stroke:${color}`)
                    .replace(/fill:[^;]+/g, `fill:${color}`);

                el.setAttribute("style", newStyle);
            }
        });

        return new XMLSerializer().serializeToString(svgDoc);
    }

    /**
     * ***************************************************************************
     * Настраивает и позиционирует слои в контейнере
     * @private
     *
     * @description
     * Создает два абсолютно позиционированных слоя:
     * - bgLayer: для фонового градиента
     * - patternLayer: для повторяющегося паттерна
     * Слои добавляются в начало контейнера для правильного z-index порядка
     * ***************************************************************************
     */
    setupLayers(): void {
        // Слои и контейнер создаются/обнуляются вместе: без всех трёх
        // настраивать нечего (вызывается сразу после создания слоёв)
        const container = this.container;
        const bgLayer = this.bgLayer;
        const patternLayer = this.patternLayer;
        if (!container || !bgLayer || !patternLayer) return;

        // Устанавливаем необходимые стили для контейнера
        container.style.position = "relative";
        container.style.overflow = "hidden";

        // Настраиваем слой с фоновым градиентом
        Object.assign(bgLayer.style, {
            position: "absolute",
            inset: "0", // Современная альтернатива top:0; right:0; bottom:0; left:0;
            zIndex: 0,
            background: "var(--svg-pattern-bg-gradient)",
            pointerEvents: "none" // Позволяет кликать "сквозь" слой
        });

        // Настраиваем слой с паттерном
        Object.assign(patternLayer.style, {
            position: "absolute",
            inset: "0",
            zIndex: 0,
            pointerEvents: "none",
            willChange: "transform" // Оптимизация для анимаций
        });

        // Добавляем слои в начало контейнера
        container.prepend(patternLayer);
        container.prepend(bgLayer);
    }

    /**
     * ***************************************************************************
     * Обновляет URL источника SVG и перезагружает паттерн
     * @param {string} newSvgUrl - Новый URL к SVG файлу
     * @param {string} [color=`var(${this.currentColorVar})`] - Цвет для заливки паттерна
     * @param {number} [targetWidth=this.currentWidth] - Желаемая ширина паттерна в пикселях
     * @returns {Promise<void>}
     * @throws {Error} Может выбросить ошибку при проблемах с загрузкой нового SVG
     *
     * @example
     * // Простая смена URL
     * await svgMaskManager.updateUrl('new-pattern.svg');
     *
     * @example
     * // Смена URL с новым цветом
     * await svgMaskManager.updateUrl(
     *   'new-pattern.svg',
     *   '#00ff00',
     *   300
     * );
     * ***************************************************************************
     */
    async updateSVGUrl(newSvgUrl: string, color = `var(${this.currentColorVar})`, targetWidth = this.currentWidth): Promise<void> {
        // Обновляем URL
        this.svgUrl = newSvgUrl;

        // Очищаем старый паттерн для предотвращения мелькания
        if (this.patternLayer) {
            this.patternLayer.style.backgroundImage = "none";
        }

        // Загружаем новый паттерн с указанными параметрами
        await this.init(color, targetWidth);
    }

    /*****************************************************************************
     * Очищает и удаляет созданные слои
     * @returns {void}
     *
     * @example
     * // Очистка ресурсов при уничтожении компонента
     * svgMaskManager.destroy();
     * ***************************************************************************
     */
    destroy(): void {
        // Удаляем слои из DOM
        if (this.bgLayer) {
            this.bgLayer.remove();
            this.bgLayer = null;
        }

        if (this.patternLayer) {
            this.patternLayer.remove();
            this.patternLayer = null;
        }

        // Очищаем ссылки для сборщика мусора
        this.container = null;
        this.svgUrl = null;
    }

}
