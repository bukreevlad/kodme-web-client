// Импортируем сторонние пакеты
import Mpegts from "mpegts.js";

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
 * HTTP-FLV (mpegts.js) с токеном просмотра из данных записи.
 *
 * @param data - Данные трансляции (нужны id, is_live, access_token).
 * @param container - Media-контейнер карточки (aspect-16/9).
 * @returns Управление плеером либо null, если запускать нечего.
 * ***************************************************************************
 */
export function startHoverPreview(data: BroadcastCast, container: HTMLElement): HoverPreviewHandle | null {

    // Превью имеет смысл только для живого эфира с токеном
    if (!data.is_live || !data.access_token) return null;

    // FLV требует MSE: без него превью не запускаем (фоновое — молча)
    if (!Mpegts.getFeatureList().mseLivePlayback) {
        Logger.warn("[broadcasts][hover-preview] MSE live playback не поддерживается");
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

    // Адрес потока — как у полного воспроизведения: HTTP-FLV + токен просмотра
    const url = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/flv/live/${data.id}.flv?token=${data.access_token}`;

    const engine = Mpegts.createPlayer({ type: "flv", isLive: true, url });

    let stopped = false;

    const stop = (): void => {

        // Повторная остановка (mouseleave + удаление записи) — no-op
        if (stopped) return;
        stopped = true;

        try {
            engine.unload();
            engine.detachMediaElement();
            engine.destroy();
        } catch (error) {
            Logger.warn("[broadcasts][hover-preview] ошибка остановки:", error);
        }

        video.removeEventListener("playing", onPlaying);
        video.pause();
        video.remove();

    };

    // Обрыв или ошибка потока — превью гасим: оно фоновое, тост не показываем
    engine.on(Mpegts.Events.ERROR, (type: string) => {
        Logger.warn(`[broadcasts][hover-preview] ошибка потока: ${type}`);
        stop();
    });

    engine.attachMediaElement(video);
    engine.load();
    engine.play();

    return { stop };

}
