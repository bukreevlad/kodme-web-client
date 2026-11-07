// Ключи для удаления
const KEYS_TO_REMOVE: string[] = [
    '__domElement__',
    '__domElements__',
    '__unsubscribeStore__',
    '__updateStatusRead__',
    '__updateReactions__',
    '__update__',
    '__editMessage__',
    '__getData__'
];

/**
 * Является ли значение объектом, который можно индексировать строковыми
 * ключами (примитивы и null отсекаются).
 * @param value - Проверяемое значение.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * ***************************************************************************
 * Глубокая очистка объекта от служебных полей перед сохранением в IndexedDB.
 * @param data - Любые данные: примитивы, File/Блоб, Date, массивы, объекты.
 * @returns Копия данных без служебных ключей (примитивы и File/Блоб — как есть).
 * ***************************************************************************
 */
export function cleanStoreData(data: unknown): unknown {

    // ВАЖНО: Если это Файл или Блоб, возвращаем его КАК ЕСТЬ.
    // IndexedDB сохранит их без проблем.
    if (data instanceof File || data instanceof Blob) {
        return data;
    }

    // Даты возвращаем в новом экземпляре
    if (data instanceof Date) {
        return new Date(data.getTime());
    }

    // Массивы обрабатываем рекурсивно
    if (Array.isArray(data)) {
        return data.map(item => cleanStoreData(item));
    }

    // Примитивы (строки, числа и т.д.) или null возвращаем сразу
    if (!isRecord(data)) {
        return data;
    }

    // Обычные объекты очищаем от ненужных ключей
    const cleanObj: Record<string, unknown> = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            // Пропускаем служебные поля
            if (KEYS_TO_REMOVE.includes(key)) {
                continue;
            }
            // Рекурсивно чистим вложенные данные
            cleanObj[key] = cleanStoreData(data[key]);
        }
    }

    return cleanObj;

}
