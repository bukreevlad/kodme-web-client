// Импортируем utils
import { Logger } from "./logs/logger.js";

/**
 * Колбэки промиса запроса push-токена.
 */
interface PushTokenRequest {
    /** Успех: разрешает промис ответом нативного слоя. */
    resolve: (value: PushTokenResult | null) => void;
    /** Отказ: отклоняет промис ошибкой. */
    reject: (reason?: unknown) => void;
}

/**
 * Ответ нативного слоя на запрос push-токена.
 */
export interface PushTokenResult {
    /** Push-токен (FCM/HMS). */
    token?: string;
    /** Провайдер push-уведомлений (fcm | hms). */
    provider?: string;
    [key: string]: unknown;
}

/**
 * Опции инициализации моста.
 */
interface BridgeInitOptions {
    /** Тёмная ли тема сейчас (стиль статус-бара Android). */
    isDarkTheme?: boolean;
}

/**
 * Отступы safe area, которые сообщила нативная обёртка.
 */
interface SafeAreaInsets {
    /** Верхний отступ (px). */
    top: number;
    /** Нижний отступ (px). */
    bottom: number;
    /** Левый отступ (px). */
    left: number;
    /** Правый отступ (px). */
    right: number;
}

/**
 * Устройство ввода с безопасной подписью (пустую подпись заменяем
 * нейтральной — браузер отдаёт label только после выдачи разрешения).
 */
export interface MediaDeviceItem {
    /** Идентификатор устройства. */
    deviceId: string;
    /** Категория устройства. */
    kind: MediaDeviceKind;
    /** Подпись устройства. */
    label: string;
    /** Ориентация камеры (только у videoinput). */
    facing?: "user" | "environment";
}

/**
 * Данные нативного уведомления десктоп-обёртки (IPC главного процессу).
 */
export interface ElectronNotificationPayload {
    /** Заголовок уведомления. */
    title: string;
    /** Текст уведомления. */
    body?: string;
    /** URL иконки (аватар/иконка приложения). */
    icon?: string;
    /** Тег уведомления (группировка). */
    tag?: string;
    /** Данные уведомления (возвращаются кликом). */
    data?: Record<string, unknown>;
}

/**
 * Мост десктоп-обёртки Electron — exposeInMainWorld из preload.js
 * (window.kodmeDesktop).
 */
export interface KodmeDesktopBridge {
    /** Показывает нативное уведомление; true — уведомление показано. */
    showNotification: (payload: ElectronNotificationPayload) => boolean | Promise<boolean>;
    /** Подписка на клик по нативному уведомлению. */
    onNotificationClick: (callback: (data: Record<string, unknown>) => void) => void;
}

/**
 * ***************************************************************************
 * PlatformBridge - мост с нативными обёртками (Android GeckoView / iOS).
 * Передаёт safe-area, стиль статус-бара, вибрацию, push-токены и события
 * скачивания; очередь messageQueue копит сообщения до готовности моста.
 * ***************************************************************************
 */
export class PlatformBridge {

    // Устанавливаем базовые параметры
    static platform = "web";
    static isAndroidDevice = false;
    static isIOSDevice = false;
    static isElectronDevice = false;
    static isMobile = false;
    static isInitialized = false;
    static bridgeReady = false;

    // Хранилище запросов push токенов
    static _pushRequests = new Map<string, PushTokenRequest>();

    // Очередь для сообщений, отправленных до готовности моста
    static messageQueue: Array<Record<string, unknown>> = [];

    /**
     * ***************************************************************************
     * init.
     * @param {BridgeInitOptions} [options] - Опции инициализации.
     * ***************************************************************************
     */
    static init(options: BridgeInitOptions = { isDarkTheme: false }): void {
        if (this.isInitialized) return;

        const ua = navigator.userAgent;
        this.isAndroidDevice = /Android/i.test(ua) && /Gecko/i.test(ua);
        this.isIOSDevice = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosBridge);
        // Десктоп-обёртка: preload подкладывает странице window.kodmeDesktop
        this.isElectronDevice = !!window.kodmeDesktop;
        this.isMobile = this.isAndroidDevice || this.isIOSDevice;

        if (this.isAndroidDevice) {
            this.platform = 'android';

            window.addEventListener('message', (event) => {
                if (event.source !== window) return;
                const data = event.data;
                if (!data || data.direction !== 'from-app-to-page') return;

                const payload = data.payload;

                if (payload?.type === 'BRIDGE_READY') {
                    this.bridgeReady = true;
                    Logger.info('[PlatformBridge] Android bridge ready');

                    // 1. Запрашиваем SAFE_AREA у Android
                    this.sendToAndroid({ type: 'INIT' });

                    // 2. Отправляем текущую тему из настроек
                    // (у опции есть флаг `?`, дефолт — светлая тема, как в init())
                    this.setStatusBarStyle(options.isDarkTheme ?? false);

                    // 3. Выталкиваем в Android всё, что накопилось в очереди
                    while (this.messageQueue.length > 0) {
                        const queuedPayload = this.messageQueue.shift();
                        // По типу shift() может вернуть undefined; цикл выше
                        // гарантирует наличие элемента — это защита от типов
                        if (queuedPayload) {
                            this.sendToAndroid(queuedPayload);
                        }
                    }
                    return;
                }

                if (payload?.type === 'SAFE_AREA') {
                    this.updateSafeArea({
                        top: payload.top || 0,
                        bottom: payload.bottom || 0,
                        left: payload.left || 0,
                        right: payload.right || 0
                    });
                    return;
                }

                if (payload?.type === 'DOWNLOAD_EVENT') {
                    // FileDownloader listens for this DOM event. Keep all native
                    // fields intact: id, status, loaded, total, percent, message.
                    window.dispatchEvent(new CustomEvent('AndroidDownloadEvent', {
                        detail: payload
                    }));
                    return;
                }

                if (payload?.type === 'PUSH_TOKEN_RESULT') {
                    const reqId = payload.reqId;
                    const request = reqId ? this._pushRequests.get(reqId) : undefined;
                    if (request) {
                        const { resolve, reject } = request;
                        if (payload.token) {
                            resolve(payload);
                        } else {
                            reject(new Error(payload.error || 'Failed to fetch push token'));
                        }
                        this._pushRequests.delete(reqId);
                    }
                    return;
                }

                // A generic channel makes future native events usable without
                // adding another message listener to every site module.
                window.dispatchEvent(new CustomEvent('PlatformBridgeEvent', {
                    detail: payload
                }));
            });

        } else if (this.isElectronDevice) {
            this.platform = "electron";

            // Клик по нативному уведомлению десктоп-обёртки пробрасываем
            // событием страницы (обработчик — ElectronNotifications)
            window.kodmeDesktop?.onNotificationClick((data) => {
                window.dispatchEvent(new CustomEvent("DesktopNotificationClick", { detail: data }));
            });

        } else if (this.isIOSDevice) {
            this.platform = "ios";
        } else {
            this.platform = "web";
        }

        this.isInitialized = true;
        Logger.info(`[PlatformBridge] Инициализирован. Платформа: "${this.platform}"`);

        // НОВОЕ: Стучимся в content.js, сообщая, что слушатель успешно установлен!
        if (this.isAndroidDevice) {
            window.postMessage({
                direction: 'from-page-to-app',
                payload: { type: 'PAGE_READY' }
            }, '*');
        }
    }

    /**
     * ***************************************************************************
     * updateSafeArea.
     * @param {SafeAreaInsets} [insets] - Отступы safe area в пикселях.
     * ***************************************************************************
     */
    static updateSafeArea(insets: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 }): void {
        const root = document.documentElement;
        root.style.setProperty('--safeareatop', `${insets.top}px`);
        root.style.setProperty('--safeareabottom', `${insets.bottom}px`);
        root.style.setProperty('--safearealeft', `${insets.left}px`);
        root.style.setProperty('--safearearight', `${insets.right}px`);
        Logger.debug(`[PlatformBridge] Safe Area: Top: ${insets.top}px, Bottom: ${insets.bottom}px`);
    }

    /**
     * ***************************************************************************
     * sendToAndroid.
     * @param {Record<string, unknown>} payload - Полезная нагрузка сообщения.
     * ***************************************************************************
     */
    static sendToAndroid(payload: Record<string, unknown>): void {
        if (!this.isAndroidDevice) return;

        // Если мост еще не готов, сохраняем в очередь
        if (!this.bridgeReady) {
            Logger.debug('[PlatformBridge] Queuing message:', payload);
            this.messageQueue.push(payload);
            return;
        }

        window.postMessage({
            direction: 'from-page-to-app',
            payload
        }, '*');
    }

    /**
     * ***************************************************************************
     * Геттеры.
     * ***************************************************************************
     */
    static getPlatform(): string { return this.platform; }
    static isAndroid(): boolean { return this.isAndroidDevice; }
    static isIOS(): boolean { return this.isIOSDevice; }
    static isElectron(): boolean { return this.isElectronDevice; }
    static isMobileApp(): boolean { return this.isMobile; }

    /**
     * ***************************************************************************
     * setStatusBarStyle.
     * @param {boolean} isDarkTheme - Тёмная ли тема.
     * ***************************************************************************
     */
    static setStatusBarStyle(isDarkTheme: boolean): void {
        if (!this.isInitialized) {
            Logger.warn('[PlatformBridge] Вызов setStatusBarStyle до init().');
        }

        if (this.isAndroidDevice) {
            this.sendToAndroid({ type: "CHANGE_THEME", isDark: isDarkTheme });
        } else if (this.isIOSDevice) {
            // `?.` — мост недоступен вне нативной обёртки (например, в обычном Safari)
            window.webkit?.messageHandlers?.iosBridge?.postMessage({
                action: 'setStatusBarStyle',
                isDarkTheme: isDarkTheme
            });
        }
    }

    /**
     * ***************************************************************************
     * vibrate.
     * @param {number} [milliseconds] - Длительность вибрации.
     * ***************************************************************************
     */
    static vibrate(milliseconds: number = 100): void {
        if (this.isAndroidDevice) {
            this.sendToAndroid({ type: "VIBRATE", duration: milliseconds });
        }
    }

    /**
     * ***************************************************************************
     * showNotification - показ нативного уведомления десктоп-обёртки (Electron).
     *
     * В браузере уведомления идут через Service Worker (push); в Electron
     * push-сервиса нет — показываем сами через IPC главного процесса.
     * @param {ElectronNotificationPayload} payload - Данные уведомления.
     * @returns {boolean} - true, если уведомление показано.
     * ***************************************************************************
     */
    static showNotification(payload: ElectronNotificationPayload): boolean {

        // Вне десктоп-обёртки моста не существует
        if (!this.isElectronDevice || !window.kodmeDesktop) return false;

        // IPC асинхронен — результат странице не нужен
        void window.kodmeDesktop.showNotification(payload);
        return true;
    }

    /**
     * ***************************************************************************
     * Возвращает Push-токен (HMS или FCM) в ответе нативного слоя.
     * @returns {Promise<PushTokenResult | null>} - Ответ нативного слоя
     *   либо null, если мы не внутри Android-обёртки.
     * ***************************************************************************
     */
    static async getPushToken(): Promise<PushTokenResult | null> {
        if (!this.isAndroidDevice) {
            return null;
        }

        return new Promise<PushTokenResult | null>((resolve, reject) => {
            // Генерируем уникальный ID запроса
            const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

            // Запоминаем коллбеки промиса
            this._pushRequests.set(reqId, { resolve, reject });

            // Отправляем команду в Kotlin
            this.sendToAndroid({
                type: 'GET_PUSH_TOKEN',
                reqId: reqId
            });

            // Таймер безопасности (15 секунд), чтобы await не завис навсегда,
            // если сервисы Google/Huawei лежат или устройство без сети.
            setTimeout(() => {
                if (this._pushRequests.has(reqId)) {
                    this._pushRequests.get(reqId)?.reject(new Error('Timeout getting push token (15s)'));
                    this._pushRequests.delete(reqId);
                }
            }, 15000);
        });
    }

    /**
     * ***************************************************************************
     * getMediaDevices
     * @param {"all" | "video" | "audio"} [type] - Фильтр по категории устройств.
     * @returns {Promise<MediaDeviceItem[]>} - Устройства ввода.
     * ***************************************************************************
     */
    static async getMediaDevices(type: "all" | "video" | "audio" = "all"): Promise<MediaDeviceItem[]> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const mappedDevices = devices.map((device, index) => {
                const isVideo = device.kind === 'videoinput';
                const item: MediaDeviceItem = {
                    deviceId: device.deviceId,
                    kind: device.kind,
                    label: device.label || `${isVideo ? 'Camera' : 'Microphone'} ${index}`
                };

                if (isVideo) {
                    // Используем безопасный парсинг названия для камеры
                    item.facing = item.label.toLowerCase().includes('front') ? 'user' : 'environment';
                }
                return item;
            });

            if (type === "video") return mappedDevices.filter(d => d.kind === 'videoinput');
            if (type === "audio") return mappedDevices.filter(d => d.kind === 'audioinput');

            return mappedDevices;
        } catch (error) {
            Logger.error('[PlatformBridge] Ошибка получения устройств:', error);
            return [];
        }
    }

}
