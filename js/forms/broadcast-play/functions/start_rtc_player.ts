// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { stopRTCPlayer } from "./stop_rtc_player.js";
import { stopFLVPlayer } from "./stop_flv_player.js";
import { stopHLSPlayer } from "./stop_hls_player.js";
import { rtcStatsUpdate } from "./rtc_stats_update.js";
import { castTimingUpdate } from "./cast_timing_update.js";
import { enableStereoFromSDP } from "./enable_stereo_from_sdp.js";
import { loaderHide, loaderShow } from "./loader_control.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * START_RTC_PLAYER - запуск воспроизведения трансляции через WHEP (SRS).
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после установки соединения (либо ошибки).
 * ***************************************************************************
 */
export async function startRTCPlayer(form: BroadcastPlay): Promise<void> {

    try {

        // Если трансляция не запущена
        if (!form.cast?.is_live) return;

        // Без адреса WHEP подключаться неоткуда — раньше fetch получал null
        const whepUrl = form.whepUrl;
        if (!whepUrl) return;

        // Отображаем лоадер: крутится, пока соединение не установится
        // и видео не заиграет (гасит событие `playing`, см. loader_control.ts)
        loaderShow(form);

        // Останавливаем проигрыватели
        form.typePlay === "rtc" && stopRTCPlayer(form);
        form.typePlay === "flv" && stopFLVPlayer(form);
        form.typePlay === "hls" && stopHLSPlayer(form);

        // Записываем параметры
        form.typePlay = "rtc";

        // Создаем PeerConnection
        form.peerConnection = new RTCPeerConnection(form.pcConfig);

        // Получение медиапотока из PeerConnection и отображение в <video>.
        // Ссылку на <video> берём у VideoPlayer: это тот же нативный элемент,
        // который оборачивает UI, поэтому RTC-стенд не заменяется плеером.
        form.peerConnection.ontrack = (event) => {
            const stream = event.streams[0];
            if (form.video && stream && form.video.srcObject !== stream) {
                form.video.srcObject = stream;
            }
        };

        // Добавляем трансиверы
        form.peerConnection.addTransceiver("audio", { direction: "recvonly" });
        form.peerConnection.addTransceiver("video", { direction: "recvonly" });

        // Создаем offer
        const offer = await form.peerConnection.createOffer();

        // Без SDP оффер бесполезен: чистим peer и лоадер, как и в ветке
        // неудачного ответа ниже
        if (!offer.sdp) {
            Logger.error("WHEP offer sdp failed");
            stopRTCPlayer(form);
            loaderHide(form);
            return;
        }

        // Запрашиваем стерео
        offer.sdp = enableStereoFromSDP(offer.sdp);

        // Устанавливаем offer
        await form.peerConnection.setLocalDescription(offer);

        // Отправляем offer на SRS и получаем answer
        const response = await fetch(whepUrl, {
            method: "POST", headers: { "Content-Type": "application/sdp; charset=utf-8" },
            body: offer.sdp
        });

        // Неудача WHEP: чистим за собой — иначе лоадер висит поверх
        // пустой сцены, а RTCPeerConnection остаётся до закрытия формы
        if (!response.ok) {
            Logger.error("WHEP request failed:", response);
            stopRTCPlayer(form);
            loaderHide(form);
            return;
        }

        // Устанавливаем ответ медиа сервера
        let answerSdp = await response.text();

        // Проверка ответа
        if (!answerSdp) {
            Logger.error("WHEP answer sdp failed:", response);
            stopRTCPlayer(form);
            loaderHide(form);
            return;
        }

        // Запрашиваем стерео
        answerSdp = enableStereoFromSDP(answerSdp);

        // Устанавливаем ответ
        await form.peerConnection.setRemoteDescription(new RTCSessionDescription({
            type: "answer", sdp: answerSdp
        }));

        // Время трансляции
        form.castTiming = setInterval(() => { castTimingUpdate(form); }, 1000);

        // Запускаем статистику rtc трансляции
        form.rtcStatTiming = setInterval(() => { rtcStatsUpdate(form); }, 1000);

    } catch (error) {

        // Любой сбой установки соединения (обрыв сети, запрет доступа)
        // должен снимать лоадер и закрывать peer, иначе форма остаётся
        // в состоянии «грузится» до самой перезагрузки страницы
        Logger.error(error);
        stopRTCPlayer(form);
        loaderHide(form);

    }

}
