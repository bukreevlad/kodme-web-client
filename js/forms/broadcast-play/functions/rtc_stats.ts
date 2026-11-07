// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Последняя сохраненная информация
let lastVideoStats = { timestamp: 0, bytesReceived: 0, frames: 0 };
let lastAudioStats = { timestamp: 0, bytesReceived: 0 };

/**
 * Статистика одного inbound-rtp отчета RTCStatsReport.
 */
interface InboundRtpReport {

    /** Метка времени отчета (мс). */
    timestamp?: number;

    /** Суммарно получено байт. */
    bytesReceived?: number;

    /** Количество декодированных кадров. */
    framesDecoded?: number;

    /** Количество полученных кадров (fallback). */
    framesReceived?: number;

    /** Количество отрисованных кадров (Safari). */
    framesRendered?: number;

    /** Ширина кадра. */
    frameWidth?: number;

    /** Высота кадра. */
    frameHeight?: number;

}

/**
 * Собранная статистика потока RTC.
 */
export interface RtcStreamInfo {

    /** Статистика видео. */
    video: {

        /** Кодек видео (mimeType из отчета codec). */
        codec: string | null;

        /** Ширина кадра. */
        width: number;

        /** Высота кадра. */
        height: number;

        /** Битрейт в битах в секунду. */
        bitrate: number;

        /** Битрейт в мегабитах в секунду. */
        mbps: number;

        /** Кадров в секунду. */
        fps: number;

    };

    /** Статистика аудио. */
    audio: {

        /** Кодек аудио (mimeType из отчета codec). */
        codec: string | null;

        /** Битрейт в битах в секунду. */
        bitrate: number;

    };

}

/**
 * ***************************************************************************
 * RTC_STATS - собирает статистику входящих потоков RTC-соединения.
 *
 * Битрейт и fps считаются по разнице между двумя последними отчетами
 * (модули хранят предыдущие значения), поэтому первый вызов только
 * запоминает базу и возвращает нули.
 *
 * @param pc - RTCPeerConnection.
 * @returns Статистика потока либо undefined при ошибке чтения отчета.
 * ***************************************************************************
 */
export async function getRtcStats(pc: RTCPeerConnection): Promise<RtcStreamInfo | undefined> {

    try {

        const stats = await pc.getStats(null);
        const info: RtcStreamInfo = {
            video: { codec: null, width: 0, height: 0, bitrate: 0, mbps: 0, fps: 0 },
            audio: { codec: null, bitrate: 0 }
        };

        // Отчеты inbound-rtp собираем в массивы: присваивание в замыкании
        // forEach сужение локальных let-переменных не сохраняет (тип схлопывался
        // в never); как и в легаси, берём первый подходящий отчет
        const videoReports: InboundRtpReport[] = [];
        const audioReports: InboundRtpReport[] = [];
        let videoCodec: string | null = null;
        let audioCodec: string | null = null;

        stats.forEach(report => {

            // invariant: отчет — запись с произвольными полями, читаем
            // только известные клиенту свойства inbound-rtp и codec
            const entry = report as InboundRtpReport & { type?: string; kind?: string; mimeType?: string };

            if (entry.type === "inbound-rtp") {
                if (entry.kind === "video" && videoReports.length === 0) videoReports.push(entry);
                if (entry.kind === "audio" && audioReports.length === 0) audioReports.push(entry);
            }
            if (entry.type === "codec") {
                if (entry.mimeType?.includes("video") && !videoCodec) videoCodec = entry.mimeType;
                if (entry.mimeType?.includes("audio") && !audioCodec) audioCodec = entry.mimeType;
            }
        });

        const videoInbound = videoReports[0];
        const audioInbound = audioReports[0];

        if (videoInbound) {
            const currentFrames = _getVideoFramesCount(videoInbound);

            if (!lastVideoStats.timestamp) {
                lastVideoStats.timestamp = videoInbound.timestamp || 0;
                lastVideoStats.bytesReceived = videoInbound.bytesReceived || 0;
                lastVideoStats.frames = currentFrames;
            } else {
                const timeDiff = ((videoInbound.timestamp || 0) - lastVideoStats.timestamp) / 1000; // в секундах
                const byteDiff = (videoInbound.bytesReceived || 0) - lastVideoStats.bytesReceived;
                const framesDiff = currentFrames - lastVideoStats.frames;

                if (timeDiff > 0 && byteDiff >= 0) {
                    const bitrate = (byteDiff * 8) / timeDiff; // в битах в секунду
                    info.video.bitrate = Math.round(bitrate);
                    info.video.mbps = +(bitrate / 1_000_000).toFixed(2); // мегабиты в секунду с двумя знаками
                }

                if (timeDiff > 0 && framesDiff >= 0) {
                    info.video.fps = Math.round(framesDiff / timeDiff);
                }

                lastVideoStats.timestamp = videoInbound.timestamp || 0;
                lastVideoStats.bytesReceived = videoInbound.bytesReceived || 0;
                lastVideoStats.frames = currentFrames || 0;
            }

            info.video.width = videoInbound.frameWidth || 0;
            info.video.height = videoInbound.frameHeight || 0;
        }

        if (audioInbound) {
            if (!lastAudioStats.timestamp) {
                lastAudioStats.timestamp = audioInbound.timestamp || 0;
                lastAudioStats.bytesReceived = audioInbound.bytesReceived || 0;
            } else {
                const timeDiff = ((audioInbound.timestamp || 0) - lastAudioStats.timestamp) / 1000;
                const byteDiff = (audioInbound.bytesReceived || 0) - lastAudioStats.bytesReceived;
                if (timeDiff > 0 && byteDiff >= 0) {
                    info.audio.bitrate = Math.round((byteDiff * 8) / timeDiff);
                }
                lastAudioStats.timestamp = audioInbound.timestamp || 0;
                lastAudioStats.bytesReceived = audioInbound.bytesReceived || 0;
            }
        }

        info.video.codec = videoCodec;
        info.audio.codec = audioCodec;

        return info;

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Приватный: количество декодированных кадров из отчета inbound-rtp.
 * @param report - Отчет статистики входящего видеопотока.
 * @returns Количество кадров (0, если браузер не отдает ни одно из полей).
 * ***************************************************************************
 */
function _getVideoFramesCount(report: InboundRtpReport): number {

    // Пытаемся получить количество декодированных кадров (Chrome, Firefox)
    if (typeof report.framesDecoded === "number") return report.framesDecoded;
    if (typeof report.framesReceived === "number") return report.framesReceived;
    if (typeof report.framesRendered === "number") return report.framesRendered; // Safari
    return 0;

}
