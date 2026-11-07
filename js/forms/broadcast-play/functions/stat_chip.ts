// Импортируем utils
import { Icons } from "../../../utils/icons.js";

/**
 * Опции чипа статистики.
 */
export interface StatChipOptions {

    /** Имя иконки (utils/icons). */
    iconName: string;

    /** Отображаемое значение. */
    value?: string;

    /** Служебное имя чипа, попадает в data-chip-name. */
    name?: string;

}

/**
 * Собранный чип статистики: корень чипа и узел значения.
 */
export interface StatChip {

    /** Корень чипа (вставляется в контейнер). */
    element: HTMLElement;

    /** Узел значения — по нему пишется textContent извне. */
    value: HTMLElement;

}

/**
 * ***************************************************************************
 * CREATE_STAT_CHIP - собирает один чип статистики: иконка и значение.
 *
 * Чипы статистики дублировались в шаблоне шесть раз — одна и та же
 * разметка с разными иконками и подписями. Здесь она собирается один раз
 * функцией, а `[data-cast-info]` остаётся просто контейнером.
 *
 * @param options - Опции чипа.
 * @returns Элемент чипа и узел значения — по нему пишется textContent извне.
 * ***************************************************************************
 */
export function createStatChip(options: StatChipOptions): StatChip {

    const { iconName, value = "", name = "" } = options;

    // Корень чипа. Стили лежат в css/forms/broadcast-play.css (раздел 6),
    // поэтому в разметке нет ни одного оформляющего класса — иначе
    // шесть чипов удвоили бы Tailwind-классы в шаблоне
    const element = document.createElement("div");
    element.setAttribute("data-chip", "");

    if (name) element.setAttribute("data-chip-name", name);

    // Иконка. Если иконки с таким именем нет — ставим пустой контейнер,
    // чтобы отступы не «скакали» от чипа к чипу
    if (iconName) {
        const icon = Icons.icon(iconName);
        if (icon) element.appendChild(icon);
    }

    // Узел значения: именно его меняют и stream_info_update, и
    // cast_timing_update, и статистика RTC
    const valueElement = document.createElement("span");
    valueElement.setAttribute("data-chip-value", "");
    valueElement.textContent = value;

    element.appendChild(valueElement);

    return { element, value: valueElement };

}
