/**
 * ***************************************************************************
 * Bot App Client SDK
 * Библиотека (SDK) для работы Mini App внутри Host-платформы.
 * Обеспечивает двустороннее взаимодействие между веб-приложением и нативным клиентом.
 *
 * Публикуется сборкой как dist/bot-app-sdk.js — классический скрипт,
 * выставляющий глобальную переменную window.WebApp (см. низ файла).
 * ***************************************************************************
 */

/**
 * Параметры темы оформления, передаваемые Host-платформой
 * (конкретные цвета для UI-элементов).
 */
export type ThemeParams = Record<string, unknown>;

/**
 * Снимок темы, передаваемый подписчикам onThemeChange.
 */
export interface ThemeSnapshot {

    /** Цветовая схема ('light' | 'dark'). */
    colorScheme: string;

    /** Параметры цветов темы. */
    themeParams: ThemeParams;

}

/**
 * Распарсенные, но непроверенные данные инициализации.
 * Опасны для доверия на клиенте без проверки на бэкенде.
 */
export type InitDataUnsafe = Record<string, unknown> & {

    /** Данные пользователя (объект, либо строка, если JSON не распарсился). */
    user?: unknown;

};

/**
 * Подписчик изменения темы оформления.
 */
export type ThemeChangeCallback = (snapshot: ThemeSnapshot) => void;

/**
 * Подписчик события от Host-платформы.
 */
export type HostEventCallback = (data: unknown) => void;

/**
 * Тип доступа к устройству, который умеет запрашивать приложение.
 */
export type AppPermission = "camera" | "microphone" | "geolocation" | "clipboard-write";

/** Ключ sessionStorage с ожидающим выдачи разрешением (переживает перезагрузку документа). */
const PENDING_PERMISSION_KEY = "kodme_webapp_pending_permission";

/**
 * Сообщение из postMessage от Host-платформы (iframe parent).
 */
interface HostMessage {

    /** Тип события. */
    eventType: string;

    /** Данные события (нагрузка произвольная, типизируется на месте). */
    eventData?: unknown;

}

/**
 * Стиль тактильного отклика (Haptic/Taptic Engine).
 */
export type HapticImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

/**
 * Тип уведомления тактильного отклика (успех, предупреждение, ошибка).
 */
export type HapticNotificationType = "error" | "success" | "warning";

/**
 * Проверяет, что значение — непустая запись (объект).
 * Используется на границе postMessage: данные приходят извне.
 * @param value - Проверяемое значение.
 * @returns true, если значение — запись.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Проверяет, что значение — сообщение Host-платформы { eventType, eventData }.
 * @param value - Проверяемое значение.
 * @returns true, если значение — сообщение Host-платформы.
 */
function isHostMessage(value: unknown): value is HostMessage {
    return isRecord(value) && typeof value.eventType === "string";
}

/**
 * ***************************************************************************
 * WebAppSDK - главный класс SDK для взаимодействия веб-приложения с платформой.
 *
 * Конструктор инициализирует базовые параметры, парсит данные пользователя
 * и настраивает слушатели событий и подмодули.
 * ***************************************************************************
 */
export class WebAppSDK {

    /** Сырая строка с данными инициализации, переданная от платформы. Подтверждена криптографически на бэкенде. */
    initData: string = "";

    /** Распарсенные данные инициализации. Опасны для доверия на клиенте без проверки на бэкенде. */
    initDataUnsafe: InitDataUnsafe = {};

    /** Версия SDK. */
    readonly version: string = "2.0.0";

    /** Идентификатор платформы, на которой запущено приложение (например, 'web', 'ios', 'android'). */
    platform: string = "web";

    /** Текущая цветовая тема оформления ('light' или 'dark'). */
    colorScheme: string = "light";

    /** Объект с параметрами темы (конкретные цвета для UI-элементов). */
    themeParams: ThemeParams = {};

    /** Множество коллбеков, подписанных на изменение темы. */
    _themeCallbacks = new Set<ThemeChangeCallback>();

    /** Карта подписчиков на события от Host-платформы. Ключ — имя события, значение — массив коллбеков. */
    _listeners = new Map<string, HostEventCallback[]>();

    /** Модуль управления системной кнопкой "Назад". */
    BackButton: BackButtonModule;

    /** Модуль управления главной кнопкой приложения (Main Button). */
    MainButton: MainButtonModule;

    /** Модуль управления тактильным откликом (вибрацией устройства). */
    HapticFeedback: HapticFeedbackModule;

    /**
     * Конструктор: запускает внутреннюю инициализацию и создаёт подмодули.
     */
    constructor() {

        // Внутренняя инициализация
        this._parseInitData();
        this._setupHostEventListener();
        this._setupThemeBridge();
        this._setupPermissionBridge();

        // Подмодули SDK
        this.BackButton = new BackButtonModule(this);
        this.MainButton = new MainButtonModule(this);
        this.HapticFeedback = new HapticFeedbackModule(this);
    }

    /**
     * ***************************************************************************
     * @private
     * Извлекает параметры инициализации из URL hash и парсит их.
     * ***************************************************************************
     */
    _parseInitData(): void {
        try {
            // Извлекаем hash из URL (всё, что идет после #)
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);

            // Пытаемся получить WebAppData: get() уже декодирует внешнее
            // кодирование — строка остаётся валидной query-строкой initData
            const rawInitData = params.get("WebAppData") || "";
            this.initData = rawInitData;

            if (this.initData) {
                const initDataParams = new URLSearchParams(this.initData);
                const unsafe: InitDataUnsafe = {};

                // Перебираем параметры и формируем объект initDataUnsafe
                for (const [key, value] of initDataParams.entries()) {
                    if (key === "user") {
                        try {
                            unsafe.user = JSON.parse(value);
                        } catch {
                            unsafe.user = value;
                        }
                    } else {
                        unsafe[key] = value;
                    }
                }
                this.initDataUnsafe = unsafe;
            }
        } catch (e) {
            console.error("[WebAppSDK] Ошибка парсинга initData:", e);
        }
    }

    /**
     * ***************************************************************************
     * @private
     * Настраивает глобальный слушатель событий `message` от Host-платформы (iframe parent).
     * ***************************************************************************
     */
    _setupHostEventListener(): void {
        window.addEventListener("message", (event: MessageEvent<unknown>) => {
            let data: unknown = event.data;

            // Если данные пришли в виде строки, пытаемся распарсить JSON
            if (typeof data === "string") {
                try { data = JSON.parse(data); } catch { return; }
            }

            // Граница доверия: сообщения приходят извне (от родительского окна)
            if (!isHostMessage(data)) return;

            // Если есть подписчики на это событие, вызываем их
            this._listeners.get(data.eventType)?.forEach((callback) => callback(data.eventData));
        });
    }

    /**
     * ***************************************************************************
     * @private
     * Инициализирует логику получения и обновления темы оформления от платформы.
     * ***************************************************************************
     */
    _setupThemeBridge(): void {
        // Подписываемся на внутреннее событие изменения темы от хоста
        this.on("theme_changed", (data) => {
            // Граница доверия: нагрузка события приходит извне
            if (!isRecord(data)) return;

            // Поддержка camelCase и snake_case ключей на всякий случай
            const colorScheme = typeof data.colorScheme === "string" ? data.colorScheme
                : typeof data.color_scheme === "string" ? data.color_scheme
                    : "light";
            const themeParams = isRecord(data.themeParams) ? data.themeParams
                : isRecord(data.theme_params) ? data.theme_params
                    : {};
            this._applyTheme(colorScheme, themeParams);
        });

        // Запрашиваем текущую тему при старте приложения
        this.sendEvent("web_app_request_theme");
    }

    /**
     * ***************************************************************************
     * @private
     * Настраивает мост разрешений устройства: снимает флаг ожидающего запроса
     * по ответу платформы и повторяет запрос после перезагрузки документа.
     * ***************************************************************************
     */
    _setupPermissionBridge(): void {

        // Ответ платформы — снимаем флаг ожидающего запроса
        this.on("web_app_permission_result", () => {
            try {
                sessionStorage.removeItem(PENDING_PERMISSION_KEY);
            } catch {
                // Хранилище недоступно — флаг доживёт до следующего запроса
            }
        });

        // После перезагрузки документа (выдача разрешения) повторяем запрос:
        // подтверждение приходит уже в новый документ
        try {
            const pending = sessionStorage.getItem(PENDING_PERMISSION_KEY);
            if (pending) this.sendEvent("web_app_request_permission", { permission: pending });
        } catch {
            // Хранилище недоступно — без флага, приложение запросит доступ само
        }

    }

    /**
     * ***************************************************************************
     * @private
     * Применяет новую тему оформления и оповещает подписчиков.
     * @param colorScheme Цветовая схема ('light' | 'dark').
     * @param themeParams Параметры цветов.
     * ***************************************************************************
     */
    _applyTheme(colorScheme: string, themeParams: ThemeParams): void {
        this.colorScheme = colorScheme;
        this.themeParams = themeParams;

        // Вызываем все зарегистрированные коллбеки изменения темы
        this._themeCallbacks.forEach((cb) => cb({
            colorScheme: this.colorScheme,
            themeParams: this.themeParams
        }));
    }

    /**
     * ***************************************************************************
     * Отправляет событие в Host-платформу через механизм postMessage.
     * @param eventType Тип события.
     * @param eventData Данные для передачи.
     * ***************************************************************************
     */
    sendEvent(eventType: string, eventData: Record<string, unknown> = {}): void {
        // Убеждаемся, что мы находимся внутри iframe
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ eventType, eventData }, "*");
        }
    }

    /**
     * ***************************************************************************
     * Уведомляет платформу о том, что Mini App готов к отображению.
     * ***************************************************************************
     */
    ready(): void { this.sendEvent("web_app_ready"); }

    /**
     * ***************************************************************************
     * Закрывает Mini App.
     * ***************************************************************************
     */
    close(): void { this.sendEvent("web_app_close"); }

    /**
     * ***************************************************************************
     * Раскрывает окно Mini App на весь экран.
     * ***************************************************************************
     */
    expand(): void { this.sendEvent("web_app_expand"); }

    /**
     * ***************************************************************************
     * Показывает всплывающее уведомление (Toast) на стороне клиента.
     * @param message Текст уведомления.
     * ***************************************************************************
     */
    showToast(message: string): void {
        this.sendEvent("web_app_show_toast", { message });
    }

    /**
     * ***************************************************************************
     * Устанавливает заголовок окна приложения.
     * @param title Текст заголовка.
     * ***************************************************************************
     */
    setTitle(title: string): void {
        this.sendEvent("web_app_set_title", { title });
    }

    /**
     * Запрашивает разрешение платформы на доступ к устройству.
     *
     * Платформа показывает диалог подтверждения. При согласии документ iframe
     * перезагружается (Permissions Policy применяется при загрузке) — запрос
     * повторится автоматически, подписчик получит событие
     * `web_app_permission_result` с `{ permission, granted }`.
     * @param permission - Тип доступа.
     */
    requestPermission(permission: AppPermission): void {
        // Флаг в sessionStorage переживает перезагрузку документа —
        // SDK повторит запрос после выдачи разрешения
        try {
            sessionStorage.setItem(PENDING_PERMISSION_KEY, permission);
        } catch {
            // Хранилище недоступно (приватный режим) — работаем без флага
        }
        this.sendEvent("web_app_request_permission", { permission });
    }

    /**
     * ***************************************************************************
     * Отправляет данные обратно боту (работает только в определенных сценариях, например, при вызове из клавиатуры).
     * @param data Данные для отправки. Если передан объект, он будет сериализован в JSON.
     * ***************************************************************************
     */
    sendData(data: unknown): void {
        const stringData = typeof data === "object" ? JSON.stringify(data) : String(data);
        this.sendEvent("web_app_send_data", { data: stringData });
    }

    /**
     * ***************************************************************************
     * Открывает внешнюю ссылку средствами Host-платформы.
     * @param url URL-адрес для открытия.
     * ***************************************************************************
     */
    openLink(url: string): void {
        this.sendEvent("web_app_open_link", { url });
    }

    /**
     * ***************************************************************************
     * Подписывается на изменение темы оформления.
     * @param callback Функция, которая будет вызвана при смене темы.
     * @returns Функция для отписки от события.
     * ***************************************************************************
     */
    onThemeChange(callback: ThemeChangeCallback): () => void {
        if (typeof callback !== "function") return () => { };
        this._themeCallbacks.add(callback);

        // Вызываем сразу, чтобы передать текущее состояние
        callback({ colorScheme: this.colorScheme, themeParams: this.themeParams });

        // Возвращаем функцию отписки (unsubscribe)
        return () => this._themeCallbacks.delete(callback);
    }

    /**
     * ***************************************************************************
     * Подписывается на произвольное событие от Host-платформы.
     * @param eventType Название события.
     * @param callback Функция-обработчик.
     * ***************************************************************************
     */
    on(eventType: string, callback: HostEventCallback): void {
        const callbacks = this._listeners.get(eventType) ?? [];
        callbacks.push(callback);
        this._listeners.set(eventType, callbacks);
    }

    /**
     * ***************************************************************************
     * Отписывается от произвольного события от Host-платформы.
     * @param eventType Название события.
     * @param callback Функция-обработчик для удаления.
     * ***************************************************************************
     */
    off(eventType: string, callback: HostEventCallback): void {
        if (!this._listeners.has(eventType)) return;
        const callbacks = (this._listeners.get(eventType) ?? []).filter((cb) => cb !== callback);
        this._listeners.set(eventType, callbacks);
    }
}

/**
 * ***************************************************************************
 * BackButtonModule - модуль управления системной кнопкой "Назад" в заголовке Mini App.
 * ***************************************************************************
 */
export class BackButtonModule {

    /** Ссылка на главный экземпляр SDK. */
    sdk: WebAppSDK;

    /** Видимость кнопки "Назад". */
    isVisible: boolean = false;

    /** Обработчик клика по кнопке (устанавливается через onClick). */
    _onClickHandler: (() => void) | null = null;

    /**
     * @param sdk - Ссылка на главный экземпляр SDK.
     */
    constructor(sdk: WebAppSDK) {
        this.sdk = sdk;

        // Обработка нажатия кнопки "Назад" со стороны платформы
        this.sdk.on("back_button_pressed", () => {
            if (typeof this._onClickHandler === "function") this._onClickHandler();
        });
    }

    /** Показывает кнопку "Назад". */
    show(): void {
        this.isVisible = true;
        this.sdk.sendEvent("web_app_setup_back_button", { is_visible: true });
    }

    /** Скрывает кнопку "Назад". */
    hide(): void {
        this.isVisible = false;
        this.sdk.sendEvent("web_app_setup_back_button", { is_visible: false });
    }

    /**
     * Устанавливает обработчик клика по кнопке.
     * @param callback - Функция-обработчик.
     */
    onClick(callback: () => void): void {
        this._onClickHandler = callback;
    }
}

/**
 * ***************************************************************************
 * MainButtonModule - модуль управления Главной кнопкой (Main Button),
 * которая отображается внизу экрана.
 * ***************************************************************************
 */
export class MainButtonModule {

    /** Ссылка на главный экземпляр SDK. */
    sdk: WebAppSDK;

    /** Текст кнопки. */
    text: string = "CONTINUE";

    /** Цвет фона кнопки. */
    color: string = "#0088cc";

    /** Цвет текста кнопки. */
    textColor: string = "#ffffff";

    /** Видимость кнопки. */
    isVisible: boolean = false;

    /** Активность кнопки. */
    isActive: boolean = true;

    /** Обработчик клика по кнопке (устанавливается через onClick). */
    _onClickHandler: (() => void) | null = null;

    /**
     * @param sdk - Ссылка на главный экземпляр SDK.
     */
    constructor(sdk: WebAppSDK) {
        this.sdk = sdk;

        // Обработка нажатия Главной кнопки со стороны платформы
        this.sdk.on("main_button_pressed", () => {
            if (typeof this._onClickHandler === "function") this._onClickHandler();
        });
    }

    /**
     * Устанавливает текст Главной кнопки.
     * @param text - Текст кнопки.
     */
    setText(text: string): void {
        this.text = text;
        this._update();
    }

    /** Показывает Главную кнопку. */
    show(): void {
        this.isVisible = true;
        this._update();
    }

    /** Скрывает Главную кнопку. */
    hide(): void {
        this.isVisible = false;
        this._update();
    }

    /**
     * Устанавливает обработчик клика по кнопке.
     * @param callback - Функция-обработчик.
     */
    onClick(callback: () => void): void {
        this._onClickHandler = callback;
    }

    /**
     * @private
     * Отправляет актуальное состояние кнопки на Host-платформу.
     */
    _update(): void {
        this.sdk.sendEvent("web_app_setup_main_button", {
            is_visible: this.isVisible,
            is_active: this.isActive,
            text: this.text,
            color: this.color,
            text_color: this.textColor
        });
    }
}

/**
 * ***************************************************************************
 * HapticFeedbackModule - модуль управления тактильным откликом
 * (вибрация Haptic/Taptic Engine).
 * ***************************************************************************
 */
export class HapticFeedbackModule {

    /** Ссылка на главный экземпляр SDK. */
    sdk: WebAppSDK;

    /**
     * @param sdk - Ссылка на главный экземпляр SDK.
     */
    constructor(sdk: WebAppSDK) {
        this.sdk = sdk;
    }

    /**
     * Вызывает тактильный отклик, информирующий о физическом столкновении/воздействии.
     * @param style - Стиль отклика.
     */
    impactOccurred(style: HapticImpactStyle = "light"): void {
        this.sdk.sendEvent("web_app_haptic_feedback", { type: "impact", style });
    }

    /**
     * Вызывает тактильный отклик, информирующий о результате действия (успех, предупреждение, ошибка).
     * @param type - Тип уведомления.
     */
    notificationOccurred(type: HapticNotificationType = "success"): void {
        this.sdk.sendEvent("web_app_haptic_feedback", { type: "notification", notification_type: type });
    }

    /**
     * Вызывает легкий тактильный отклик при изменении текущего выбора
     * (например, прокрутка барабана, смена свитча).
     */
    selectionChanged(): void {
        this.sdk.sendEvent("web_app_haptic_feedback", { type: "selection" });
    }
}

declare global {

    /** Глобальная точка доступа Mini App SDK для классических скриптов (window.WebApp). */
    var WebApp: WebAppSDK;

}

// Возвращаем глобальный экземпляр класса (контракт UMD-предка:
// <script src="bot-app-sdk.js"> выставляет window.WebApp)
globalThis.WebApp = new WebAppSDK();
