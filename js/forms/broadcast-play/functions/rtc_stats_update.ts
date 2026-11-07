// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { getRtcStats } from "./rtc_stats.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * RTC_STATS_UPDATE - обновляет чипы fps и битрейта из статистики RTC.
 *
 * Вызывается раз в секунду из start_rtc_player, пока живет
 * RTCPeerConnection. Значения пересчитываются по разнице двух последних
 * отчетов (см. functions/rtc_stats.ts), поэтому первый тик показывает нули.
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после обновления чипов.
 * ***************************************************************************
 */
export async function rtcStatsUpdate(form: BroadcastPlay): Promise<void> {

    try {

        // Если peerConnection отключен
        if (!form.peerConnection) return;

        // Получаем статистику (undefined при ошибке чтения отчета)
        const stats = await getRtcStats(form.peerConnection);
        if (!stats) return;

        // Если есть разрешение
        if (stats.video.height) {
            if (form.fps) form.fps.textContent = `${stats.video.fps}fps`;
            if (form.bitrate) form.bitrate.textContent = `${stats.video.mbps}mbps`;
        }

    } catch (error) {
        Logger.error(error);
    }

}
