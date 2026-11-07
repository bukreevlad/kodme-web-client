// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Store } from "../../utils/store.js";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CENTERED_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем components
import { UserSessionItem, isSessionItemData } from "./components/session.js";

// Импортируем handlers
import { loginHandler } from "./handlers/login.js";
import { registrationHandler } from "./handlers/registration.js";
import { checkHandler } from "./handlers/check.js";

// Импортируем типы
import type { SessionItemData } from "./components/session.js";

// Form
export class Sessions {

    /** Настройки формы. */
    options: Record<string, unknown>;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (для скроллбара). */
    content: HTMLElement | null = null;

    /** Список сессий (DOM). */
    list: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Хранилище списка сессий. */
    store: Store<SessionItemData> = new Store<SessionItemData>();

    /**
     * ***************************************************************************
     * Форма выбора сохранённой сессии.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: Record<string, unknown>) {

        // Устанавливаем настройки
        this.options = {
            ...options
        }

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store
        this._storeEvents();

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Авторизация
            const login = this.tpl.querySelector("[action-login]");
            login?.addEventListener("click", () => loginHandler(this));

            // Регистрация
            const registration = this.tpl.querySelector("[action-registration]");
            registration?.addEventListener("click", () => registrationHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.content = content;
            this.list = this.tpl.querySelector<HTMLElement>("[data-sessions-list]");

            // Сессии
            const sessions = LocalStorage.getAllSessions();

            // Проходим по сессиям
            sessions.forEach(session => {
                this.store.add(session);
            });

            // Инициализируем скроллбар (скролл-контейнер входит в шаблон)
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Проверяем, есть ли последняя активная сессия
            // Если есть — выполняем автовход
            const lastActiveSession = sessions.find(s => s.last_active === true);
            if (lastActiveSession) {
                checkHandler(this, lastActiveSession);
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Эвенты хранилища
    // ***************************************************************************
    _storeEvents(): void {

        // Подписываемся на событие добавления нового элемента
        this.store.on('item::added', (data) => {

            // Guard: payload события — элемент списка сессий
            if (!isSessionItemData(data)) return;

            // Создаем DOM-элемент (без списка и DOM добавлять нечего)
            const item = new UserSessionItem(this, data);
            const itemDom = item.getDOM();
            if (this.list && itemDom) this.list.appendChild(itemDom);

        });

        // ---------------------------------------------------

        // Подписываемся на событие удаление элемента
        this.store.on('item::removed', (data) => {

            // Guard: payload события — элемент списка сессий
            if (!isSessionItemData(data)) return;

            // Проверяем наличие массива элементов
            if (data.__domElements__ && Array.isArray(data.__domElements__)) {
                data.__domElements__.forEach(element => {
                    if (element && typeof element.remove === 'function') {
                        element.remove();
                    }
                });
                Logger.debug(`Успешно удалено копий элемента: ${data.__domElements__.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];
            }

        });

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal sessions flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_CENTERED_CONTENT_CLASSES()}">

                    <div class="w-full flex flex-col gap-4">

                        <div class="flex flex-col items-center text-center gap-0.5 select-none">
                            <span class="text-base font-bold mt-1 leading-snug">${window._lc.forms.sessions.title}</span>
                            <span class="text-sm text-secondary font-normal leading-snug">${window._lc.forms.sessions.subtitle}</span>
                        </div>

                        <div data-sessions-list class="flex flex-col gap-2.5"></div>

                    </div>

                </div>

                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
                        attributes: ["action-login"],
                        classes: ["flex-1"],
                        text: window._lc.forms.sessions.login,
                        icon: "login-2"
                    })}
                    ${Buttons.primary({
                        attributes: ["action-registration"],
                        classes: ["flex-1"],
                        text: window._lc.forms.sessions.registration,
                        icon: "user-plus"
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
