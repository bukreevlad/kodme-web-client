// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BotMenuNode, BotMenuRecord } from "../types.js";

/**
 * ***************************************************************************
 * Построение дерева меню бота из плоского массива команд и категорий:
 * каждая запись с `categoryId` подшивается к родителю, корневые записи
 * становятся вершинами результата.
 *
 * @param array - Плоский массив записей меню (`bot_commands`).
 * @returns Дерево меню (вершины с дочерними узлами).
 * ***************************************************************************
 */
export function buildTreeArray(array: BotMenuRecord[]): BotMenuNode[] {

    try {

        // Устанавливаем параметры
        let nodeMap: Record<string, BotMenuNode> = {};
        let result: BotMenuNode[] = [];

        // Проходим по массиву
        array.forEach(item => {
            nodeMap[item.id] = { ...item, children: [] };
        });

        // Создаем дерево из массива
        array.forEach(item => {
            let node = nodeMap[item.id];
            if (!node) return;
            if (item.categoryId != null) {
                nodeMap[item.categoryId]?.children.push(node);
            } else {
                result.push(node);
            }
        });

        return result;

    } catch (error) {
        Logger.error(error);

        // Ошибка разбора не должна оставить форму без дерева — отдаём пустое меню
        return [];
    }

}
