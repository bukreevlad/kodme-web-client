// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Разблокировка аудиоконтекста комнаты по первому клику.
 *
 * Браузеры не дают запустить WebAudio без жеста пользователя: на iOS Safari
 * `room.startAudio()` без клика остаётся заблокированным, и участники не слышат
 * друг друга. Поэтому вешаем одноразовый слушатель на первый клик по окну.
 * @param form - Экземпляр формы.
 * @returns Функция отписки (нужна, если форму закрыли раньше клика).
 * ***************************************************************************
 */
export function unlockAudioHandler(form?: Call): () => void {

    try {

        // Без комнаты разблокировывать нечего
        if (!form?.room) return () => { };

        // Первый же клик запускает аудиоконтекст
        const unlock = () => {
            form.room.startAudio().then(() => {
                Logger.debug("🔊 [app][call]: Аудио разблокировано кликом");

                // Снимаем слушатель: он больше не нужен
                window.removeEventListener("click", unlock);
            }).catch(error => {
                Logger.warn("🔊 [app][call]: Не удалось разблокировать аудио:", error);
            });
        };

        // Вешаем слушатель один раз
        window.addEventListener("click", unlock, { once: false });

        // Отдаём отписку для _onBeforeClose
        return () => window.removeEventListener("click", unlock);

    } catch (error) {
        Logger.error("[app][call]: Ошибка разблокировки аудио:", error);
        return () => { };
    }

}
