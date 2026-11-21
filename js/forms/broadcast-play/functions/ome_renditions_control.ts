// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем utils
import { OmeRenditions } from "../../../utils/video/ome_renditions.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";
import type { StreamRendition } from "../types.js";

/**
 * ***************************************************************************
 * Отправляет серверу команду смены варианта качества WebRTC-воспроизведения.
 *
 * Команда уходит в WebSocket-сигналинг OvenMediaEngine
 * (см. functions/start_rtc_player.ts).
 * @param form - Экземпляр формы.
 * @param name - Имя рендеринга в OME (source, 720p, 480p).
 * @returns void
 * ***************************************************************************
 */
function sendChangeRendition(form: BroadcastPlay, name: string): void {

    const socket = form.rtcSocket;
    const id = form.rtcSessionId;

    // Сессии ещё нет либо сокет уже закрыт — переключать нечего
    if (!socket || socket.readyState !== WebSocket.OPEN || id === null) {
        Logger.warn(`[broadcast-play][renditions] сессия RTC не готова, смена «${name}» проигнорирована`);
        return;
    }

    try {
        socket.send(JSON.stringify({ command: "change_rendition", id, rendition_name: name }));
        Logger.debug(`[broadcast-play][renditions] запрошено качество: ${name}`);
    } catch (error) {
        Logger.warn("[broadcast-play][renditions] не удалось отправить change_rendition:", error);
    }

}

/**
 * ***************************************************************************
 * Подключает (или обновляет) адаптер вариантов качества к видеоплееру.
 *
 * Из ответа "[broadcast]: get stream info" приходит список рендерингов
 * плейлиста `rtc` OvenMediaEngine — из них Video.js строит меню «Качество».
 * Выбор пункта уходит на сервер командой change_rendition.
 *
 * @param form - Экземпляр формы.
 * @param renditions - Варианты качества из ответа сервера.
 * @returns void
 * ***************************************************************************
 */
export function syncOmeRenditions(form: BroadcastPlay, renditions: StreamRendition[]): void {

    // Без плеера строить не из чего; пустой список допустим — адаптер
    // подключается сразу, список обновится позже (иначе мимо loadstart)
    if (!form.player) return;

    // Адаптер уже подключён — просто обновляем список
    // (сервер мог прислать другие варианты, например после переподключения)
    if (form.omeRenditions) {
        form.omeRenditions.update(renditions);
        return;
    }

    const adapter = new OmeRenditions({
        renditions,
        onSelect: (name) => sendChangeRendition(form, name)
    });

    form.omeRenditions = adapter;
    form.player.attachRenditions(adapter);

    Logger.debug(`[broadcast-play][renditions] подключено вариантов качества: ${renditions.length}`);

}

/**
 * ***************************************************************************
 * Отключает адаптер вариантов качества (остановка WebRTC-воспроизведения).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function detachOmeRenditions(form: BroadcastPlay): void {

    if (!form.omeRenditions) return;

    try {
        form.omeRenditions.destroy();
    } catch (error) {
        Logger.warn("[broadcast-play][renditions] ошибка уничтожения адаптера:", error);
    }

    form.omeRenditions = null;
    form.player?.detachRenditions();

}
