// Импортируем сторонние пакеты
import { Track } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { NoiseGateProcessor } from "../../../utils/audio/noise_gate_processor.js";

// Импортируем functions
import { syncMicCaptureOptions } from "./mic_capture_options.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Включает или выключает шумоподавление на живом треке микрофона:
 * процессор гейта и опции захвата (автоусиление - только без гейта).
 *
 * Функция идемпотентна: повторный вызов с тем же состоянием ничего не
 * пересобирает. Чужой процессор (не `NoiseGateProcessor`) при включении
 * заменяется нашим, а при выключении не трогается - он не наш.
 *
 * Ошибки гасятся здесь с тостом: сбой процессора не должен ни ронять
 * включение микрофона, ни оставаться незамеченным для пользователя.
 * @param form - Форма конференции (`meet-play`).
 * @param enabled - Включить или выключить обработку.
 * @returns Промис переключения процессора.
 * ***************************************************************************
 */
export async function applyNoiseSuppression(form: MeetPlay, enabled: boolean): Promise<void> {

    try {

        // Микрофон выключен - публикации нет: просто выходим,
        // настройка применится при следующем включении источника
        const track = form.room?.localParticipant
            ?.getTrackPublication(Track.Source.Microphone)?.track;

        if (!track) return;

        // Гейт и автоусиление враждуют: приводим захват к нужному AGC
        // независимо от того, стоит ли уже процессор
        await syncMicCaptureOptions(track, enabled);

        // Стоящий процессор опознаём по имени: свой - не пересоздаём,
        // чужой при включении заменим, при выключении не тронем
        const current = track.getProcessor?.();
        const installed = current?.name === NoiseGateProcessor.PROCESSOR_NAME;

        if (enabled) {

            // Повторное включение тумблера не должно дёргать граф
            if (installed) return;

            // Браузер без Web Audio: фича отключена, но звук идёт как есть
            if (!NoiseGateProcessor.isSupported()) {
                Logger.warn("🔇 [meet-play][noise]: Шумоподавление не поддерживается браузером");
                return;
            }

            await track.setProcessor(new NoiseGateProcessor());
            Logger.debug("🔇 [LiveKit]: Процессор шумоподавления включён");

        } else {

            // Снимаем только свой процессор
            if (!installed) return;

            await track.stopProcessor();
            Logger.debug("🔇 [LiveKit]: Процессор шумоподавления выключен");

        }

    } catch (error) {

        Logger.error("🚨 [meet-play][noise]: Ошибка переключения шумоподавления:", error);

        // Тост вместо падения: включение микрофона уже состоялось,
        // сбой обработки не должен его отменить
        Toast.error(t("forms.meet_play.toasts.noise_error"));

    }

}
