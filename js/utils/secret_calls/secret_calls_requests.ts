// Импортируем config
import { Socket } from "../../config/socket.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Данные запроса "[secret-call]: signal".
 */
export interface SecretCallSignalData {

    /** Id секретного звонка. */
    call_id: string;

    /** Устройство-получатель (session_id). */
    target_device_id: string;

    /** Тип сигнала: offer / answer / candidate / hangup. */
    type: string;

    /** SDP (для offer/answer). */
    sdp: string | null;

    /** ICE-candidate (для candidate). */
    candidate: string | null;

}

/**
 * ***************************************************************************
 * Ретрансляция WebRTC-сигнала (SDP/ICE) секретного звонка устройству
 * собеседника.
 * @param {SecretCallSignalData} data - Данные запроса.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function signalRequest(data: SecretCallSignalData): Promise<Answer<{ delivered: boolean }>> {
    return Socket.client.timeout(5000).emitWithAck<{ delivered: boolean }>("[secret-call]: signal", data);
}
