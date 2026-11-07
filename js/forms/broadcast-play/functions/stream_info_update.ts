// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { startHLSPlayer } from "./start_hls_player.js";
import { startFLVPlayer } from "./start_flv_player.js";
import { startRTCPlayer } from "./start_rtc_player.js";
import { stopFLVPlayer } from "./stop_flv_player.js";
import { stopHLSPlayer } from "./stop_hls_player.js";
import { stopRTCPlayer } from "./stop_rtc_player.js";
import { updateStats } from "./update_stats.js";
import { syncLiveState } from "./sync_live_state.js";
import { loaderHide } from "./loader_control.js";

// Импортируем requests
import { getStreamInfoRequest } from "../requests/get_stream_info.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * STREAM_INFO_UPDATE - периодический опрос состояния потока и синхронизация формы.
 *
 * Что здесь изменилось по сравнению с «просто обновить цифры»
 * ------------------------------------------------
 * Ответ `get stream info` — это единственный признак того, что поток
 * реально идёт: `cast.is_live` приходит один раз из `[broadcast]: open` и
 * дальше не меняется. Поэтому по ответу здесь же выставляется
 * `form.isStreamLive`, и именно от него зависит состояние эфира на корне
 * формы (см. functions/sync_live_state.ts).
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после синхронизации формы.
 * ***************************************************************************
 */
export async function streamInfoUpdate(form: BroadcastPlay): Promise<void> {

    try {

        // Получаем кол. просматривающих
        const response = await getStreamInfoRequest({ cast_id: form.castId });

        // Если ответ получен (модуль запроса пробрасывает ошибки reject'ом,
        // успешный конверт Answer имеет status: true, поэтому достаточно
        // проверки данных)
        if (response.data) {

            // Обновляем данные стрима
            if (form.cast) form.cast.stream = response.data;

            // Поток есть — фиксируем живость и обновляем статистику
            form.isStreamLive = true;
            updateStats(form, response.data);
            syncLiveState(form);

            // Добавляем класс
            form.video?.classList.add("live");

            // Если проигрывание не запущено.
            // Проверяем все три ветки: hls.js/mpegts.js (form.streamEngine),
            // RTC (form.peerConnection) и нативный HLS без движка (isPlaying).
            if (!form.isPlaying) {

                // Если тип проигрывания flv
                if (form.typePlay === "flv") {
                    startFLVPlayer(form);
                }

                // Если тип проигрывания hls
                if (form.typePlay === "hls") {
                    startHLSPlayer(form);
                }

                // Если тип проигрывания rtc
                if (form.typePlay === "rtc") {
                    startRTCPlayer(form);
                }

            }

        } else {

            // Поток отдан пустым (или статус не true) — поток остановлен.
            // Данные чистим до обновления статистики, иначе
            // updateStats подхватил бы устаревший стрим из формы
            if (form.cast) form.cast.stream = null;
            form.isStreamLive = false;

            // Останавливаем проигрыватели
            stopFLVPlayer(form);
            stopHLSPlayer(form);
            stopRTCPlayer(form);

            // Гасим лоадер: поток остановлен, крутить его больше не над чем —
            // состояние подпишет плейсхолдер «Эфир не запущен»
            loaderHide(form);

            // Удаляем класс
            form.video?.classList.remove("live");

            // Сбрасываем цифры: нули «0p», «0mbps» читались бы как
            // сведения о качестве, а не как отсутствие потока
            updateStats(form, null);
            syncLiveState(form);

        }

    } catch (error) {
        Logger.error(error);
    }

}
