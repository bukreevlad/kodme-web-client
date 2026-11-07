// Импортируем utils
import { Logger } from "./logs/logger.js";
import { PlatformBridge } from "./platform.bridge.js";

// Импортируем router
import { renderRoutes } from "../router/routes.js";

// Импортируем типы
import type { NotifySettingsData } from "../forms/user-setting-notifications/requests/get_notify_settings.js";

/**
 * Данные нативного уведомления десктоп-обёртки.
 */
export interface ElectronNotificationInput {

    /** Заголовок уведомления. */
    title: string;

    /** Текст уведомления. */
    body?: string;

    /** URL иконки (аватар/иконка приложения). */
    icon?: string;

    /** Тег уведомления (группировка). */
    tag?: string;

    /** Deep-link уведомления (query-параметры формы). */
    url?: string;

}

/** Тип уведомления: соответствует серверной настройке notify_<type>. */
export type ElectronNotificationType = "messages" | "calls";

// Ключи LocalStorage: мастер-переключатель и кеш серверных настроек
const ENABLED_KEY = "electron_notify_enabled";
const SETTINGS_KEY = "electron_notify_settings";

/**
 * ***************************************************************************
 * ElectronNotifications - нативные уведомления десктоп-обёртки Electron.
 *
 * В Electron нет push-сервиса (Web Push не работает), поэтому уведомления
 * показывает сам клиент: WS-события при открытом приложении → IPC моста →
 * нативное уведомление системы. Показываются только при неактивном окне
 * (активный пользователь видит событие и так) и с учётом настроек:
 * мастер-переключатель — LocalStorage (кнопки «Включить/Отключить» формы
 * настроек в Electron), тумблеры типов — кеш серверных настроек этой формы.
 * ***************************************************************************
 */
export class ElectronNotifications {

    /**
     * ***************************************************************************
     * Уведомления включены мастер-переключателем (по умолчанию — включены).
     * @returns {boolean} - true, если показ уведомлений разрешён.
     * ***************************************************************************
     */
    static isEnabled(): boolean {
        return window.localStorage.getItem(ENABLED_KEY) !== "false";
    }

    /**
     * ***************************************************************************
     * Записывает мастер-переключатель уведомлений.
     * @param {boolean} enabled - Включены ли уведомления.
     * ***************************************************************************
     */
    static setEnabled(enabled: boolean): void {
        window.localStorage.setItem(ENABLED_KEY, String(enabled));
    }

    /**
     * ***************************************************************************
     * Кеширует серверные настройки уведомлений: тумблеры формы применяются
     * к показу в Electron без запроса на каждое уведомление.
     * @param {NotifySettingsData} [settings] - Настройки из формы (могут отсутствовать).
     * ***************************************************************************
     */
    static cacheSettings(settings: NotifySettingsData | undefined): void {
        if (!settings) return;
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    /**
     * ***************************************************************************
     * Разрешён ли показ уведомлений данного типа по кешу настроек.
     * @param {ElectronNotificationType} type - Тип уведомления.
     * @returns {boolean} - true, если тип включён (по умолчанию — включён).
     * ***************************************************************************
     */
    static isTypeEnabled(type: ElectronNotificationType): boolean {

        // Некорректный кеш не должен ронять показ — считаем включённым
        try {
            const cached: unknown = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}");
            if (cached && typeof cached === "object") {
                const flag = (cached as Record<string, unknown>)[`notify_${type}`];
                if (typeof flag === "boolean") return flag;
            }
        } catch (error) {
            Logger.debug("[app][electron-notifications]: Некорректный кеш настроек", error);
        }

        return true;
    }

    /**
     * ***************************************************************************
     * Показывает нативное уведомление десктоп-обёртки.
     * @param {ElectronNotificationInput} input - Данные уведомления.
     * @param {ElectronNotificationType} type - Тип уведомления (фильтр настроек).
     * @returns {boolean} - true, если уведомление показано.
     * ***************************************************************************
     */
    static show(input: ElectronNotificationInput, type: ElectronNotificationType): boolean {

        // Вне Electron уведомления идут через Service Worker (push)
        if (!PlatformBridge.isElectron()) return false;

        // Уведомления выключены мастер-переключателем или тумблером типа
        if (!this.isEnabled() || !this.isTypeEnabled(type)) return false;

        // Активное окно: пользователь видит событие и так
        if (document.hasFocus()) return false;

        // Отправляем payload в main-процесс через IPC-мост
        // (условные спреды: exactOptionalPropertyTypes не терпит явный undefined)
        return PlatformBridge.showNotification({
            title: input.title,
            ...(input.body !== undefined && { body: input.body }),
            ...(input.icon !== undefined && { icon: input.icon }),
            ...(input.tag !== undefined && { tag: input.tag }),
            data: { url: input.url }
        });
    }

    /**
     * ***************************************************************************
     * Подписка на клики по нативным уведомлениям: main-процесс фокусирует
     * окно, а здесь форма открывается по deep-link уведомления.
     * Вне Electron — no-op.
     * ***************************************************************************
     */
    static initClickHandler(): void {

        // Вне десктоп-обёртки событий кликов не бывает
        if (!PlatformBridge.isElectron()) return;

        window.addEventListener("DesktopNotificationClick", (event) => {

            try {

                // Данные уведомления (deep-link формы)
                const data = event.detail as { url?: string } | null;
                const url = data?.url;
                if (!url) return;

                // Разбираем query-параметры ссылки
                const params = Object.fromEntries(
                    new URL(url, window.location.origin).searchParams.entries()
                );

                Logger.debug("[app][electron-notifications]: Клик по уведомлению, параметры", params);

                // Открываем форму по параметрам уведомления
                renderRoutes(params);

            } catch (error) {
                Logger.error("[app][electron-notifications]: Ошибка обработки клика:", error);
            }

        });
    }

}
