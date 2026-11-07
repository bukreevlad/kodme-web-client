// Импортируем utils
import type { Store } from "../../../utils/store.js";

// Импортируем functions
import { sortChannels } from "./sort_channels.js";

// Импортируем типы
import type { ChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * Универсальная визуальная сортировка списка чатов с FLIP-анимацией.
 *
 * Порядок берётся из стора (свежие сверху), а перестановка выполняется
 * только внутри переданного контейнера: соседние папки не трогаются.
 * @param container - Конкретный DOM-контейнер папки/вкладки.
 * @param store - Стор с актуальными данными.
 * ***************************************************************************
 */
export function sortChatListVisually(container: HTMLElement | null, store: Store<ChannelRecord>): void {

    // Если контейнер не передан
    if (!container) return;

    // Получаем актуальные данные из стора и сортируем их
    const activeChannelsData = store.getAll();
    const sortedData = sortChannels(activeChannelsData);

    // [FIRST] Запоминаем текущие координаты элементов ТОЛЬКО в этом контейнере
    const positions = new Map<string, DOMRect>();
    const childNodes = Array.from(container.querySelectorAll<HTMLElement>(":scope > *"));

    // Сохраняем позиции по их уникальному ID из data-аттрибута
    childNodes.forEach(node => {

        const channelId = node.dataset.id || node.id;
        if (channelId) {
            positions.set(channelId, node.getBoundingClientRect());
        }

    });

    // [LAST] Перестраиваем ноды в новом порядке ИМЕННО внутри этого контейнера
    sortedData.forEach(channel => {

        // Ищем элемент внутри текущего контейнера
        const node = container.querySelector(`[data-id="${channel.id}"]`);
        if (node) {

            // Теперь это безопасно меняет порядок нод внутри одного и того же контейнера
            container.appendChild(node);

        }

    });

    // [INVERT & PLAY] Анимируем сдвиги
    Array.from(container.querySelectorAll<HTMLElement>(":scope > *")).forEach(node => {
        const channelId = node.dataset.id || node.id;
        const firstRect = positions.get(channelId);

        if (!firstRect) {

            // Плавно проявляем новый канал, если его не было в этой папке
            node.style.opacity = "0";
            node.style.transition = "opacity 0.3s ease";
            requestAnimationFrame(() => node.style.opacity = "1");
            return;

        }

        const lastRect = node.getBoundingClientRect();
        const deltaY = firstRect.top - lastRect.top;
        const deltaX = firstRect.left - lastRect.left;

        // Если элемент сдвинулся со своего места
        if (deltaY !== 0 || deltaX !== 0) {

            // Возвращаем в исходную точку без анимации
            node.style.transition = "none";
            node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

            // Триггерим reflow, чтобы браузер зафиксировал стартовую точку
            node.offsetHeight; // триггер reflow

            // Запускаем плавное скольжение на финальную позицию
            node.style.transition = "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)";
            node.style.transform = "translate(0, 0)";

            // Очищаем за собой инлайн-стили после анимации
            setTimeout(() => {
                node.style.transition = "";
                node.style.transform = "";
            }, 350);

        }

    });

}
