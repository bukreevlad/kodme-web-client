// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

/**
 * Устройство одного класса для показа в списке.
 */
export interface MediaDeviceItem {

    /** Идентификатор устройства. */
    deviceId: string;

    /** `videoinput` или `audioinput`. */
    kind: "videoinput" | "audioinput";

    /** Название для показа. Пустая строка браузера заменяется на
     *  «Камера 1» / «Микрофон 1» по порядку. */
    label: string;

}

/**
 * Списки устройств по классам.
 */
export interface DeviceLists {

    /** Камеры. */
    videoinput: MediaDeviceItem[];

    /** Микрофоны. */
    audioinput: MediaDeviceItem[];

}

/**
 * ***************************************************************************
 * Классы устройств, которые умеет конференция. Динамики (`audiooutput`)
 * сознательно не трогаем: в вебе их переключение поддерживается не везде,
 * и ошибку «браузер не умеет» пользователю конференции показывать некуда.
 */
const KINDS: Array<"videoinput" | "audioinput"> = ["videoinput", "audioinput"];

/**
 * ***************************************************************************
 * enumerateDevices - Собирает список камер и микрофонов.
 *
 * Подписи и `deviceId` отдаёт браузер, и только если доступ к устройствам
 * уже разрешён. **Само по себе подключение к конференции разрешения не
 * даёт**: источники включаются кнопкой в футере, окна перед входом нет, а
 * значит к моменту открытия этого формы успешного `getUserMedia` могло
 * ещё не быть вовсе — и тогда браузер отдаёт устройства с пустым
 * `deviceId`, а выбрать устройство без id нельзя. Поэтому доступ
 * запрашивается отдельно и заранее, в `ensure_access.ts`; здесь мы
 * рассчитываем, что он уже есть.
 *
 * Оставшийся случай — подпись пустая, а id есть (пользователь разрешил
 * доступ одному устройству): тогда показываем «Камера N» / «Микрофон N»
 * по порядку.
 * @returns Списки камер и микрофонов по классам.
 * ***************************************************************************
 */
export async function enumerateDevices(): Promise<DeviceLists> {

    // Пустой ответ по умолчанию: дальше вызывающий рисует «устройства не найдены»
    const result: DeviceLists = { videoinput: [], audioinput: [] };

    try {

        // Старые браузеры и небезопасный контекст (http) метода не имеют
        if (typeof navigator === "undefined" || !navigator?.mediaDevices?.enumerateDevices) {
            Logger.warn("[meet-play][devices]: enumerateDevices недоступен");
            return result;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();

        if (!Array.isArray(devices)) return result;

        for (const kind of KINDS) {

            // Устройства без deviceId отбрасываем: браузер отдаёт их
            // ровно тогда, когда доступ к устройствам не разрешён, и
            // выбрать их всё равно нельзя — `switchActiveDevice` с
            // пустым id молча переключился бы на системное устройство
            // по умолчанию, а пользователь этого не просил
            const ofKind = devices.filter(device => device?.kind === kind && device?.deviceId);

            // Нумерация для устройств без подписи — по порядку в списке
            result[kind] = ofKind.map((device, index) => ({
                deviceId: device.deviceId || "",
                kind,
                label: device.label || getFallbackLabel(kind, index)
            }));

        }

        return result;

    } catch (error) {
        Logger.warn("[meet-play][devices]: Не удалось получить список устройств:", error);
        return result;
    }

}

/**
 * ***************************************************************************
 * getFallbackLabel - Подпись для устройства, имя которого браузер не отдал.
 * @param kind - Класс устройства.
 * @param index - Порядковый номер в списке (с нуля).
 * @returns Подпись для показа.
 * ***************************************************************************
 */
function getFallbackLabel(kind: "videoinput" | "audioinput", index: number): string {

    const locales = window._lc?.forms?.meet_play?.dialogs?.device_settings;

    const template = kind === "videoinput"
        ? locales?.device_fallback_camera
        : locales?.device_fallback_microphone;

    if (!template) return `${kind} ${index + 1}`;

    return `${template} ${index + 1}`;

}
