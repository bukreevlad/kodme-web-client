// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * ENABLE_STEREO_FROM_SDP - включает стерео Opus в SDP-описании.
 *
 * SRS по умолчанию отдает моно Opus: rtpmap вида opus/48000 без
 * канальной маски, а fmtp без stereo-параметров. Без правки SDP звук
 * трансляции сжимается до одной дорожки. Функция приводит rtpmap к
 * opus/48000/2 и вставляет/обновляет fmtp-параметры stereo=1 и
 * sprop-stereo=1 — и в локальном описании, и в ответе медиасервера.
 *
 * Любая ошибка разбора возвращает исходный SDP: без стерео эфир играет,
 * а битый SDP оставляет пользователя без картинки.
 *
 * @param sdp - Исходное SDP-описание.
 * @returns SDP со включенным стерео (либо исходный при ошибке).
 * ***************************************************************************
 */
export function enableStereoFromSDP(sdp: string): string {

    try {

        // Раскладываем по строкам
        const lines = sdp.split("\r\n");

        // Записываем параметры
        let opusPt: string | null = null;
        let rtpmapIndex = -1;

        // 1) Найти Opus payload type
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const m = line.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/\d+)?/i);
            if (m) {
                opusPt = m[1] ?? null;
                rtpmapIndex = i;
                break;
            }
        }
        // Если opus не найден
        if (!opusPt) {
            Logger.debug("[app][cast]: Opus codec not found in SDP");
            return sdp;
        }

        // 2) Привести rtpmap к opus/48000/2
        if (rtpmapIndex >= 0) {
            const rtpmapLine = lines[rtpmapIndex];
            if (rtpmapLine) {
                lines[rtpmapIndex] = rtpmapLine.replace(
                    /opus\/48000(?:\/\d+)?/i,
                    "opus/48000/2"
                );
            }
        }

        // 3) Найти fmtp для этого payload type
        const fmtpRe = new RegExp(`^a=fmtp:${opusPt}\\s+(.+)$`, "i");
        let fmtpIndex = -1;
        let fmtpParams = "";

        // Проходим по строкам
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const m = line.match(fmtpRe);
            if (m) {
                fmtpIndex = i;
                fmtpParams = m[1] || "";
                break;
            }
        }

        // Вставка стерео
        const upsertStereoParams = (paramStr: string): string => {
            // Разобрать "k=v;k2=v2;flag" в Map
            const parts = paramStr
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean);

            const map = new Map<string, string>();
            for (const p of parts) {
                const [k, ...rest] = p.split("=");
                const key = (k || "").trim().toLowerCase();
                if (!key) continue;
                const val = rest.join("=").trim();
                map.set(key, val); // может быть "" для флагов
            }

            // Добавить/обновить нужные параметры
            map.set("stereo", "1");
            map.set("sprop-stereo", "1");

            // Собрать обратно
            return Array.from(map.entries())
                .map(([k, v]) => (v === "" ? k : `${k}=${v}`))
                .join(";");
        };

        if (fmtpIndex === -1) {
            // fmtp нет — вставляем сразу после rtpmap opus
            const insertAt = rtpmapIndex >= 0 ? rtpmapIndex + 1 : lines.length;
            lines.splice(insertAt, 0, `a=fmtp:${opusPt} stereo=1;sprop-stereo=1`);
        } else {
            // fmtp есть — обновляем параметры
            const newParams = upsertStereoParams(fmtpParams);
            lines[fmtpIndex] = `a=fmtp:${opusPt} ${newParams}`;
        }

        Logger.debug(`[app][cast]: Updated SDP for Opus stereo. PT=${opusPt}`);
        return lines.join("\r\n");

    } catch (error) {
        Logger.error("[app][cast]: Error in SDP stereo modification:", error);
        return sdp;
    }

}
