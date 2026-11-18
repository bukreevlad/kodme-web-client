// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { ChannelItem } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

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
            form.selectedChannelsIds = form.selectedChannelsIds.filter(id => id !== item.data.id);
        } else {
            form.selectedChannelsIds.push(item.data.id);
        }

        // Класс выделения — на всех копиях строки (в папках одна запись даёт
        // несколько DOM-строк): по нему CSS показывает бейдж-галочку на аватаре
        const selected = form.selectedChannelsIds.includes(item.data.id);
        form.store.getDomElements(item.data.id).forEach(element => {
            element.classList.toggle("selected", selected);
        });

        // Проверяем есть ли в списке выделенные
        const actionForwardMessages = form.tpl?.querySelector(":scope >[action-forward-messages]");

        // Если каналы выделены
        if (form.selectedChannelsIds && form.selectedChannelsIds?.length > 0) {
            actionForwardMessages?.classList.add("active");
        } else {
            actionForwardMessages?.classList.remove("active");
        }

        // Заголовок: пока не выбрано ни одного канала — «Переслать сообщение»,
        // иначе — количество выбранных
        const title = form.tpl?.querySelector<HTMLElement>(":scope >.header [data-title]");
        const selectedCount = form.selectedChannelsIds.length;
        if (title) {
            title.textContent = selectedCount > 0
                ? t("forms.forward_messages.header_selected", { count: selectedCount })
                : t("forms.forward_messages.header_title");
        }

    } catch (error) {
        Logger.error(error);
    }

}
