// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BotMenuNode } from "../types.js";

/**
 * ***************************************************************************
 * Путь от корня меню до категории: массив узлов [корень … … категория]
 * либо null, если id в дереве не найден.
 *
 * @param tree - Дерево меню бота.
 * @param id - Id категории (null — категория не выбрана).
 * @returns Путь до категории либо null.
 * ***************************************************************************
 */
export function genPathToCurrentCategory(tree: BotMenuNode[], id: string | null): BotMenuNode[] | null {

    try {

        // Рекурсивная функция для обхода дерева
        function traverse(node: BotMenuNode, path: BotMenuNode[] = []): BotMenuNode[] | null {
            if (node.id === id) {
                return [...path, node];
            }

            // Если содержит потомков
            if (node.children) {
                for (let child of node.children) {
                    const result = traverse(child, [...path, node]);
                    if (result) {
                        return result;
                    }
                }
            }
            return null;
        }

        // Проходим по всем элементам массива
        for (let node of tree) {
            const result = traverse(node);
            if (result) {
                return result;
            }
        }
        return null;

    } catch (error) {
        Logger.error(error);

        // Ошибка обхода читается вызывающим как «путь не найден»
        return null;
    }

}
