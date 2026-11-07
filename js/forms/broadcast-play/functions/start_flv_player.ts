// Загружаем сторонние модули
import Mpegts from "mpegts.js";

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

/**
 * ***************************************************************************
 * START_FLV_PLAYER - запуск воспроизведения трансляции через FLV.
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после запуска (либо раннего выхода).
 * ***************************************************************************
 */
export async function startFLVPlayer(form: BroadcastPlay): Promise<void> {

    try {

        // Если трансляция не запущена
        if (!form.cast?.is_live) return;

        // Без адреса потока либо без <video> запускать нечего: раньше
        // createPlayer получал null, а attachMediaElement падал с TypeError
        const flvUrl = form.flvUrl;
        const video = form.video;
        if (!flvUrl || !video) return;

        // Проверка поддержки протокола — ВЫШЕ остановки текущего движка.
        //
        // Раньше проверка шла после Stop*: браузер без MSE получал сначала
        // остановку работающего потока, потом тост, а лоадер так и оставался
        // висеть поверх чёрного экрана. Теперь неудачное переключение не
        // трогает уже работающий движок
        if (!Mpegts.getFeatureList().mseLivePlayback) {

            // Пользователю нужен тост, а не alert: он не блокирует интерфейс
            Toast.error(window._lc?.forms?.broadcast_play?.toasts?.unsupported_format
                    || window._lc?.api?.errors?.server_error
                    || "Ошибка сервера");

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
        form.typePlay = "flv";

        // Инициализируем проигрыватель
        const engine = Mpegts.createPlayer({
            type: "flv",
            isLive: true,
            url: flvUrl
        });
        form.streamEngine = { kind: "flv", player: engine };

        // Привязываем к видео. FLV — это не renditions, поэтому адаптер
        // качества (attachHls) здесь не подключается: у потока один уровень.
        engine.attachMediaElement(video);
        engine.load();
        engine.play();

        // Обработка ошибок
        engine.on(Mpegts.Events.ERROR, (type: string) => {
            if (type === Mpegts.ErrorTypes.NETWORK_ERROR) {
                Logger.warn("[mpegts.js] Проблема с сетью...");
                stopFLVPlayer(form);

                // Лоадер гасим: движок мёртв, крутиться больше не над чем.
                // Иначе после обрыва сети он висел бы до закрытия формы
                loaderHide(form);
            }

            if (type === Mpegts.ErrorTypes.MEDIA_ERROR) {
                Logger.warn("[mpegts.js] Ошибка медиадекодирования...");
            }
        });

        // Медиа информация
        engine.on(Mpegts.Events.MEDIA_INFO, (stats: Mpegts.MSEPlayerMediaInfo) => {
            if (form.fps) form.fps.textContent = `${Math.round(stats.fps || 0)}fps`;
        });

        // Время трансляции
        form.castTiming = setInterval(() => { castTimingUpdate(form); }, 1000);

    } catch (error) {
        Logger.error(error);
    }

}
