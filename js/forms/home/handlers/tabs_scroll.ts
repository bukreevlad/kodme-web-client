// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Home } from "../index.js";

/**
 * ***************************************************************************
 * Перехватывает вертикальный скролл над вкладками и переводит его
 * в горизонтальный (контейнер вкладок прокручивается по X).
 * @param event - Событие колесика мыши.
 * @param form - Форма.
 * ***************************************************************************
 */
export function tabsScrollHandler(event: WheelEvent, form: Home): void {

    try {

        if (event.deltaY !== 0) {
            event.preventDefault();

            // Без скроллбара над вкладками прокручивать нечего
            const elements = form.osListScrollInstance?.elements();
            if (!elements) return;

            const { viewport } = elements;
            viewport.scrollBy({
                left: event.deltaY * 1.5, // Умножаем на 1.5 для чуть большей скорости (по желанию)
                behavior: "smooth"    // Вот она, магия плавности
            });
        }

    } catch (error) {
        Logger.error(error);
    }

}
