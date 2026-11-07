// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { AudioPlayer } from "../index.js";

/**
 * ***************************************************************************
 * Обновление прогресса на волновом графике.
 * @param form - Экземпляр формы плеера.
 * @param progress - Процент прогресса воспроизведения (0..100).
 * ***************************************************************************
 */
export function renderWaveProgress(form: AudioPlayer, progress: number): void {

    try {

        const bars = form.tpl?.querySelectorAll<HTMLElement>("[data-wave-form] .wave-bar");
        if (!bars || !bars.length) return;

        const activeBarsCount = Math.floor((progress / 100) * bars.length);
        bars.forEach((bar, index) => {
            bar.style.opacity = index < activeBarsCount ? "1" : "0.5";
        });

    } catch (error) {
        Logger.error(error);
    }

}
