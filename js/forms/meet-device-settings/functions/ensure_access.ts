// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorName } from "../../../utils/helpers/error_util.js";

/**
 * Состояние доступа к одному классу устройств.
 */
export type AccessState = "granted" | "denied" | "notfound";

/**
 * Результат запроса доступа к устройствам.
 */
export interface AccessResult {

    /** Доступ к камере. */
    videoinput: AccessState;

    /** Доступ к микрофону. */
    audioinput: AccessState;

    /** Браузер вообще не умеет `mediaDevices`. */
    unsupported: boolean;

}

/**
 * ***************************************************************************
 * ensureAccess - Запрашивает доступ к камере и микрофону перед перечислением.
 *
 * Зачем это нужно, если кажется, что «LiveKit и так всё спросил»: не
 * спрашивал. Публиковать источники конференция начинает только по кнопке
 * в футере (`toggle_audio` / `toggle_video`), а окна перед входом нет, то
 * есть к моменту, когда пользователь открывает «Камера и микрофон»,
 * успешного `getUserMedia` в этой сессии ещё не было. Браузер в таком
 * случае отдаёт `enumerateDevices` с **пустым `deviceId`** у каждого
 * устройства (и без подписи), а выбрать устройство без id нельзя —
 * значит, список был пуст всегда, и объяснять это пользователю было
 * нечем: форма утверждал, что браузер не дал доступ, и не давал способа
 * его дать.
 *
 * Два нюанса, из-за которых здесь не один запрос, а ветвление:
 *   - **Один запрос вместо двух.** Chrome спросит разрешение на камеру и
 *     микрофон вместе, по отдельности — двумя диалогами. Поэтому сначала
 *     просим оба, а повторно по одному обращаемся только тогда, когда
 *     общий запрос провалился из-за отсутствия устройства.
 *   - **Нет камеры ≠ нет микрофона.** На ноутбуке без веб-камеры общий
 *     запрос отклоняется целиком (`NotFoundError`), и микрофон потерялся
 *     бы вместе с камерой. Поэтому `notfound` — это не «доступа нет», а
 *     «устройства такого класса нет», и для второго класса запрос
 *     повторяется отдельно.
 *
 * Запрет не переспрашивается: браузер помнит решение и второй запрос
 * только раздражает (и может показать лишний диалог в Firefox).
 * @returns Состояние доступа по каждому классу.
 * ***************************************************************************
 */
export async function ensureAccess(): Promise<AccessResult> {

    const result: AccessResult = { videoinput: "notfound", audioinput: "notfound", unsupported: false };

    try {

        // ---------- UNSUPPORTED ----------
        // Старые браузеры и небезопасный контекст (http, не https).
        // Тут же гасим свет: устройства не перечислить в принципе, и
        // пустой список без объяснения выглядел бы как ошибка вёрстки
        if (typeof navigator === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
            result.unsupported = true;
            Logger.warn("[meet-play][devices]: mediaDevices недоступен (нужен https)");
            return result;
        }
        // ---------- UNSUPPORTED ----------

        // ---------- BOTH AT ONCE ----------
        const both = await request(navigator.mediaDevices, { audio: true, video: true });

        if (both === "granted") {
            result.videoinput = "granted";
            result.audioinput = "granted";
            return result;
        }

        // Запрет: повторный запрос по одному лишь усугубит ситуацию
        if (both === "denied") {
            result.videoinput = "denied";
            result.audioinput = "denied";
            return result;
        }
        // ---------- BOTH AT ONCE ----------

        // ---------- PER KIND ----------
        // Общий запрос упал из-за отсутствия устройства: значит, отсутствует
        // один из классов, а второй вполне может быть. Спрашиваем по одному,
        // и тогда отсутствующий так и останется `notfound`
        const [video, audio] = await Promise.all([
            request(navigator.mediaDevices, { video: true }),
            request(navigator.mediaDevices, { audio: true })
        ]);

        result.videoinput = video;
        result.audioinput = audio;
        // ---------- PER KIND ----------

        return result;

    } catch (error) {
        Logger.warn("[meet-play][devices]: Ошибка запроса доступа:", error);
        return result;

    }

}

/**
 * ***************************************************************************
 * request - Один запрос `getUserMedia` с обязательным освобождением потока.
 * @param mediaDevices - `navigator.mediaDevices`.
 * @param constraints - Ограничения (`{ audio: true }` и т. п.).
 * @returns Итог запроса.
 * ***************************************************************************
 */
async function request(mediaDevices: MediaDevices, constraints?: MediaStreamConstraints): Promise<AccessState> {

    try {

        const stream = await mediaDevices.getUserMedia(constraints);

        // Поток нужен был только ради разрешения браузера, поэтому гасим
        // его сразу. Забытый трек здесь — это висящая лампочка камеры и
        // устройство, которое LiveKit потом не сможет занять
        for (const track of stream?.getTracks?.() || []) {
            try { track.stop(); } catch (error) { Logger.debug("[meet-play][devices]: Не удалось остановить трек:", error); }
        }

        return "granted";

    } catch (error) {

        // Запрет: браузер помнит решение, повторный запрос не поможет
        if (getErrorName(error) === "NotAllowedError" || getErrorName(error) === "SecurityError") return "denied";

        // Устройства такого класса нет. `DevicesNotFoundError` — старое
        // имя того же самого в Chromium
        if (getErrorName(error) === "NotFoundError" || getErrorName(error) === "DevicesNotFoundError") return "notfound";

        Logger.debug("[meet-play][devices]: getUserMedia не удался:", getErrorName(error), getErrorMessage(error));
        return "notfound";

    }

}
