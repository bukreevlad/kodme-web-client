// Импортируем components
import { TopicItem } from "../../components/channel.js";

// Импортируем типы
import { isChannelRecord } from "../../../main/types.js";
import type { GroupTopics } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на добавление элемента в локальное хранилище формы: создаёт
 * строку темы и вставляет её в список.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: GroupTopics): void {

    // Подписываемся на событие добавления нового элемента
    form.store.on("item::added", (data) => {

        // Пейлоад типизирован как unknown: строку создаём только для записи канала
        if (!isChannelRecord(data)) return;

        // Создаем DOM-элемент
        let item = new TopicItem(form, data);

        // Добавляем в список
        form.list?.appendChild(item.element);

    });

}
