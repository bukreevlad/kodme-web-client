// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { Buttons } from "../../../components/buttons.js";

// Импортируем functions
import { MessageUrlClickConfirm } from "../../messages/components/dialogs/message-url-click-confirm/index.js";
import { PermissionDialog } from "../dialogs/permission/index.js";
import { getGrantedPermissions, grantPermission, isAppPermission } from "./permissions.js";

// Импортируем handlers
import { maximizeHandler } from "../handlers/maximize.js";

// Импортируем requests
import { sendDataRequest } from "../requests/send_data.js";

// Импортируем типы
import type { AppPermission } from "../../../bot-app-sdk.js";
import type { BotApp } from "../index.js";

/** Максимальная длина данных приложения (web_app_send_data). */
const MAX_SEND_DATA_LENGTH = 8000;

/** Максимальная длина текста из команд приложения (обрезается при показе). */
const MAX_TEXT_LENGTH = 2000;

/** Максимальная длина заголовка/подзаголовка шапки. */
const MAX_HEADER_LENGTH = 200;

/** Окно троттлинга команд хоста (мс). */
const RATE_WINDOW_MS = 1000;

/** Максимум тостов в окне троттлинга. */
const MAX_TOASTS_PER_WINDOW = 2;

/** Максимум вибраций в окне троттлинга. */
const MAX_HAPTICS_PER_WINDOW = 5;

/** Пауза после закрытия диалога разрешения (мс) — защита от зацикливания модалки. */
const PERMISSION_COOLDOWN_MS = 5000;

/** Известные поля нагрузки команд Mini App: имя → ожидаемый тип. */
const EVENT_DATA_FIELDS: Record<string, "string" | "boolean"> = {
    message: "string",
    title: "string",
    subtitle: "string",
    type: "string",
    style: "string",
    data: "string",
    url: "string",
    permission: "string",
    text: "string",
    is_visible: "boolean",
    is_active: "boolean"
};

/**
 * Полезные данные команды Mini App (новый стандарт postMessage API).
 */
interface WebAppEventData {

    /** Текст тоста (web_app_show_toast). */
    message?: string;

    /** Новый заголовок шапки (web_app_set_title). */
    title?: string;

    /** Новый подзаголовок шапки (web_app_set_subtitle). */
    subtitle?: string;

    /** Тип вибрации (web_app_haptic_feedback). */
    type?: string;

    /** Стиль вибрации (web_app_haptic_feedback). */
    style?: string;

    /** Данные приложения для бота (web_app_send_data). */
    data?: string;

    /** Внешняя ссылка (web_app_open_link). */
    url?: string;

    /** Тип запрашиваемого доступа (web_app_request_permission). */
    permission?: string;

    /** Текст главной кнопки (web_app_setup_main_button). */
    text?: string;

    /** Видимость кнопки (web_app_setup_main_button / web_app_setup_back_button). */
    is_visible?: boolean;

    /** Активность главной кнопки (web_app_setup_main_button). */
    is_active?: boolean;

}

/**
 * Проверяет, что значение — запись (объект).
 * Используется на границе postMessage: данные приходят извне.
 * @param value - Проверяемое значение.
 * @returns true, если значение — запись.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Проверяет, что нагрузка события — только известные поля с ожидаемыми типами.
 * @param value - Проверяемая нагрузка.
 * @returns true, если нагрузка отсутствует либо известные поля совпали по типу.
 */
function isWebAppEventData(value: unknown): value is WebAppEventData {
    if (value === undefined) return true;
    if (!isRecord(value)) return false;

    // Известное поле обязано совпадать с ожидаемым типом; неизвестные
    // поля приложения игнорируются
    return Object.entries(EVENT_DATA_FIELDS).every(([key, kind]) => {
        const field: unknown = value[key];
        if (field === undefined) return true;
        return kind === "string" ? typeof field === "string" : typeof field === "boolean";
    });
}

/**
 * Проверяет, что значение — событие Mini App { eventType, eventData }.
 * @param value - Проверяемое значение.
 * @returns true, если значение — событие Mini App.
 */
function isWebAppEvent(value: unknown): value is { eventType: string; eventData?: WebAppEventData } {
    return isRecord(value)
        && typeof value.eventType === "string"
        && isWebAppEventData(value.eventData);
}

/**
 * ***************************************************************************
 * BRIDGE - мост postMessage между формой WebApp-приложения и её iframe.
 *
 * Слушает сообщения от Mini App внутри iframe и исполняет команды:
 * закрыть приложение, развернуть, показать тост, сменить заголовок,
 * запросить тему, вибрация, отправить данные боту, открыть ссылку,
 * запросить разрешение на доступ к устройству, главная кнопка и
 * кнопка «Назад».
 * ***************************************************************************
 */
export class Bridge {

    /** Экземпляр формы WebApp-приложения. */
    private readonly form: BotApp;

    /** Стабильная ссылка на обработчик для addEventListener/removeEventListener. */
    private readonly _messageHandler: (event: MessageEvent) => void;

    /** Начало текущего окна троттлинга команд хоста (мс). */
    private _rateWindowStart = 0;

    /** Сколько тостов показано в текущем окне троттлинга. */
    private _toastCount = 0;

    /** Сколько вибраций выполнено в текущем окне троттлинга. */
    private _hapticCount = 0;

    /** Открытый диалог подтверждения доступа к устройству. */
    private _permissionDialog: PermissionDialog | null = null;

    /** До какого момента (мс) игнорировать запросы разрешений после диалога. */
    private _permissionCooldownUntil = 0;

    /** Обёртка главной кнопки в футере формы (создаётся по первой команде). */
    private _mainButtonWrap: HTMLDivElement | null = null;

    /** Главная кнопка приложения в футере формы. */
    private _mainButton: HTMLButtonElement | null = null;

    /**
     * ***************************************************************************
     * @param form - Экземпляр класса BotApp.
     * ***************************************************************************
     */
    constructor(form: BotApp) {

        // Сохраняем форму
        this.form = form;

        // Сохраняем стабильную ссылку на обработчик для addEventListener/removeEventListener
        this._messageHandler = (event) => this.handleMessage(event);

    }

    /**
     * ***************************************************************************
     * Инициализация и запуск слушателя событий.
     * ***************************************************************************
     */
    init(): void {
        window.addEventListener("message", this._messageHandler);
    }

    /**
     * ***************************************************************************
     * Уничтожение слушателя событий при закрытии формы.
     * ***************************************************************************
     */
    destroy(): void {
        if (this._messageHandler) {
            window.removeEventListener("message", this._messageHandler);
        }

        // Диалог разрешения закрываем вместе с формой
        this._permissionDialog?.modal?.close();
        this._permissionDialog = null;
    }

    /**
     * ***************************************************************************
     * Проверяет и списывает квоту команды хоста в окне троттлинга.
     * Защищает интерфейс от спама: приложение может слать команды сколько угодно.
     * @param kind - Вид команды: "toast" или "haptic".
     * @returns true, если команду можно выполнить.
     * ***************************************************************************
     */
    private _allowCommand(kind: "toast" | "haptic"): boolean {

        // Начало нового окна — сбрасываем счётчики
        const now = Date.now();
        if (now - this._rateWindowStart >= RATE_WINDOW_MS) {
            this._rateWindowStart = now;
            this._toastCount = 0;
            this._hapticCount = 0;
        }

        // Списываем квоту соответствующего вида команды
        if (kind === "toast") {
            if (this._toastCount >= MAX_TOASTS_PER_WINDOW) return false;
            this._toastCount++;
            return true;
        }

        if (this._hapticCount >= MAX_HAPTICS_PER_WINDOW) return false;
        this._hapticCount++;
        return true;

    }

    /**
     * ***************************************************************************
     * Отправка данных приложения боту (web_app_send_data).
     * @param data - Данные приложения.
     * ***************************************************************************
     */
    private async _sendData(data: string | undefined): Promise<void> {

        // Пустые данные отправлять нечего
        if (!data) return;

        // Лимит данных: при превышении — тост и ничего не отправляем
        if (data.length > MAX_SEND_DATA_LENGTH) {
            Toast.error(window._lc.forms.bot_app.toasts.data_too_long);
            return;
        }

        try {

            // Отправляем данные боту
            await sendDataRequest({ bot_app_id: this.form.appId, data });

        } catch (error) {

            Logger.error(error);

            // Разбираем коды ошибок сервера
            if (getErrorMessage(error).includes("BOT_NOT_IN_NETWORK")) {
                Toast.error(window._lc.forms.bot_app.toasts.bot_offline);
            } else if (getErrorStatus(error) === 429 || getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED")) {
                Toast.error(window._lc.api.errors.rate_limit_exceeded);
            } else {
                Toast.error(window._lc.api.errors.server_error);
            }

        }

    }

    /**
     * ***************************************************************************
     * Открытие внешней ссылки по команде приложения (web_app_open_link).
     * @param url - Ссылка.
     * ***************************************************************************
     */
    private _openLink(url: string | undefined): void {

        // Открываем только абсолютные https-ссылки: javascript:/data:/blob: и
        // относительные адреса отбрасываем молча — это ошибка приложения
        if (!url) return;
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return;
        }
        if (parsed.protocol !== "https:") return;

        // Диалог-синглтон: закрываем предыдущий, чтобы показать актуальную ссылку
        MessageUrlClickConfirm.instance?.modal?.close();

        // Открытие — через подтверждение: источник команды — стороннее приложение
        new MessageUrlClickConfirm({ url: parsed.toString() });

    }

    /**
     * ***************************************************************************
     * Запрос разрешения на доступ к устройству (web_app_request_permission).
     * @param permission - Тип доступа.
     * ***************************************************************************
     */
    private _requestPermission(permission: string | undefined): void {

        // Только известные типы доступа
        if (!isAppPermission(permission)) return;
        const requested: AppPermission = permission;

        // Разрешение уже выдано — отвечаем без диалога
        if (this._hasPermission(requested)) {
            this._sendToApp("web_app_permission_result", { permission: requested, granted: true });
            return;
        }

        // Пауза после диалога — приложение не может зациклить модалку
        if (Date.now() < this._permissionCooldownUntil) return;

        // Диалог уже открыт — повторные запросы не показываем
        if (PermissionDialog.instance || this._permissionDialog) return;

        // Показываем диалог подтверждения платформы
        this._permissionDialog = new PermissionDialog({
            permission: requested,
            app_name: this.form?.initData?.name ?? "",
            callback: (granted) => this._onPermissionDecision(requested, granted)
        });

    }

    /**
     * ***************************************************************************
     * Решение пользователя по разрешению на доступ к устройству.
     * @param permission - Тип доступа.
     * @param granted - Разрешение выдано.
     * ***************************************************************************
     */
    private _onPermissionDecision(permission: AppPermission, granted: boolean): void {

        // Диалог закрыт — включаем паузу против зацикливания модалки
        this._permissionDialog = null;
        this._permissionCooldownUntil = Date.now() + PERMISSION_COOLDOWN_MS;

        // Отказ — отвечаем приложению сразу
        if (!granted) {
            this._sendToApp("web_app_permission_result", { permission, granted: false });
            return;
        }

        const iframe = this.form?.iframe;
        if (!iframe) return;

        // Запоминаем выданное разрешение для следующих открытий приложения
        grantPermission(this.form.appId, permission);

        // Токены: выданные ранее + текущее (хранилище может быть недоступно)
        const tokens = new Set<AppPermission>([...getGrantedPermissions(this.form.appId), permission]);

        // Permissions Policy применяется к документу iframe только при его
        // загрузке — выставляем allow и перезагружаем документ; SDK приложения
        // повторит запрос из флага и получит подтверждение в новом документе
        iframe.allow = Array.from(tokens).join("; ");

        const contentWindow = iframe.contentWindow;
        if (!contentWindow) {

            // Документ недоступен — отвечаем без перезагрузки (лучше, чем молчание)
            this._sendToApp("web_app_permission_result", { permission, granted: true });
            return;
        }

        try {
            contentWindow.location.reload();
        } catch {
            // Навигация через reload недоступна — перезагружаем сменой src
            iframe.src = iframe.src;
        }

    }

    /**
     * ***************************************************************************
     * Проверяет, выдано ли приложению разрешение на доступ.
     * @param permission - Тип доступа.
     * @returns true, если токен есть в allow iframe.
     * ***************************************************************************
     */
    private _hasPermission(permission: AppPermission): boolean {
        const allow = this.form?.iframe?.allow ?? "";
        return allow.split(";").some((token) => token.trim() === permission);
    }

    /**
     * ***************************************************************************
     * Отправка события приложению в iframe.
     * @param eventType - Тип события.
     * @param eventData - Полезная нагрузка.
     * ***************************************************************************
     */
    private _sendToApp(eventType: string, eventData: Record<string, unknown>): void {

        // Без origin приложения событие не шлём — не отдаём его чужому домену
        const targetOrigin = this.form?.appOrigin;
        if (!targetOrigin || !this.form?.iframe?.contentWindow) return;

        this.form.iframe.contentWindow.postMessage({ eventType, eventData }, targetOrigin);

    }

    /**
     * ***************************************************************************
     * Главная кнопка приложения в футере формы (web_app_setup_main_button).
     * @param data - Данные команды (видимость, активность, текст, цвета).
     * ***************************************************************************
     */
    private _updateMainButton(data: WebAppEventData): void {

        const footer = this.form?.footer;
        if (!footer) return;

        // Первая команда создаёт кнопку в футере
        let wrap = this._mainButtonWrap;
        let button = this._mainButton;

        if (!wrap || !button) {

            // Обёртка с отступами: без неё пустой футер не занимает места
            wrap = document.createElement("div");
            wrap.className = "p-2 px-3 border-t border-[var(--border-color)]";

            button = new Buttons({
                intent: "primary",
                shape: "square",
                size: "lg",
                classes: ["w-full", "h-11"],
                attributes: ["action-main"]
            }).dom;

            // Клик по главной кнопке — приложению (SDK слушает main_button_pressed)
            button.addEventListener("click", () => this._sendToApp("main_button_pressed", {}));

            wrap.appendChild(button);
            footer.appendChild(wrap);

            this._mainButtonWrap = wrap;
            this._mainButton = button;
        }

        // Текст задаёт приложение; цвета кнопки приложения НЕ применяются —
        // кнопка использует токен темы платформы var(--color-brand) (тот же,
        // что уходит приложению в theme_changed) и перекрашивается вместе
        // с темой
        if (data.text !== undefined) button.textContent = data.text;
        if (data.is_active !== undefined) button.disabled = !data.is_active;

        // Видимость — на обёртке; неактивность визуализируют классы disabled
        wrap.classList.toggle("hidden", data.is_visible !== true);

    }

    /**
     * ***************************************************************************
     * Кнопка «Назад» приложения в шапке формы (web_app_setup_back_button).
     * @param data - Данные команды (видимость).
     * ***************************************************************************
     */
    private _updateBackButton(data: WebAppEventData): void {

        if (data.is_visible === undefined) return;

        // Кнопка заведена в шаблоне со скрытием — переключаем только её
        this.form?.tpl?.querySelector<HTMLElement>(":scope >.header [action-backward]")
            ?.classList.toggle("hidden", !data.is_visible);

    }

    /**
     * ***************************************************************************
     * Нажатие кнопки «Назад» приложения — отправляется приложению
     * (SDK слушает back_button_pressed).
     * ***************************************************************************
     */
    notifyBackButtonPressed(): void {
        this._sendToApp("back_button_pressed", {});
    }

    /**
     * ***************************************************************************
     * Обработка входящих команд от Mini App.
     * @param event - Событие postMessage.
     * ***************************************************************************
     */
    async handleMessage(event: MessageEvent): Promise<void> {

        try {

            // Проверяем, что сообщение пришло именно от нашего iframe
            if (!this.form?.iframe || event.source !== this.form.iframe.contentWindow) return;

            // Проверяем origin: iframe мог сам себя перенаправить на другой домен —
            // команды чужого origin не исполняем (без origin приложения тоже закрываемся)
            if (event.origin !== this.form.appOrigin) return;

            // Читаем только новый стандарт API; нагрузка извне — проверяем guard'ом
            const payload: unknown = event.data;
            if (!isWebAppEvent(payload)) return;
            const { eventType, eventData = {} } = payload;
            Logger.debug(`[bot-web-app][event]: ${eventType}`);

            // Текст из команд приложения обрезаем — шапка и тосты не раздуваются
            if (eventData.message) eventData.message = eventData.message.slice(0, MAX_TEXT_LENGTH);
            if (eventData.title) eventData.title = eventData.title.slice(0, MAX_HEADER_LENGTH);
            if (eventData.subtitle) eventData.subtitle = eventData.subtitle.slice(0, MAX_HEADER_LENGTH);
            if (eventData.text) eventData.text = eventData.text.slice(0, MAX_HEADER_LENGTH);

            // Обработка команд от Mini App
            switch (eventType) {

                // Приложение готово
                case "web_app_ready":
                    this.sendThemeUpdate();
                    break;

                // Запрос актуальной темы при инициализации
                case "web_app_request_theme":
                    this.sendThemeUpdate();
                    break;

                // Команда закрыть приложение
                case "web_app_close":
                    if (this.form.modal) this.form.modal.close();
                    break;

                // Развернуть приложение на весь экран
                case "web_app_expand":
                    maximizeHandler(this.form);
                    break;

                // Команда показать нативное уведомление
                case "web_app_show_toast":
                    if (eventData?.message && this._allowCommand("toast")) {
                        Toast.info(eventData.message, { position: "bottom-center" });
                    }
                    break;

                // Команда сменить заголовок в шапке
                case "web_app_set_title":
                    if (eventData?.title && this.form.title) {
                        this.form.title.textContent = eventData.title;
                    }
                    break;

                // Подзаголовок зарезервирован под origin приложения —
                // команду приложения на его смену не исполняем
                case "web_app_set_subtitle":
                    break;

                // Данные приложения — боту
                case "web_app_send_data":
                    await this._sendData(eventData.data);
                    break;

                // Открытие внешней ссылки средствами хоста
                case "web_app_open_link":
                    this._openLink(eventData.url);
                    break;

                // Запрос разрешения на доступ к устройству
                case "web_app_request_permission":
                    this._requestPermission(eventData.permission);
                    break;

                // Главная кнопка приложения в футере формы
                case "web_app_setup_main_button":
                    this._updateMainButton(eventData);
                    break;

                // Кнопка «Назад» приложения в шапке формы
                case "web_app_setup_back_button":
                    this._updateBackButton(eventData);
                    break;

                // Вызов нативной вибрации
                case "web_app_haptic_feedback":
                    if (navigator.vibrate && this._allowCommand("haptic")) {
                        if (eventData.type === "impact" && eventData.style === "heavy") {
                            navigator.vibrate(50);
                        } else {
                            navigator.vibrate(15);
                        }
                    }
                    break;
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Вспомогательный метод: сбор актуальной темы и CSS-переменных хост-платформы.
     * @returns Цветовая схема и собранные CSS-переменные.
     * ***************************************************************************
     */
    getHostThemeData(): { colorScheme: "dark" | "light"; themeParams: Record<string, string> } {

        // Получаем css данные
        const root = document.documentElement;
        const styles = getComputedStyle(root);

        // Получаем цветовую схему
        const isDark = root.getAttribute("data-theme") === "dark";

        // Массив css variables
        const cssVariables = [
            "--safeareatop", "--safeareabottom", "--safearealeft",
            "--safearearight", "--bg-color", "--form-bg",
            "--modal-bg", "--second-bg", "--border-color", "--text-color",
            "--text-secondary", "--text-muted", "--font-sans", "--font-mono",
            "--color-brand", "--interface-size", "--message-text-size"
        ];

        // Собираем данные
        const themeParams: Record<string, string> = {};
        cssVariables.forEach(varName => {
            const val = styles.getPropertyValue(varName).trim();
            if (val) themeParams[varName] = val;
        });

        return {
            colorScheme: isDark ? "dark" : "light",
            themeParams
        };

    }

    /**
     * ***************************************************************************
     * Публичный метод принудительной отправки свежей темы в iframe.
     * ***************************************************************************
     */
    sendThemeUpdate(): void {
        this._sendToApp("theme_changed", this.getHostThemeData());
    }

}
