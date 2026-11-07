// Импортируем config
import { CDM_MODAL_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { getErrorMessage } from "../../utils/helpers/error_util.js";
import { IsMobile } from "../../utils/helpers/is_mobile.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toast } from "../../components/toast.js";

// Импортируем functions
import { Bridge } from "./functions/bridge.js";
import { loadInitData } from "./functions/load_init_data.js";
import { getGrantedPermissions } from "./functions/permissions.js";

// Импортируем handlers
import { maximizeHandler } from "./handlers/maximize.js";
import { minimizeHandler } from "./handlers/minimize.js";

// Импортируем типы
import type { BotAppInitData } from "./requests/generate_init_data.js";
import type { BotAppData } from "./types.js";

// Form
export class BotApp {

    // Реестр всех открытых форм BotApp: { appId: instance }
    static instances = new Map<string, BotApp>();

    /** Настройки формы. */
    options: BotAppData["options"];

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Заголовок приложения в шапке формы. */
    title: HTMLElement | null = null;

    /** Подзаголовок в шапке формы. */
    subtitle: HTMLElement | null = null;

    /** Кнопка «Развернуть» в шапке формы. */
    maximize: HTMLElement | null = null;

    /** Кнопка «Свернуть» в шапке формы. */
    minimize: HTMLElement | null = null;

    /** Футер формы — контейнер главной кнопки приложения. */
    footer: HTMLElement | null = null;

    /** iframe приложения. */
    iframe: HTMLIFrameElement | null = null;

    /** Id приложения. */
    appId: string;

    /** Init-данные приложения (название, url, hmac). */
    initData: BotAppInitData | null = null;

    /** Origin приложения (схема + хост + порт) — для проверки postMessage-команд. */
    appOrigin: string | null = null;

    /** Окно развёрнуто на весь контейнер форм (состояние maximize/minimize). */
    maximized: boolean = false;

    /** Мост postMessage с iframe приложения. */
    bridge: Bridge;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.appId - ID приложения.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BotAppData) {

        // Проверяем данные
        if (!data?.appId) throw new Error("Не передан: appId");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы
        this.appId = data.appId;

        // Создаем экземпляр моста для этой формы (до проверки реестра:
        // строгий TS требует инициализации на всех ветках конструктора)
        this.bridge = new Bridge(this);

        // Повторное открытие: возвращаем уже открытый экземпляр
        // и выводим его на передний план
        const instance = BotApp.instances.get(data.appId);
        if (instance) {
            instance.modal?.activate();
            return instance;
        }

        // Регистрируем этот экземпляр формы
        BotApp.instances.set(data.appId, this);

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Init-данные запрашиваем до создания формы: без них открывать нечего,
            // а ошибка должна дойти до пользователя тостом, а не «пустым окном»
            await loadInitData(this);

            // Шаблон формы
            this.tpl = this._template();

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                url: `?bot-web-app=${this.appId}`,
                insertInto: this.options?.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                move: {
                    enabled: true,
                    element: this.tpl.querySelector(":scope >.header") ?? undefined
                },
                resize: true
            });

            // Открываем форму
            await this.modal.open();

        } catch (error) {

            Logger.error(error);

            // Снимаем экземпляр из реестра — повторное открытие создаст новый
            BotApp.instances.delete(this.appId);

            // Показываем ошибку открытия пользователю
            if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED")) {
                Toast.error(window._lc.api.errors.rate_limit_exceeded);
            } else {
                Toast.error(window._lc.forms.bot_app.toasts.load_error);
            }

            // Закрываем форму, если она успела смонтироваться в DOM
            if (this.modal) await this.modal.close();
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            const close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Раскрыть как форму
            this.maximize?.addEventListener("click", () => maximizeHandler(this));

            // Раскрыть как форму
            this.minimize?.addEventListener("click", () => minimizeHandler(this));

            // Кнопка «Назад» приложения: видимостью ей управляет приложение
            // через мост, по клику отправляем приложению back_button_pressed
            const backward = this.tpl.querySelector(`:scope >.header [action-backward]`);
            backward?.addEventListener("click", () => this.bridge.notifyBackButtonPressed());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        // Элементы задаются шаблоном — без него нечего настраивать
        if (!this.tpl) return;

        // Устанавливаем элементы
        this.title = this.tpl.querySelector(":scope >.header [data-title]");
        this.subtitle = this.tpl.querySelector(":scope >.header [data-subtitle]");
        this.maximize = this.tpl.querySelector(":scope >.header [action-maximize]");
        this.minimize = this.tpl.querySelector(":scope >.header [action-minimize]");
        this.footer = this.tpl.querySelector(":scope >.footer");
        this.iframe = this.tpl.querySelector("iframe");

        // invariant: initData заполнена в loadInitData — иначе форма не открывалась бы
        const initData = this.initData;
        if (!initData) throw new Error("Нет init-данных приложения");

        // Заголовок и фрейм обязаны быть в шаблоне — иначе приложению
        // не показать имя и некуда подставить url
        const title = this.title;
        const subtitle = this.subtitle;
        const iframe = this.iframe;
        if (!title || !iframe) return;

        // Показываем название приложения
        title.textContent = initData.name;

        // Показываем origin приложения: подзаголовок приложение менять не может —
        // пользователь видит, чей домен он открывает
        if (subtitle) subtitle.textContent = this.appOrigin;

        // Подготавливаем url
        const appUrl = new URL(initData.url);
        appUrl.hash = `WebAppData=${encodeURIComponent(initData.hmac)}`;

        // Выданные ранее разрешения применяем до загрузки документа —
        // Permissions Policy читается при загрузке iframe
        iframe.allow = getGrantedPermissions(this.appId).join("; ");

        // Устанавливаем url приложения
        iframe.src = appUrl.toString();

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Подключаем handlers
        this._handlers();

        // Инициализируем мост
        this.bridge.init();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Уничтожаем слушатель в Bridge
        this.bridge.destroy();

        // Удаляем экземпляр формы из реестра
        BotApp.instances.delete(this.appId);

        // Сообщаем системе, что форма закрыта
        window.dispatchEvent(new CustomEvent("[app][form]::closed", {
            detail: { id: this.modal?.options.id }
        }));

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // На мобильных разворот недоступен: табы форм там не работают,
        // а перенос окна в контейнер форм ломает вёрстку
        const maximizeClasses = IsMobile.get() ? ["hidden"] : [];

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal bot-web-app flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="header flex flex-row gap-2 p-2 px-3 justify-between items-center border-b border-[var(--border-color)]">
                    <div class="flex items-center gap-2 overflow-hidden">
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-backward"], classes: ["hidden"], icon: "ArrowLeft" })}
                        <div class="flex flex-col gap-0">
                            <span data-title class="font-semibold text-sm truncate"></span>
                            <span data-subtitle class="font-semibold text-sm truncate empty:hidden"></span>
                        </div>
                    </div>
                    <div class="flex flex-row gap-1">
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-minimize"], classes: ["hidden"], icon: "minimize" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-maximize"], classes: maximizeClasses, icon: "maximize" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "x" })}
                    </div>
                </div>
                <div class="content flex-1 w-full h-full relative">
                    <iframe 
                        src="about:blank" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                        referrerpolicy="no-referrer"
                        class="absolute w-full h-full border-0 block"
                    ></iframe>
                </div>
                <div class="footer w-full"></div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
