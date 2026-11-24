// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { formatBytes } from "../../../utils/string/format_bytes.js";

// Импортируем functions
import { getRtcStats } from "./rtc_stats.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * RTC_STATS_UPDATE - обновляет чипы статистики из соединения RTC.
 *
 * Вызывается раз в секунду из start_rtc_player, пока живет
 * RTCPeerConnection. Битрейт и fps пересчитываются по разнице двух
 * последних отчетов (см. functions/rtc_stats.ts), поэтому первый тик
 * показывает нули. Пока играет RTC, эти чипы ведутся локально —
 * серверный опрос их не перетирает (см. functions/update_stats.ts).
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

        // Значения реальные для этого зрителя: высота кадра, кадры/с,
        // скорость получения и накопленный объём трафика
        if (stats.video.height) {
            if (form.resolution) form.resolution.textContent = `${stats.video.height}p`;
            if (form.fps) form.fps.textContent = `${stats.video.fps}fps`;
            if (form.bitrate) form.bitrate.textContent = `${stats.video.mbps}mbps`;
        }
        if (form.incoming && stats.video.bytesReceived) {
            form.incoming.textContent = formatBytes(stats.video.bytesReceived);
            form.incoming.parentElement?.setAttribute("data-chip-empty", "false");
        }

    } catch (error) {
        Logger.error(error);
    }

}
