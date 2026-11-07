// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { ChannelItem } from "../../types.js";

/**
 * ***************************************************************************
 * Выделение/снятие выделения канала в списке пересылки: перекидывает id
 * канала в список выбранных и включает кнопку «Переслать», пока есть
 * хотя бы один выделенный канал.
 *
 * Состояние выделения живёт в классе элемента ("selected"), а не в
 * объекте строки: класс переживает перерисовку данных и не дублирует
 * источник истины рядом с DOM.
 *
 * @param item - Строка списка.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function clickHandler(item: ChannelItem): Promise<void> {

    try {

        if (!item) return;
        const form = item.form;
        if (!form) return;

        // Текущее состояние — по классу элемента
        const isSelected = item.element.classList.contains("selected");

        // Обновляем данные
        if (isSelected) {
            item.element.classList.remove("selected");
            form.selectedChannelsIds = form.selectedChannelsIds.filter(id => id !== item.data.id);
        } else {
            item.element.classList.add("selected");
            form.selectedChannelsIds.push(item.data.id);
        }

        // Проверяем есть ли в списке выделенные
        const actionForwardMessages = form.tpl?.querySelector(":scope >[action-forward-messages]");

        // Если каналы выделены
        if (form.selectedChannelsIds && form.selectedChannelsIds?.length > 0) {
            actionForwardMessages?.classList.add("active");
        } else {
            actionForwardMessages?.classList.remove("active");
        }

    } catch (error) {
        Logger.error(error);
    }

}
