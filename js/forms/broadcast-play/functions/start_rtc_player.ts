// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { stopRTCPlayer } from "./stop_rtc_player.js";
import { stopHLSPlayer } from "./stop_hls_player.js";
import { syncOmeRenditions } from "./ome_renditions_control.js";
import { castTimingUpdate } from "./cast_timing_update.js";
import { loaderHide, loaderShow } from "./loader_control.js";
import { getIceServers } from "./get_ice_servers.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * Максимальное ожидание завершения сбора ICE-кандидатов (мс).
 * После таймаута answer уходит без кандидатов — OME принимает и так
 * (trickle ICE для него не обязателен).
 */
const ICE_GATHERING_TIMEOUT_MS = 2000;

/**
 * Ответ сервера с offer-SDP в WebSocket-сигналинге OvenMediaEngine.
 * Формат: {"command":"offer","id":N,"sdp":{...},"candidates":[...]}
 */
interface OmeOfferMessage {
    /** Команда сигналинга. */
    command?: string;
    /** Идентификатор сессии — нужен во всех последующих сообщениях. */
    id?: number;
    /** Описание сессии (SDP). */
    sdp?: { sdp?: string; type?: string };
    /** ICE-кандидаты сервера (могут приходить и отдельным сообщением). */
    candidates?: OmeCandidate[];
}

/**
 * ICE-кандидат в формате WebSocket-сигналинга OME.
 */
interface OmeCandidate {
    /** Строка кандидата (формат ICE). */
    candidate?: string;
    /** Индекс медиа-линии. */
    sdpMLineIndex?: number;
    /** Идентификатор медиа-линии (video / audio) — может отсутствовать. */
    sdpMid?: string;
}

/**
 * ***************************************************************************
 * Список mid из описания сессии: OME именует m-lines (video, audio) и в
 * кандидатах sdpMid может не приходить. Подстановка "0" в этом случае не
 * совпадает с remoteDescription, и addIceCandidate отклоняется браузером
 * с ошибкой "No such transceiver".
 * @param description - Описание сессии (offer/answer).
 * @returns Массив mid в порядке медиа-линий.
 * ***************************************************************************
 */
function extractMids(description: RTCSessionDescription | null): string[] {

    if (!description?.sdp) return [];

    return description.sdp
        .split("\r\n")
        .filter((line) => line.startsWith("a=mid:"))
        .map((line) => line.slice("a=mid:".length));

}

/**
 * ***************************************************************************
 * START_RTC_PLAYER - запуск воспроизведения трансляции через WebRTC.
 *
 * Использует собственный WebSocket-сигналинг OvenMediaEngine (не WHEP):
 * клиент запрашивает offer, отвечает answer'ом и обменивается ICE-кандидатами.
 * Задержка воспроизведения — меньше секунды.
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после установки соединения (либо ошибки).
 * ***************************************************************************
 */
export async function startRTCPlayer(form: BroadcastPlay): Promise<void> {

    try {

        // Если трансляция не запущена
        if (!form.cast?.is_live) return;

        // Без адреса сигналинга подключаться неоткуда
        const rtcUrl = form.rtcUrl;
        const video = form.video;
        if (!rtcUrl || !video) return;

        // Отображаем лоадер: гасится по событию playing
        loaderShow(form);

        // Останавливаем проигрыватели
        form.typePlay === "rtc" && stopRTCPlayer(form);
        form.typePlay === "hls" && stopHLSPlayer(form);

        // Записываем параметры
        form.typePlay = "rtc";

        // Меню «Качество» подключаем ДО потока: Video.js перечитывает
        // список на loadstart, позже подписки не ставятся
        syncOmeRenditions(form, form.cast?.stream?.renditions ?? []);

        // Время трансляции
        form.castTiming = setInterval(() => { castTimingUpdate(form); }, 1000);

        // PeerConnection: ICE-серверы из сессии, остальное — дефолты OME
        const pc = new RTCPeerConnection({
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
            iceServers: getIceServers()
        });
        form.peerConnection = pc;

        // Видео и аудио принимаем обоими треками
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        // Дальше — поток в <video>
        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (stream && video.srcObject !== stream) {
                video.srcObject = stream;
            }
        };

        // WebSocket-сессия сигналинга
        const socket = new WebSocket(rtcUrl);
        form.rtcSocket = socket;

        // Идентификатор сессии OME: приходит в offer, нужен в answer/candidate/stop
        let sessionId: number | null = null;

        /**
         * Отправляет сообщение сигналинга (JSON с полем command).
         * @param payload - Тело сообщения.
         */
        const send = (payload: Record<string, unknown>): void => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(payload));
            }
        };

        /**
         * Собирает локальные ICE-кандидаты в формат OME: mid берётся
         * из того же SDP, что и индекс медиа-линии.
         * @returns Массив кандидатов.
         */
        const collectLocalCandidates = (): OmeCandidate[] => {

            const sdp = pc.localDescription?.sdp ?? "";
            const mids = extractMids(pc.localDescription);
            const lines = sdp.split("\r\n").filter((line) => line.startsWith("a=candidate:"));

            return lines.map((line, index) => {

                const mid = mids[index];

                return {
                    candidate: line.slice(2),
                    sdpMLineIndex: index,
                    // exactOptionalPropertyTypes: поле не должно существовать вовсе
                    ...(mid !== undefined ? { sdpMid: mid } : {})
                };

            });

        };

        /**
         * Добавляет кандидат сервера, подставляя недостающий mid из SDP.
         * @param candidate - Кандидат от OvenMediaEngine.
         * @param description - Описание сессии, к которому он относится.
         */
        const addRemoteCandidate = (candidate: OmeCandidate, description: RTCSessionDescription | null): void => {

            if (!candidate.candidate) return;

            // mid из кандидата, иначе — из описания по индексу медиа-линии
            const mid = candidate.sdpMid ?? extractMids(description)[candidate.sdpMLineIndex ?? 0];

            pc.addIceCandidate({
                candidate: candidate.candidate,
                sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
                ...(mid !== undefined ? { sdpMid: mid } : {})
            }).catch((error) => Logger.warn("[broadcast-play][rtc] кандидат сервера отклонён:", error));

        };

        // Отправка answer после завершения сбора кандидатов (с таймаутом)
        const sendAnswer = async (id: number): Promise<void> => {

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Ждём gathering complete, но не дольше таймаута: OME принимает
            // answer и без кандидатов, медленный сбор не должен блокировать старт
            await new Promise<void>((resolve) => {

                if (pc.iceGatheringState === "complete") {
                    resolve();
                    return;
                }

                const timer = setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS);
                const onStateChange = () => {
                    if (pc.iceGatheringState === "complete") {
                        clearTimeout(timer);
                        pc.removeEventListener("icegatheringstatechange", onStateChange);
                        resolve();
                    }
                };
                pc.addEventListener("icegatheringstatechange", onStateChange);

            });

            send({
                command: "answer",
                id,
                sdp: { sdp: pc.localDescription?.sdp ?? "", type: "answer" },
                candidates: collectLocalCandidates()
            });

        };

        // Обработка входящих сообщений сигналинга
        socket.onmessage = (event) => {

            let message: OmeOfferMessage;
            try {
                message = JSON.parse(String(event.data)) as OmeOfferMessage;
            } catch {
                Logger.warn("[broadcast-play][rtc] не удалось разобрать сообщение сигналинга");
                return;
            }

            // Offer от сервера: единственный момент, когда приходит id сессии
            if (message.command === "offer" && message.sdp?.sdp && message.id !== undefined) {

                sessionId = message.id;
                form.rtcSessionId = message.id;

                const offer: RTCSessionDescriptionInit = { type: "offer", sdp: message.sdp.sdp };

                pc.setRemoteDescription(offer)
                    .then(async () => {

                        // Кандидаты сервера могут идти в том же сообщении
                        for (const candidate of message.candidates ?? []) {
                            addRemoteCandidate(candidate, pc.remoteDescription);
                        }

                        await sendAnswer(message.id as number);

                    })
                    .catch((error) => {
                        Logger.error("[broadcast-play][rtc] ошибка обработки offer:", error);
                        stopRTCPlayer(form);
                        loaderHide(form);
                    });

                return;

            }

            // Отдельное сообщение с кандидатами сервера
            if (message.command === "candidate") {
                for (const candidate of message.candidates ?? []) {
                    addRemoteCandidate(candidate, pc.remoteDescription);
                }
                return;

            }

            // Ошибка сервера: {"code":N,"error":"..."}
            if (message.command === undefined && "error" in message) {
                Logger.error(`[broadcast-play][rtc] ошибка сигналинга: ${JSON.stringify(message)}`);
                stopRTCPlayer(form);
                loaderHide(form);
            }

        };

        // Запрос offer — единственный шаг, не требующий id
        socket.onopen = () => {
            send({ command: "request_offer" });
        };

        // Обрыв соединения — снимаем лоадер и гасим плеер
        socket.onclose = () => {
            if (form.typePlay === "rtc") {
                Logger.debug("[broadcast-play][rtc] соединение закрыто");
                stopRTCPlayer(form);
                loaderHide(form);
            }
        };

        socket.onerror = () => {
            Logger.error("[broadcast-play][rtc] ошибка WebSocket");
        };

        // Воспроизведение началось — гасим лоадер
        const onPlaying = () => {
            loaderHide(form);
            video.removeEventListener("playing", onPlaying);
        };
        video.addEventListener("playing", onPlaying);

        // Таймаут: если offer не пришёл — не оставляем лоадер висеть
        setTimeout(() => {
            if (form.typePlay === "rtc" && sessionId === null) {
                Logger.warn("[broadcast-play][rtc] offer не получен, останавливаем");
                stopRTCPlayer(form);
                loaderHide(form);
            }
        }, 10000);

    } catch (error) {
        Logger.error(error);
        stopRTCPlayer(form);
        loaderHide(form);
    }

}
