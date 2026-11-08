// Загружаем сторонние модули
import Hls from "hls.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { stopRTCPlayer } from "./stop_rtc_player.js";
import { stopFLVPlayer } from "./stop_flv_player.js";
import { stopHLSPlayer } from "./stop_hls_player.js";
import { castTimingUpdate } from "./cast_timing_update.js";
import { loaderHide, loaderShow } from "./loader_control.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * START_HLS_PLAYER - запуск воспроизведения трансляции через HLS.
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после запуска (либо раннего выхода).
 * ***************************************************************************
 */
export async function startHLSPlayer(form: BroadcastPlay): Promise<void> {

    try {

        // Если трансляция не запущена
        if (!form.cast?.is_live) return;

        // Без адреса потока либо без <video> запускать нечего
        const hlsUrl = form.hlsUrl;
        const video = form.video;
        if (!hlsUrl || !video) return;

        // Проверка поддержки протокола — ВЫШЕ остановки текущего движка:
        // иначе движок остановится без тоста, и лоадер останется крутиться
        // на чёрном экране
        const canPlayNatively = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));

        if (!Hls.isSupported() && !canPlayNatively) {

            // Пользователю нужен тост, а не alert: он не блокирует интерфейс
            Toast.error(t("forms.broadcast_play.toasts.unsupported_format"));

            return;

        }

        // Отображаем лоадер: крутится, пока поток не заиграет
        // (гасит событие `playing`, см. loader_control.ts)
        loaderShow(form);

        // Останавливаем проигрыватели
        form.typePlay === "rtc" && stopRTCPlayer(form);
        form.typePlay === "flv" && stopFLVPlayer(form);
        form.typePlay === "hls" && stopHLSPlayer(form);

        // Записываем параметры
        form.typePlay = "hls";

        // Время трансляции
        form.castTiming = setInterval(() => { castTimingUpdate(form); }, 1000);

        // Нативный HLS (Safari/iOS): MSE недоступен, но сам <video> умеет
        // играть m3u8. Отдаём ему URL напрямую и выходим — ниже код работает
        // только с экземпляром hls.js.
        if (!Hls.isSupported()) {
            video.src = hlsUrl;
            form.player?.play();
            return;
        }

        // Создаем проигрыватель
        const engine = new Hls({
            lowLatencyMode: true,
            enableWorker: true,
            backBufferLength: 15,
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
            fragLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 2000,
            levelLoadingRetryDelay: 2000,
            fragLoadingRetryDelay: 2000,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 3,
            maxLiveSyncPlaybackRate: 1.5,
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
        });
        form.streamEngine = { kind: "hls", player: engine };

        // Загрузка ресурсов.
        //
        // ПОРЯДОК ВАЖЕН: сначала цепляем медиа, потом грузим манифест. При
        // обратном порядке hls.js стартует загрузку «в никуда» и часть
        // сегментов теряется до появления MEDIA_ATTACHED.
        engine.attachMedia(video);

        engine.on(Hls.Events.MEDIA_ATTACHED, () => {
            Logger.debug("[hls]: Видеоэлемент доступен");
            engine.loadSource(hlsUrl);
        });

        // Прокидываем уровни hls.js в Video.js: адаптер renditions превращает
        // их в родное меню «Качество». Уровни становятся известны только после
        // парсинга манифеста, поэтому подключаем адаптер именно здесь.
        engine.on(Hls.Events.MANIFEST_PARSED, () => {
            form.player?.attachHls(engine);
        });

        // Обработка ошибок
        engine.on(Hls.Events.ERROR, (_event, data) => {

            // Трансляция остановилась
            if (data.details === "bufferStalledError") {
                Logger.debug("[hls]: Буферизация остановилась. Проверяем, идет ли трансляция...");
                return;
            }

            // Фатальная ошибка
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        Logger.debug("[hls]: Сетевая ошибка, повтор...");
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        Logger.debug("[hls]: Ошибка мультимедиа, повтор...");
                        engine.recoverMediaError();
                        break;
                    default:
                        Logger.debug("[hls]: Невозможно продолжить, отключаем проигрыватель...");
                        stopHLSPlayer(form);

                        // Лоадер гасим: движок остановлен, крутиться больше
                        // не над чем — иначе после обрыва он висел бы вечно
                        loaderHide(form);
                        break;
                }
            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
