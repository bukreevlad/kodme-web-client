// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем handlers
import { toggleAudioHandler } from "../handlers/toggle_audio.js";
import { toggleVideoHandler } from "../handlers/toggle_video.js";
import { toggleScreenHandler } from "../handlers/toggle_screen.js";
import { toggleHandHandler } from "../handlers/toggle_hand.js";
import { menuHandler } from "../handlers/menu.js";

// Импортируем functions
import { toggleImmersive } from "./toggle_immersive.js";
import { resolveStateBlocks } from "./parse_room_state.js";
import { canHandleShortcut, SHORTCUTS } from "./shortcuts.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import type { MeetBlockFlag } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Проверяет, не запрещён ли источник локальному участнику.
 *
 * Кнопка футера в этом случае `disabled`, но горячая клавиша до неё
 * не доходит: `disabled` на элементе защищает только клик мышью, а
 * клавиатура событие шлёт напрямую. Без проверки участник получил бы
 * вместо внятного «запрещено организатором» ошибку от LiveKit.
 * @param form - Экземпляр формы MeetPlay.
 * @param flag - Флаг источника: audio / video / screen.
 * @returns Запрещён ли источник.
 * ***************************************************************************
 */
function isSourceBlocked(form: MeetPlay, flag: MeetBlockFlag): boolean {

    const identity = form.room?.localParticipant?.identity;
    return resolveStateBlocks(form.roomState, identity)[flag] === true;

}

/**
 * ***************************************************************************
 * Вешает глобальные горячие клавиши конференции.
 *
 * Список клавиш и условия перехвата живут в `functions/shortcuts.ts`:
 * там же, откуда диалог настроек сетки берёт подсказку.
 *
 * Esc работает по нарастающей: в immersive-режиме первое нажатие
 * возвращает панели, второе закрывает форму. Иначе из immersive не было бы
 * куда выйти — ни шапки, ни футера с кнопкой меню там не видно, а
 * включается режим только пунктом меню.
 * @param form - Экземпляр формы MeetPlay.
 * @returns Функция отписки. Обязательна к вызову при закрытии:
 *          иначе горячие клавиши остались бы работать в других формах.
 * ***************************************************************************
 */
export function bindKeyboardShortcuts(form: MeetPlay): () => void {

    if (!form) return () => { };

    const handleKeydown = async (event: KeyboardEvent) => {

        try {

            if (!canHandleShortcut(event, form)) return;

            // ---------- ESC ----------
            if (event.code === "Escape") {
                event.preventDefault();

                // Панели на месте — закрываем форму
                if (!form.isImmersive) {
                    form.modal?.close();
                    return;
                }

                // Панели спрятаны — сначала возвращаем их
                toggleImmersive(form, false);
                return;
            }
            // ---------- ESC ----------

            // ---------- ПЕРЕКЛЮЧАТЕЛИ ИСТОЧНИКОВ ----------
            const shortcut = SHORTCUTS.find(item => item.code === event.code);

            if (!shortcut) return;

            // Меню блокировкой не бывает — оно нужно всегда
            if (shortcut.flag && isSourceBlocked(form, shortcut.flag)) {
                Toast.warning(t("forms.meet_play.blocked_by_organizer"));
                return;
            }

            // Пробел листает страницу, поэтому его обязательно гасим.
            // Остальным буквам preventDefault не нужен и скорее вреден
            if (event.code === "Space") event.preventDefault();

            switch (shortcut.locale) {
                case "space": await toggleAudioHandler(form); break;
                case "video": await toggleVideoHandler(form); break;
                case "screen": await toggleScreenHandler(form); break;
                case "hand": await toggleHandHandler(form); break;
                case "menu": {

                    // Обработчик меню ждёт событие с координатами.
                    // Отдаём центр кнопки, чтобы меню раскрылось под ней,
                    // а не в углу экрана
                    const button = form.tpl?.querySelector(":scope >.header [action-menu]");
                    const rect = button?.getBoundingClientRect?.();

                    await menuHandler({
                        clientX: rect ? rect.left + rect.width / 2 : 0,
                        clientY: rect ? rect.bottom : 0,
                        preventDefault: () => { }
                    }, form);
                    break;

                }
            }
            // ---------- ПЕРЕКЛЮЧАТЕЛИ ИСТОЧНИКОВ ----------

        } catch (error) {
            Logger.error("🚨 [meet-play]: Ошибка обработки горячей клавиши:", error);
        }

    };

    document.addEventListener("keydown", handleKeydown);

    // Отписка: без неё клавиши конференции продолжали бы срабатывать
    // после закрытия формы
    return () => document.removeEventListener("keydown", handleKeydown);

}
