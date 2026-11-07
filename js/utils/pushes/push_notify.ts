/**
 * Данные системного уведомления (Web Notifications).
 */
export interface PushNotifyPayload {
    /** Заголовок уведомления. */
    title: string;
    /** Текст уведомления. */
    text?: string;
    /** URL изображения уведомления. */
    imgUrl?: string;
    /** Тег группировки уведомления. */
    tag?: string;
}

/**
 * Опции системного уведомления: стандартные поля NotificationOptions плюс
 * `image` (URL картинки уведомления) — поле поддерживается браузерами,
 * но не входит в типы TS DOM.
 */
interface PushNotificationOptions extends NotificationOptions {
    /** URL изображения уведомления (пустая строка — без картинки). */
    image?: string;
}

/**
 * Собирает опции системного уведомления из полезной нагрузки.
 * @param {PushNotifyPayload} payload - Данные уведомления.
 * @returns {PushNotificationOptions} - Опции для конструктора Notification.
 */
function buildNotificationOptions(payload: PushNotifyPayload): PushNotificationOptions {
    return {
        ...(payload.tag !== undefined && { tag: payload.tag }),
        ...(payload.text !== undefined && { body: payload.text }),
        image: payload.imgUrl ? payload.imgUrl : ""
    };
}

/**
 * ***************************************************************************
 * Показать системное уведомление браузера.
 *
 * Если разрешение ещё не запрошено — запрашивает его и показывает
 * уведомление после получения `granted`.
 * @param {PushNotifyPayload} payload - Данные уведомления.
 * @returns {Notification | undefined} - Показанное уведомление (undefined —
 *   уведомление не показано: поддержки нет, нет разрешения или отказ).
 * ***************************************************************************
 */
export function pushNotify(payload: PushNotifyPayload): Notification | undefined {

    // Проверяем поддержку уведомлений
    if ("Notification" in window) {

        // Запрашиваем разрешение, если ещё не запрошено
        if (Notification.permission === "granted") {

            // Показываем уведомление
            const notification = new Notification(payload.title, buildNotificationOptions(payload));
            return notification;

        } else if (Notification.permission !== "denied") {

            Notification.requestPermission().then(permission => {
                if (permission === "granted") {

                    // Показываем уведомление
                    new Notification(payload.title, buildNotificationOptions(payload));

                }
            });

        }

    }

}
