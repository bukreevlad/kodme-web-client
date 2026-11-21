// Импортируем сторонние пакеты
import Hls from "hls.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastCast } from "../types.js";

/**
 * Задержка перед стартом превью (мс): мышь должна задержаться на карточке,
 * мгновенный проезд не запускает поток.
 */
export const PREVIEW_DELAY_MS = 2000;

/**
 * Управление активным hover-превью.
 */
export interface HoverPreviewHandle {

    /** Остановить плеер и удалить видеоэлемент. Идемпотентна. */
    stop: () => void;

}

/**
 * ***************************************************************************
 * START_HOVER_PREVIEW - живой поток трансляции поверх обложки карточки.
 *
 * Плеер без элементов управления: muted-видео плавно проявляется по событию
 * `playing`, при остановке удаляется — под ним снова видна обложка. Поток —
 * LL-HLS (hls.js) с токеном просмотра из данных записи.
 *
 * Настройки отличаются от полного воспроизведения: буфер урезан, старт — с
 * самого дешёвого уровня. Для превью важнее быстрый старт и экономия трафика,
 * чем низкая задержка и высокое разрешение.
 *
 * @param data - Данные трансляции (нужны id, is_live, access_token).
 * @param container - Media-контейнер карточки (aspect-16/9).
 * @returns Управление плеером либо null, если запускать нечего.
 * ***************************************************************************
 */
export function startHoverPreview(data: BroadcastCast, container: HTMLElement): HoverPreviewHandle | null {

    // Превью имеет смысл только для живого эфира с токеном
    if (!data.is_live || !data.access_token) return null;

    // Без MSE превью не запускаем (фоновое — молча)
    if (!Hls.isSupported()) {
        Logger.warn("[broadcasts][hover-preview] MSE/HLS не поддерживается");
        return null;
    }

    // Видео без контролов — превью только для показа
    const video = document.createElement("video");
    video.muted = true; // автозапуск разрешён только без звука
    video.autoplay = true;
    video.playsInline = true;
    video.className = "absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300";

    // Первый кадр — плавно проявляем поверх обложки
    const onPlaying = () => video.classList.remove("opacity-0");
    video.addEventListener("playing", onPlaying);

    // Под LIVE-бейджем, чтобы индикатор остался сверху
    container.insertBefore(video, container.querySelector(":scope [data-is-live]"));

    // Адрес потока — LL-HLS master-плейлист с токеном просмотра
    const url = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/hls/live/${data.id}/abr.m3u8?token=${data.access_token}`;

    const engine = new Hls({
        // Превью должно стартовать быстро: частичные сегменты LL-HLS
        lowLatencyMode: true,
        enableWorker: true,
        // Буфер урезан — превью живёт недолго, копить назад нечего
        backBufferLength: 0,
        maxBufferLength: 3,
        maxMaxBufferLength: 5,
        // Превью маленькое — уровень ограничивается размером плеера,
        // а стартовая оценка битрейта сдвигает ABR в сторону дешёвых уровней
        capLevelToPlayerSize: true,
        abrEwmaDefaultEstimate: 150000,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 1
    });

    let stopped = false;

    const stop = (): void => {

        // Повторная остановка (mouseleave + удаление записи) — no-op
        if (stopped) return;
        stopped = true;

        try {
            engine.destroy();
        } catch (error) {
            Logger.warn("[broadcasts][hover-preview] ошибка остановки:", error);
        }

        video.removeEventListener("playing", onPlaying);
        video.pause();
        video.remove();

    };

    // Обрыв или ошибка потока — превью гасим: оно фоновое, тост не показываем
    engine.on(Hls.Events.ERROR, (_event, error) => {
        Logger.warn(`[broadcasts][hover-preview] ошибка потока: ${error.details}`);
        stop();
    });

    // Порядок важен: сначала цепляем медиа, потом грузим манифест
    engine.attachMedia(video);

    engine.on(Hls.Events.MEDIA_ATTACHED, () => {
        engine.loadSource(url);
    });

    return { stop };

}
