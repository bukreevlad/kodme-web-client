// Импортируем сторонние пакеты
import type { AudioCaptureOptions, LocalTrack } from "livekit-client";

/**
 * ***************************************************************************
 * micCaptureOptions - опции захвата микрофона для конференции.
 *
 * Автоусиление (AGC) выключается при включённом шумодаве: AGC в паузах
 * задирает усиление входа, «вспучивая» шумовой пол и воюя с гейтом.
 * @param {boolean} noiseEnabled - Включён ли шумоподавление.
 * @returns {AudioCaptureOptions} - Опции захвата для LiveKit.
 * ***************************************************************************
 */
export function micCaptureOptions(noiseEnabled: boolean): AudioCaptureOptions {

    return {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: !noiseEnabled
    };

}

/**
 * ***************************************************************************
 * syncMicCaptureOptions - приводит захват живого трека микрофона к
 * опциям `micCaptureOptions`.
 *
 * При расхождении трек перезахватывается (`restartTrack` сам пересобирает
 * процессор и подменяет трек в отправителе). Пока микрофон выключен,
 * перезахват пропускается - захват и так будет собран с нужными опциями
 * при следующем включении.
 * @param {LocalTrack} track - Трек микрофона.
 * @param {boolean} noiseEnabled - Включён ли шумоподавление.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
export async function syncMicCaptureOptions(track: LocalTrack, noiseEnabled: boolean): Promise<void> {

    if (track.isMuted) return;

    const wanted = micCaptureOptions(noiseEnabled);
    const settings = track.getSourceTrackSettings();

    // Браузер не сообщил текущее значение - не трогаем: захват собран
    // с теми же опциями при включении микрофона
    if (settings.autoGainControl === undefined || settings.autoGainControl === wanted.autoGainControl) return;

    // Устройство сохраняем явно: иначе перезахват уйдёт на устройство по умолчанию
    await track.restartTrack(settings.deviceId
        ? { ...wanted, deviceId: settings.deviceId }
        : wanted
    );

}
