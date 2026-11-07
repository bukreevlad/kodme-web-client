// Импортируем utils
import { GestureController } from "../../../utils/gesture_controller.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем типы
import type { OverlayCapability } from "../types.js";

/** Порог свайпа до закрытия, px — значение кладётся в `threshold` капабилти. */
const SWIPE_THRESHOLD = 150;

/**
 * ***************************************************************************
 * SWIPE - закрытие свайпом.
 * ***************************************************************************
 *
 * Что делает:
 * на мобильных вешает `GestureController` на контент формы. Если свайп
 * прошёл дальше порога — вызывает `close()` с текущим смещением, чтобы
 * `close()` дорисовал уход «в ту же сторону», а не просто исчез.
 *
 * Принадлежит только типу «form»: у модалок закрытия свайпом нет.
 */
export const swipe: OverlayCapability = {

    /** @type {string} Имя капабилти. */
    name: "swipe",

    /** @type {number} Сколько пикселей нужно протащить, чтобы закрыть. */
    threshold: SWIPE_THRESHOLD,

    /**
     * ***************************************************************************
     * Настраиваем свайпы на форме.
     *
     * Вешаем после `onOpen`: к этому моменту вызывающий уже собрал список
     * элементов, по которым свайп запрещён (`ignoreSwipeElements`).
     * @param {OverlayLike} form - Экземпляр контейнера.
     * ***************************************************************************
     */
    afterOpen(form) {

        // Если опция closeOnSwipe
        const closeOnSwipe = form.options.closeOnSwipe;
        if (closeOnSwipe && IsMobile.get()) {

            // Цель свайпа: `.content` внутри шаблона формы. Без него жестам
            // некуда крепиться — выходим, не создавая контроллер.
            const swipeTarget = form.content.querySelector<HTMLElement>(":scope >.content");
            if (!swipeTarget) return;

            // GestureController
            new GestureController(swipeTarget, {
                ignore: form.options?.ignoreSwipeElements ?? undefined,
                threshold: 3,
                swipe: {
                    directions: [closeOnSwipe.direction],
                    onStart: () => {
                        form.content.style.transition = "";
                        form.content.classList.add("select-none");
                    },
                    onMove: (dx) => {
                        form.content.style.setProperty("--current-translate", `${dx}px`);
                        form.content.style.transform = `translate3d(${dx}px, 0, 0)`;
                    },
                    onEnd: (dx) => {

                        // Включаем анимацию
                        form.content.style.transition = "transform var(--form-animation-time) ease";

                        // Определяем, достигли ли точки закрытия
                        const direction = closeOnSwipe.direction;
                        const shouldClose =
                            (direction === "right" && dx > SWIPE_THRESHOLD) ||
                            (direction === "left" && dx < -SWIPE_THRESHOLD);

                        if (shouldClose) {
                            form.content.style.transform = ""; // чистим промежуточный трансформ
                            form.close({ startX: dx });          // передаем координату
                        } else {
                            // Возвращаем элемент на место
                            form.content.style.transform = "translate3d(0, 0, 0)";
                            form.content.classList.remove("select-none");
                        }

                    }
                }
            });

        }

    },

    /**
     * ***************************************************************************
     * Сброс. `GestureController` подписывается на узел content, который и так
     * удаляется вместе с формой, поэтому отдельная отписка не нужна.
     * ***************************************************************************
     */
    destroy() { }

}
