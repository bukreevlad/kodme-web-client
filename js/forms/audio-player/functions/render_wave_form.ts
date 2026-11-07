// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { AudioPlayer } from "../index.js";
import { isWaveFormAmplitudes } from "../types.js";

/**
 * ***************************************************************************
 * Отрисовка осциллограммы трека (если есть wave_form).
 * @param form - Экземпляр формы плеера.
 * ***************************************************************************
 */
export function renderWaveForm(form: AudioPlayer): void {

    try {

        const waveContainer = form.tpl?.querySelector<HTMLElement>("[data-wave-form]");
        const progressContainer = form.progress?.dom;
        const waveForm = form.manager?.audioData?.metadata?.wave_form;

        if (!waveContainer) return;

        if (isWaveFormAmplitudes(waveForm)) {
            waveContainer.innerHTML = "";

            waveForm.forEach(amplitude => {
                const bar = document.createElement("div");
                const heightPercent = Math.max(amplitude * 100, 10);
                bar.style.height = `${heightPercent}%`;
                bar.className = "wave-bar flex-1 min-w-[.15rem] bg-[var(--color-brand)] rounded-full transition-opacity duration-100 cursor-pointer";
                bar.style.opacity = "0.5";
                waveContainer.appendChild(bar);
            });

            waveContainer.classList.remove("hidden");
            if (progressContainer) progressContainer.classList.add("hidden");
        } else {
            waveContainer.innerHTML = "";
            waveContainer.classList.add("hidden");
            if (progressContainer) progressContainer.classList.remove("hidden");
        }

    } catch (error) {
        Logger.error(error);
    }

}
