// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { syncMonthDividers } from "../../functions/sync_month_dividers.js";
import { updateSectionEmpty } from "../../functions/update_section_empty.js";

// Импортируем типы
import type { ChannelProfile, ChannelSectionItemData, MediaSection, Unsubscribe } from "../../types.js";
import type { StoreAddOptions } from "../../../../utils/store.js";

/**
 * ***************************************************************************
 * Достаёт направление пачки из опций подписчика item::added.
 *
 * loadSection кладёт опции своего формата (SectionAddOptions) в общий
 * Store, поэтому на стороне подписчика читаем поле через индекс объекта,
 * а не как типизированное свойство StoreAddOptions.
 *
 * @param options - Опции события item::added.
 * @returns "prev" | "next" или undefined (первая страница).
 * ***************************************************************************
 */
function readSectionDirection(options?: StoreAddOptions): "prev" | "next" | undefined {

    const raw: unknown = options;
    if (typeof raw !== "object" || raw === null || !("direction" in raw)) return undefined;

    const direction: unknown = raw.direction;
    return direction === "prev" || direction === "next" ? direction : undefined;

}

/**
 * ***************************************************************************
 * Подписки формы на события Store секции вкладки.
 *
 * Отписку возвращаем наружу: её складывает StoreEvents и вызывает при
 * закрытии формы — подписки на item::added / item::removed не должны
 * переживать форму.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание секции (см. config/media_sections.ts).
 * @returns Функция отписки от всех событий секции или null.
 ***************************************************************************
 */
export function subscribeSection(form: ChannelProfile, section: MediaSection): Unsubscribe | null {

    if (!form || !section) return null;

    // Стор существует с момента конструктора формы, а список — только
    // после сборки вкладок в _onBeforeOpen. Поэтому стор берём сейчас,
    // а список читаем по ключу В МОМЕНТ СОБЫТИЯ: если запомнить его здесь,
    // он был бы null и строки не добавлялись бы в DOM никогда
    const store = form[section.storeKey];
    if (!store) return null;

    try {

        // ---------- Добавление ----------
        const unsubAdded = store.on("item::added", (payload, options) => {

            // Эмитим всегда, но payload может быть undefined
            if (!payload) return;

            // invariant: в Store попадают только записи секций (loadSection
            // добавляет ответ сервера с типом ChannelSectionItemData)
            const data = payload as ChannelSectionItemData;

            // Создаём строку: конструктор не возвращает DOM — элемент отдаёт
            // поле instance (класс-фабрика красный флаг миграции)
            const item = new section.component(form, data);

            // Список читаем здесь, а не в замыкании: см. комментарий выше.
            // Список идёт новыми сверху: пачка next (сервер отдаёт её по
            // возрастанию id) вставляется в НАЧАЛО — последовательный
            // prepend разворачивает её в убывающем порядке; пачка prev и
            // первая страница (desc от глобального максимума) встают в конец
            if (readSectionDirection(options) === "next") {
                form[section.listKey]?.prepend(item.element);
            } else {
                form[section.listKey]?.appendChild(item.element);
            }

            // Разделители месяцев сверяем после вставки строки
            syncMonthDividers(form, section);

        });

        // ---------- Удаление ----------
        const unsubRemoved = store.on("item::removed", (payload) => {

            // Store эмитит событие даже если элемента в Map уже нет:
            // в этом случае data === undefined
            if (!payload) return;

            // invariant: см. комментарий в item::added выше
            const data = payload as ChannelSectionItemData;

            const elements = data.__domElements__;
            if (!Array.isArray(elements)) return;

            for (const element of elements) {
                if (element && typeof element.remove === "function") {
                    element.remove();
                }
            }

            // Чистим массив, чтобы не копить ссылки на удалённые узлы
            data.__domElements__ = [];

            // Отписываем компонент от глобальных событий (аудиоплейер):
            // такая подписка переживает Store и удерживала закрытую форму
            if (typeof data.__destroy__ === "function") {
                data.__destroy__();
                data.__destroy__ = null;
            }

            // Удалили последнюю запись секции — показываем пустое состояние
            updateSectionEmpty(form, section);

            // Разделители месяцев сверяем после удаления: граница группы
            // могла сдвинуться, а хвостовой разделитель — осиротеть
            syncMonthDividers(form, section);

        });

        return () => {
            unsubAdded();
            unsubRemoved();
        };

    } catch (error) {

        Logger.error(`[app][channel-profile][subscribe-section][${section.id}]:`, error);
        return null;

    }

}
