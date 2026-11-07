// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем типы
import type { GroupTopics } from "../index.js";

/**
 * ***************************************************************************
 * Загрузка тем группы из IndexedDB в локальное хранилище формы и отрисовка
 * строк через события стора.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function showTopics(form: GroupTopics): Promise<void> {

    try {

        // Убираем полную очистку. Используем Store для синхронизации.
        // Таблица читается через общий Dexie API (db.table), а не через
        // свойство-слой: в типе IndexedDB.db нет объявленных таблиц
        const topics = await IndexedDB.db?.table("channels")
            .where("topic_for_group_id")
            .equals(form.channel.id)
            .toArray();

        // Добавляем/обновляем группу (Общий чат)
        form.store.get(form.channel.id)
            ? form.store.update(form.channel.id, form.channel)
            : form.store.add(form.channel);

        if (topics && topics.length > 0) {
            for (let topic of topics) {
                // Если тема есть — обновляем (строка перерисуется сама), если нет — добавляем
                form.store.get(topic.id)
                    ? form.store.update(topic.id, topic)
                    : form.store.add(topic);
            }
        } else if (form.channel?.topics) {
            // Резервный вариант из объекта
            for (let topic of form.channel.topics) {
                form.store.get(topic.id)
                    ? form.store.update(topic.id, topic)
                    : form.store.add(topic);
            }
        }

    } catch (error) {
        Logger.error(error);
    }

}
