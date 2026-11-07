// Импортируем узлы SVG для outline и filled напрямую из node_modules
import outlineNodesJson from "../../node_modules/@tabler/icons/tabler-nodes-outline.json" with { type: "json" };
import filledNodesJson from "../../node_modules/@tabler/icons/tabler-nodes-filled.json" with { type: "json" };

// Импортируем utils
import { Logger } from "./logs/logger.js";

/**
 * Словарь узлов иконок Tabler из JSON: имя иконки -> массив узлов,
 * каждый узел — пара [тег, атрибуты]. У Tabler все узлы — path.
 */
type RawIconNodes = Record<string, Array<Array<string | Record<string, string>>>>;

// JSON-словари приводим к единому типу: TS выводит для 5000+ ключей
// громоздкий union, а индексация строкой по нему невозможна
const outlineNodes: RawIconNodes = outlineNodesJson;
const filledNodes: RawIconNodes = filledNodesJson;

/**
 * Кастомные атрибуты корня SVG.
 */
type IconAttributes = Record<string, string | number | null | undefined>;

/**
 * Настройки Tabler (stroke, size, color, filled, style).
 */
interface IconSettings {
    /** Размер стороны (px или строка с единицами). */
    size?: number | string | null;
    /** Толщина обводки. */
    stroke?: number;
    /** Цвет иконки (по умолчанию currentColor). */
    color?: string | null;
    /** Залить иконку (эквивалент style: "filled"). */
    filled?: boolean;
    /** Стиль иконки. */
    style?: "outline" | "filled";
}

/**
 * Опции иконки.
 */
interface IconOptions {
    /** Кастомные атрибуты корня SVG. */
    attributes?: IconAttributes;
    /** Дополнительные CSS-классы. */
    classes?: string[];
    /** Настройки Tabler. */
    settings?: IconSettings;
}

export class Icons {

    /**
     * ***************************************************************************
     * Вспомогательный метод: приводим имя к kebab-case (например: "userCheck" / "IconUser" -> "user-check")
     * ***************************************************************************
     */
    static #normalizeName(name: string): string {
        if (!name) return "";

        let clean = name.replace(/^Icon/, "");
        if (clean.endsWith("Filled")) {
            clean = clean.replace(/Filled$/, "");
        }

        // Преобразуем CamelCase / PascalCase в kebab-case
        return clean.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    }

    /**
     * ***************************************************************************
     * Получаем иконку
     * @param {string} name - Имя иконки ("user", "heart", "arrow-right", "IconUser").
     * @param {Object} [options={}] - Опции.
     * @param {Object} [options.attributes={}] - Кастомные атрибуты.
     * @param {Array<string>} [options.classes=[]] - Дополнительные CSS-классы.
     * @param {Object} [options.settings={}] - Настройки Tabler (stroke, size, color, filled, style).
     * ***************************************************************************
     */
    static icon(name: string, {
        attributes = {},
        classes = [],
        settings = {}
    }: IconOptions = {}): SVGSVGElement | null {

        try {

            const {
                size = null,
                stroke = 1.75,
                color = null,
                filled = false,
                style = "outline"
            } = settings;

            const isFilled = filled || style === "filled";
            const iconKey = this.#normalizeName(name);

            // Выбираем соответствующий словарь узлов (filled или outline)
            const nodesMap = isFilled ? filledNodes : outlineNodes;

            // Если в filled иконки нет — откатываемся на outline вариант
            const iconNodes = nodesMap[iconKey] || outlineNodes[iconKey];

            // Если иконка вообще не найдена
            if (!iconNodes) {
                Logger.error(`Иконка "${name}" (${iconKey}) не найдена.`);
                return null;
            }

            // Создаем SVG элемент
            const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");

            // Настройка дефолтных атрибутов SVG
            const defaultAttr = {
                "xmlns": "http://www.w3.org/2000/svg",
                "width": "24",
                "height": "24",
                "viewBox": "0 0 24 24",
                "fill": isFilled ? (color || "currentColor") : "none",
                "stroke": isFilled ? "none" : (color || "currentColor"),
                "stroke-width": stroke,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "class": "cdm-icon"
            };

            if (size !== null) {
                const formattedSize = typeof size === "number" ? `${size}px` : size;
                defaultAttr["width"] = formattedSize;
                defaultAttr["height"] = formattedSize;
            }

            // Объединяем дефолтные атрибуты с кастомными
            const mergedAttr = Object.assign({}, defaultAttr, attributes);

            // Применяем атрибуты к корню SVG
            Object.entries(mergedAttr).forEach(([key, value]) => {
                if (value === undefined || value === null) return;

                if (key === "class") {
                    String(value).split(" ").filter(Boolean).forEach(c => svgNode.classList.add(c));
                } else {
                    svgNode.setAttribute(key, String(value));
                }
            });

            // Добавляем внешние классы
            classes.forEach(c => c && svgNode.classList.add(c));

            // Собираем дочерние теги (path, circle, line и т.д.)
            iconNodes.forEach(node => {
                const [tagName, attrs] = node;

                // Внешние данные (JSON): проверяем форму узла перед использованием
                if (typeof tagName !== "string" || typeof attrs !== "object" || attrs === null) return;

                const childNode = document.createElementNS("http://www.w3.org/2000/svg", tagName);
                Object.entries(attrs).forEach(([k, v]) => childNode.setAttribute(k, String(v)));
                svgNode.appendChild(childNode);
            });

            return svgNode;

        } catch (error) {
            Logger.error(error);
            return null;
        }

    }

}