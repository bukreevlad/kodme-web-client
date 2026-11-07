// Импортируем сторонние пакеты
import type { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { STICKERS_SCROLL_THROTTLE_MS, STICKERS_LOAD_AHEAD_PX } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { getStickerPaks } from "../functions/get_paks.js";

// Импортируем типы
import type { StickerPaks } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на скролл списка паков с догрузкой страниц.
 *
 * Пагинация паков — offset-подгрузка «вниз», поэтому проверяется только
 * НИЖНЯЯ граница списка: последний элемент подтягивается к низу viewport —
 * пора грузить следующую страницу.
 *
 * Защита от шума: OverlayScrollbars шлёт scroll на каждый тик прокрутки,
 * поэтому проверка не чаще раза в STICKERS_SCROLL_THROTTLE_MS.
 *
 * @param form - Экземпляр формы.
 * @param scrollInstance - Экземпляр OverlayScrollbars панели.
 * @returns Функция отписки или null без формы/скроллбара.
 * ***************************************************************************
 */
export function onPaksScrollHandler(form: StickerPaks, scrollInstance: OverlayScrollbars): (() => void) | null {

    // Без формы или скроллбара подписываться не на что
    if (!form || !scrollInstance) return null;

    const checkEdge = (): void => {

        try {

            const viewport = scrollInstance.elements?.()?.viewport;
            const items = form.list?.children;
            if (!viewport || !items?.length) return;

            // Первая страница не загружена — грузит её сама форма
            if (!form.isFirstLoaded) return;

            // Раскладку viewport читаем один раз
            const viewportRect = viewport.getBoundingClientRect();

            // Низ списка: последний элемент подтягивается к нижней границе
            const last = items[items.length - 1];
            if (!last) return;
            const lastRect = last.getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + STICKERS_LOAD_AHEAD_PX) {
                getStickerPaks(form);
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][sticker-paks][on-paks-scroll]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdge, STICKERS_SCROLL_THROTTLE_MS, {
        leading: true,
        trailing: true
    });

    scrollInstance.on("scroll", throttled);

    // Отписка снимает и слушатель, и таймер троттлинга: иначе после закрытия
    // формы отложенный вызов «выстрелил» бы по уже удалённому DOM
    return () => {
        try {
            scrollInstance.off("scroll", throttled);
        } catch (error) {
            Logger.debug(`[app][sticker-paks][on-paks-scroll]::off`, error);
        }
        throttled.cancel();
    };

}
