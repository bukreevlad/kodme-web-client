// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { renderWaveProgress } from "./render_wave_progress.js";

// Импортируем типы
import type { AudioPlayer } from "../index.js";
import type { AudioPlayerState } from "../../../utils/audio/audio_player.js";

/**
 * ***************************************************************************
 * Рендеринг прогресса и иконок (вызывается из подписки менеджера).
 * @param form - Экземпляр формы плеера.
 * @param info - Состояние плеера от менеджера.
 * ***************************************************************************
 */
export function renderUpdate(form: AudioPlayer, info: Partial<AudioPlayerState>): void {

    try {

        const currentTimeEl = form.tpl?.querySelector("[data-current-time]");
        const durationEl = form.tpl?.querySelector("[data-duration]");
        const playBtn = form.playBtn;

        // 1. Обновляем прогресс-бар через сеттер класса Range
        if (form.progress) {
            form.progress.value = info.progress ?? 0;
            renderWaveProgress(form, info.progress ?? 0);
        }

        // 2. Обновляем время
        if (currentTimeEl) currentTimeEl.textContent = info.currentTime ?? null;
        if (durationEl) durationEl.textContent = info.duration ?? null;

        // 3. Меняем иконку Play/Pause
        if (form.lastPlayingState !== info.isPlaying) {
            form.lastPlayingState = info.isPlaying ?? null;

            const iconName = info.isPlaying ? "player-pause" : "player-play";
            playBtn?.setIcon(iconName, { settings: { filled: true } });

            Logger.debug("AudioPlayer: Icon state changed to", iconName);
        }

    } catch (error) {
        Logger.error(error);
    }

}
