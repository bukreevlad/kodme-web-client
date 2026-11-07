// Импортируем config
import { CLOUD_SCROLL_THROTTLE_MS, CLOUD_LOAD_AHEAD } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { loadMore } from "../functions/load_more.js";

// Импортируем типы
import type { OverlayScrollbars } from "overlayscrollbars";
import type { Cloud } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на скролл панели облака с догрузкой следующей страницы.
 *
 * Замена двух инлайновых обработчиков, которые работали на КАЖДЫЙ тик
 * скролла и проверяли низ viewport «на глазок»
 * (`scrollTop + clientHeight >= scrollHeight - 120`). Отличия:
 *
 * 1. Троттлинг. OverlayScrollbars шлёт `scroll` на каждый тик прокрутки —
 *    десятки раз в секунду; теперь проверка не чаще раза в
 *    CLOUD_SCROLL_THROTTLE_MS (leading — сразу, trailing — последний вызов
 *    после паузы, чтобы догрузка не потерялась в конце прокрутки).
 *
 * 2. Проверяется только последний элемент списка, а не смещение scrollTop:
 *    вопрос «пора ли грузить» зависит от того, подтянулся ли низ списка
 *    к нижней границе viewport, и это одна пара getBoundingClientRect
 *    вместо арифметики на каждое событие. Условие — конвенция всех форм
 *    клиента: `lastRect.top <= viewportRect.bottom + CLOUD_LOAD_AHEAD`.
 *
 * 3. Prev не проверяется вовсе: список облака архитектурно догружается
 *    только вниз (направления prev у сервера есть, но клиент его не
 *    использует — папки отдаются всегда целиком сверху).
 *
 * @param form - Экземпляр формы.
 * @param shared - false — «Моё облако», true — «Общий доступ».
 * @param scrollInstance - Инстанс OverlayScrollbars панели.
 * @returns Функция отписки (снимает слушатель и таймер троттлинга)
 *   либо null, если подписываться не на что.
 * ***************************************************************************
 */
export function onScrollHandler(
    form: Cloud,
    shared: boolean,
    scrollInstance: OverlayScrollbars | null
): (() => void) | null {

    // Подписываться не на что
    if (!form || !scrollInstance) return null;

    // Ключ контекста: два списка формы живут независимо (свой флаг
    // первой страницы, свой курсор, своя догрузка)
    const context = shared ? "shared" : "mine";

    const checkEdges = () => {

        try {

            // Форма закрыта: панель уже отсоединена от документа
            if (form.isClosed) return;

            const viewport = scrollInstance.elements?.()?.viewport;
            const items = (shared ? form.listShared : form.listMine)?.children;
            if (!viewport || !items?.length) return;

            // Первая страница не применена — курсор и has_more неактуальны:
            // direction-запрос вернул бы не ту страницу (гонка с навигацией
            // по папкам, см. functions/load_more.ts)
            if (shared ? !form.sharedIsFirstLoaded : !form.isFirstLoaded) return;

            // Раскладку viewport читаем один раз на весь проход
            const viewportRect = viewport.getBoundingClientRect();

            // Низ списка: последний элемент подтягивается к нижней границе —
            // пора догрузить следующую страницу (next)
            const last = items[items.length - 1];
            if (!last) return;
            const lastRect = last.getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + CLOUD_LOAD_AHEAD) {
                loadMore(form, { shared });
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][cloud][on-scroll][${context}]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdges, CLOUD_SCROLL_THROTTLE_MS, {
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
            Logger.debug(`[app][cloud][on-scroll][${context}]::off`, error);
        }
        throttled.cancel();
    };

}
