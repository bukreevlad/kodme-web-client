// Импортируем сторонние пакеты
import Bowser from "bowser";

/**
 * Иконки устройств (Tabler) по типу платформы из user-agent.
 */
const DEVICE_TYPE_ICONS: Record<string, string> = {
    mobile: "device-mobile",
    tablet: "device-tablet",
    desktop: "device-desktop",
    smarttv: "device-tv",
    console: "device-gamepad",
    wearable: "device-watch",
    embedded: "device-unknown"
};

/**
 * Иконки устройств (Tabler) по платформе клиента (web/android/ios/electron) —
 * фолбэк для сессий без user-agent (созданы до его сохранения в БД).
 */
const PLATFORM_ICONS: Record<string, string> = {
    android: "device-mobile",
    ios: "device-mobile",
    electron: "device-desktop",
    web: "app-window"
};

/**
 * ***************************************************************************
 * getDeviceIcon - иконка устройства (Tabler) для сессии.
 *
 * Тип устройства определяем по user-agent (телефон, планшет, ПК, ТВ...),
 * для сессий без user-agent — по платформе клиента из ответа сервера.
 * Если определить не удалось — общая иконка неизвестного устройства.
 *
 * @param {string} userAgent - User-agent устройства.
 * @param {string|null} [platform] - Платформа клиента (web/android/ios/electron).
 * @returns {string} - Имя иконки Tabler (kebab-case).
 * ***************************************************************************
 */
export function getDeviceIcon(userAgent: string, platform?: string | null): string {

    // Тип устройства из user-agent (пустой UA парсер отклоняет)
    if (userAgent) {
        try {
            const type = Bowser.parse(userAgent).platform.type;
            const icon = type ? DEVICE_TYPE_ICONS[type] : undefined;
            if (icon) return icon;
        } catch {
            // Битый user-agent — идём к фолбэку по платформе
        }
    }

    // Фолбэк по платформе клиента
    const platformIcon = platform ? PLATFORM_ICONS[platform.toLowerCase()] : undefined;
    return platformIcon ?? "device-unknown";

}
