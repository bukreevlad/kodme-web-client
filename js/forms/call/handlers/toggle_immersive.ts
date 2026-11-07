// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем functions
import { updateBarsHeight } from "../functions/update_bars_height.js";
import { placeSelfTile } from "../functions/self_view.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Прячет или возвращает панели звонка (иммерсивный режим).
 *
 * Шапка и футер убираются только в тех режимах, где есть одно крупное
 * видео (`spotlight` и `focus`): в сетке это просто накрыло бы нижний ряд
 * плиток. Видимость переключается парой `hidden`/`flex` — в собранном
 * Tailwind `.hidden` идёт после `.flex`, поэтому одного снятия `hidden`
 * недостаточно.
 *
 * Плашка «я» при скрытии панелей опускается вниз: `--form-footer-height`
 * становится нулём, и у неё появляется больше места — позиция хранится
 * в долях, поэтому возвращается ровно туда же.
 * @param form - Экземпляр формы.
 * @param isVisible - Показать панели или убрать.
 * @returns {void}
 * ***************************************************************************
 */
export function applyImmersive(form: Call, isVisible: boolean): void {

    try {

        form.isImmersive = !isVisible;

        for (const panel of [form?.header, form?.footer]) {
            if (!panel) continue;

            panel.classList.toggle("hidden", !isVisible);
            panel.classList.toggle("flex", isVisible);
        }

        // Высота панелей заново попадает в CSS-переменные, а от неё
        // считается базовое положение плашки «я»
        updateBarsHeight(form);
        placeSelfTile(form);

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось переключить иммерсивный режим", error);
    }

}

/**
 * ***************************************************************************
 * Включает тап по видео для скрытия и возврата панелей.
 *
 * Тап работает и мышью, и пальцем ( GestureController ), поэтому на PWA
 * отдельного обработчика touch не нужно. Клики по плиткам участников и
 * кнопкам не перехватываются — у них свои действия.
 * @param form - Экземпляр формы.
 * @returns Функция отписки от жеста (null — жест не включён).
 * ***************************************************************************
 */
export function initImmersiveToggle(form: Call): (() => void) | null {

    try {

        const content = form?.content;
        if (!content) return null;

        // Панели доступны только во время разговора
        const controller = new GestureController(content, {
            threshold: 8,
            tap: {
                onTap: (event) => {

                    // Звонок ещё не состоялся — тапом управляем оверлеем
                    if (form.callState !== "active") return;

                    // Сетка: прятать панели нельзя
                    if (form.viewMode === "grid") return;

                    // Клик по кнопкам и по угловой плитке — это их
                    // собственные действия: угловая меняет видео местами.
                    // Сцена при этом ТОЖЕ перехватывается: тап по ней
                    // и есть иммерсивный режим
                    if (event?.target instanceof Element && event.target.closest("button, .call-corner")) return;

                    applyImmersive(form, Boolean(form.isImmersive));

                }
            }
        });

        return () => controller.destroy();

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось включить иммерсивный режим", error);
        return null;
    }

}
