// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем config
import { MESSAGES_INTERACTIVE_ELEMENTS } from "../../../config/constants.js";

// Импортируем handlers
import { contextMenuHandler } from "./handlers/context_menu.js";
import { replyCommentHandler } from "./handlers/reply_comment.js";

// Импортируем типы
import type { Comments } from "../index.js";
import type { CommentRecord } from "../types.js";

/**
 * Контроллеры жестов строк: WeakMap по DOM-узлу — уничтожаются вместе со
 * строкой, disposeRowActions снимает их при удалении строки из ленты.
 */
const rowControllers = new WeakMap<HTMLElement, GestureController>();

/**
 * ***************************************************************************
 * attachRowActions - жесты строки комментария: свайп влево — ответ,
 * тап (мобильные) / контекстное меню (десктоп) — меню комментария.
 *
 * Жесты вешаются один раз при создании строки; команда меню берёт актуальные
 * данные из Store по текущему data-id (id меняется при replaceId после ack).
 * @param form - Экземпляр формы.
 * @param item - DOM-узел строки.
 * @returns void
 * ***************************************************************************
 */
export function attachRowActions(form: Comments, item: HTMLElement): void {

    try {

        // Форма и строка обязательны
        if (!form || !item) return;

        // Актуальные данные комментария из Store (id перепривязывается при replaceId)
        const getData = (): CommentRecord | null => {
            const id = item.dataset.id;
            return id ? form.store.get(id) ?? null : null;
        };

        // Игнорируемых элементов нет: проверка интерактивных целей (ссылки,
        // кнопки, вложения, цитата) выполняется внутри onTap — как в Messages,
        // где в ignore лежат только code-блоки `pre` (здесь их нет)
        const ignoreElements: HTMLElement[] = [];

        // GestureController
        const controller = new GestureController(item, {
            ignore: ignoreElements,
            threshold: 5,
            onContextMenu: (event) => {
                event.preventDefault();

                // Десктоп: контекстное меню по ПКМ
                if (!IsMobile.get()) {
                    const data = getData();
                    if (data) contextMenuHandler(event, form, data);
                }
            },
            tap: {
                onTap: (event) => {

                    // Если нажали на ссылку или кнопку — выходим из onTap,
                    // это позволит браузеру выстрелить обычный 'click'
                    const target = event.target instanceof Element ? event.target : null;
                    if (target?.closest(MESSAGES_INTERACTIVE_ELEMENTS)) return;

                    // Мобильная версия: тап по строке открывает меню комментария
                    if (IsMobile.get()) {
                        if (event.cancelable) event.preventDefault();
                        const data = getData();
                        if (data) contextMenuHandler(event, form, data);
                    }
                }
            },
            swipe: {
                directions: ["left"],
                commitDistance: 60,
                onStart: () => {
                    item.style.transition = "";
                    item.classList.add("dragging");
                },
                onMove: (dx) => {
                    item.style.setProperty("--current-translate", `${dx}px`);
                    item.style.transform = `translate3d(${dx}px, 0, 0)`;
                },
                onCommit: () => {

                    // Свайп влево — ответ на комментарий
                    const data = getData();
                    if (data) replyCommentHandler(form, data);

                    // Финализируем жест повторным вызовом: событие отпускания
                    // сюда не приходит, в ветке свайпа endGesture его не читает
                    controller.endGesture(controller.lastX, controller.lastY, controller.startEvent ?? new MouseEvent("mouseup"));
                },
                onCancel: () => { },
                onEnd: () => {
                    item.style.transition = "transform 0.2s ease";
                    item.style.transform = "translate3d(0, 0 ,0)";
                    item.classList.remove("dragging");
                }
            }
        });

        // Сохраняем контроллер для уничтожения при удалении строки
        rowControllers.set(item, controller);

    } catch (error) {
        Logger.error("[app][comments][row-actions]", error);
    }

}

/**
 * ***************************************************************************
 * disposeRowActions - уничтожение контроллера жестов строки (вызывается
 * при удалении строки из ленты).
 * @param item - DOM-узел строки.
 * @returns void
 * ***************************************************************************
 */
export function disposeRowActions(item: Element): void {

    const controller = rowControllers.get(item as HTMLElement);
    if (!controller) return;

    controller.destroy();
    rowControllers.delete(item as HTMLElement);

}
