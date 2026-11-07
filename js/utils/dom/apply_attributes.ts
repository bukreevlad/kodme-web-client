/**
 * Тип «сырого» атрибута, который принимают компоненты: строка со значением
 * (`"maxlength=128"`), голое имя (`"required"`) либо объект `{name, value}`.
 */
export type RawAttribute = string | { name: string; value?: string };

/**
 * ***************************************************************************
 * applyAttributes - применяет массив сырых атрибутов к элементу.
 *
 * Единая точка парсинга формата атрибутов компонентов (Buttons, Inputs,
 * Badges). Раньше этот код был продублирован в каждом компоненте, а в
 * Avatars — ещё и в урезанной версии (без формата `name=value`).
 *
 * Сохранена легаси-семантика: объект без поля `name` сериализуется в
 * `setAttribute` строкой (раньше получался "[object Object]").
 *
 * @param {Element} element - Целевой DOM-элемент.
 * @param {RawAttribute[]} attributes - Массив атрибутов.
 * ***************************************************************************
 */
export function applyAttributes(element: Element, attributes: RawAttribute[]): void {

    attributes.forEach(attr => {

        // Пустые значения пропускаем: forEach по sparse-массиву даёт undefined
        if (!attr) return;

        // Строка со значением: "name=value" (значение может содержать "=")
        if (typeof attr === "string" && attr.includes("=")) {
            const [name = "", ...valueParts] = attr.split("=");
            element.setAttribute(name, valueParts.join("="));
        }
        // Объект {name, value}
        else if (typeof attr === "object" && attr.name) {
            element.setAttribute(attr.name, attr.value || "");
        }
        // Объект без имени в легаси уходил в setAttribute как "[object Object]" —
        // сохраняем ту же сериализацию DOM
        else if (typeof attr === "object") {
            element.setAttribute(String(attr), "");
        }
        // Голое имя без значения: "required", "data-audio"
        else {
            element.setAttribute(attr, "");
        }

    });

}
