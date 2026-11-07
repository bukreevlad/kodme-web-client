// Загружаем utils
import { IsMobile } from "../../utils/helpers/is_mobile.js";

// Загружаем forms
import { Home } from "../../forms/home/index.js";

/**
 * Модалка формы, нужная менеджеру табов: показать/скрыть шаблон и
 * активировать/закрыть форму.
 */
export interface FormTabModal {
    /** Шаблон формы в DOM (его видимость переключается при смене таба). */
    tpl?: HTMLElement | null;
    /** Вывести форму на передний план. */
    activate?: () => void | Promise<void>;
    /** Закрыть форму (она сама кинет событие `[app][form]::closed`). */
    close?: () => void | Promise<void>;
}

/**
 * Экземпляр формы, который может жить в панели табов.
 * Требования минимальны: табу нужна только модалка формы.
 */
export interface FormTabInstance {
    /** Модалка формы; у форм без модалки таб закрывается вручную. */
    modal?: FormTabModal | null;
}

/**
 * Данные таба, приходящие в событии `[app][form]::opened`.
 */
export interface FormTabData {
    /** Экземпляр формы (Messages, Call и т.д.). */
    instance: FormTabInstance;
    /** Заголовок таба. */
    title?: string;
    /** Подпись таба. */
    subtitle?: string;
}

// Собственные события window приложения: типизация detail для слушателей ниже.
declare global {
    interface WindowEventMap {
        /** Открыта форма: `detail.id` — id модалки, `detail.data` — данные таба. */
        "[app][form]::opened": CustomEvent<{ id: string; data: FormTabData }>;
        /** Закрыта форма: `detail.id` — id модалки. */
        "[app][form]::closed": CustomEvent<{ id: string }>;
        /** Запрос активации уже открытой формы: `detail.id` — id модалки. */
        "[app][form]::activate": CustomEvent<{ id: string }>;
    }
}

/** Запись реестра табов: DOM-элемент и экземпляр формы. */
interface FormTabEntry {
    /** Элемент таба в панели. */
    tab: HTMLElement;
    /** Экземпляр формы-владельца таба. */
    instance: FormTabInstance;
}

/**
 * ***************************************************************************
 * TabsManager - универсальный менеджер вкладок для любых типов форм.
 * ***************************************************************************
 */
export class TabsManager {

    // Устанавливаем параметры
    static container: HTMLElement | null = null;
    static list: Element | null = null;
    static tabs = new Map<string, FormTabEntry>();
    static currentActiveId: string | null = null;

    /**
     * ***************************************************************************
     * @param {HTMLElement} container - Элемент, где будут табы.
     * ***************************************************************************
     */
    static init(container: HTMLElement) {

        // Записываем контейнер
        this.container = container;
        this.list = this.container.querySelector("[data-list]");

        // Инициализируем глобальные прослушиватели
        this._initGlobalEvents();

    }

    /**
     * ***************************************************************************
     * Инициализация глобальных событий для связи с формами.
     * ***************************************************************************
     */
    static _initGlobalEvents() {

        // Слушаем открытие новой формы
        window?.addEventListener("[app][form]::opened", (e) => {
            const { id, data } = e.detail;
            if (id && data) this.addTab(id, data);
        });

        // Слушаем закрытие формы
        window?.addEventListener("[app][form]::closed", (e) => {
            const { id } = e.detail;
            if (id) this.removeTab(id);
        });

        // Слушаем запрос на активацию существующей формы
        window?.addEventListener("[app][form]::activate", (e) => {
            const { id } = e.detail;
            if (id && this.tabs.has(id)) {
                this.activateTab(id);
            }
        });

    }

    /**
     * ***************************************************************************
     * Добавить форму в панель табов. Вызывается обработчиком события
     * `[app][form]::opened` и напрямую формами (разворачивание
     * WebApp-приложения в плавающее окно).
     * @param {string} id - Уникальный идентификатор (channelId, callId и т.д.).
     * @param {FormTabData} data - Данные таба (экземпляр формы, заголовок, подпись).
     * ***************************************************************************
     */
    static addTab(id: string, data: FormTabData) {

        // Если мобильная версия
        if (IsMobile.get()) return;

        // Панель табов не инициализирована (init не вызван) — отображать нечего
        if (!this.list) return;

        // Проверяем, не открыт ли уже этот ID
        if (this.tabs.has(id)) {
            this.activateTab(id);
            return;
        }

        // Проверяем, не открыт ли этот инстанс под другим ID
        const existingId = this.hasInstance(data.instance);
        if (existingId) {
            this.activateTab(existingId);
            return;
        }

        const tabEl = this._templateTab();
        tabEl.dataset.id = id;

        // Элементы подписей входят в шаблон _templateTab — пропускаем только
        // если разметку когда-нибудь поменяют не в нашу пользу
        const tabName = tabEl.querySelector(".tab-name");
        const tabSubtitle = tabEl.querySelector(".tab-subtitle");
        if (tabName) tabName.textContent = data.title ?? null;
        if (tabSubtitle) tabSubtitle.textContent = data.subtitle ?? null;

        // Клик по табу
        tabEl?.addEventListener("click", (e) => {
            // invariant: цель клика по табу — всегда Element с closest()
            if (e.target instanceof Element && !e.target.closest(".tab-close")) {
                data.instance.modal?.activate?.();
            }
        });

        // Клик по кнопке закрытия — вызываем закрытие формы
        tabEl.querySelector(".tab-close")?.addEventListener("click", (e) => {
            e.stopPropagation();

            // Сначала закрываем саму форму (она сама кинет событие form:closed)
            if (data.instance?.modal) {
                data.instance.modal.close?.();
            } else {
                // Если модалки нет, удаляем таб вручную
                this.removeTab(id);
            }
        });

        // Отображаем
        this.list.append(tabEl);

        // Даем время браузеру отрисовать новый таб, потом обновляем OS
        requestAnimationFrame(() => {
            if (Home.instance && Home.instance.osListScrollInstance) {
                const os = Home.instance.osListScrollInstance;
                os.update();
                tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            }
        });

        // Добавляем в Map
        this.tabs.set(id, { tab: tabEl, instance: data.instance });

        // При добавлении новой формы сразу активируем её
        this.activateTab(id);

    }

    /**
     * ***************************************************************************
     * Визуальная активация таба.
     * @param {string} id - ID формы.
     * ***************************************************************************
     */
    static activateTab(id: string) {

        // Запоминаем текущий активный ID
        this.currentActiveId = id;

        // Проходим по табам
        this.tabs.forEach((data, currentId) => {
            const isActive = (currentId === id);
            const formTpl = data.instance?.modal?.tpl;

            data.tab.classList.toggle("active", isActive);

            if (formTpl) {
                if (isActive) {
                    formTpl.style.visibility = "";
                    formTpl.style.opacity = "";
                    formTpl.style.pointerEvents = "";
                    if (formTpl.style.display === "none") formTpl.style.display = "flex";
                } else {
                    formTpl.style.visibility = "hidden";
                    formTpl.style.opacity = "0";
                    formTpl.style.pointerEvents = "none";
                }
            }
        });

    }

    /**
     * ***************************************************************************
     * Обновить заголовок таба
     * @param {string} id - ID формы.
     * @param {string} newTitle - Новый заголовок.
     * ***************************************************************************
     */
    static updateTitle(id: string, newTitle: string) {

        const data = this.tabs.get(id);
        if (data) {
            const nameEl = data.tab.querySelector(".tab-name");
            if (nameEl) nameEl.textContent = newTitle;
        }

    }

    /**
     * ***************************************************************************
     * Удалить таб. Удаляется только запись таба — сама форма при этом не
     * закрывается (её закрытие приходит отдельным событием
     * `[app][form]::closed`); вызывается и напрямую формами (сворачивание
     * WebApp-приложения в плавающее окно).
     * @param {string} id - ID формы.
     * ***************************************************************************
     */
    static removeTab(id: string) {

        const data = this.tabs.get(id);
        if (data) {

            // Удаляем DOM-элемент
            data.tab.remove();

            // Удаляем из реестра
            this.tabs.delete(id);

            // Если закрытый таб был активным, нужно переключиться на другой
            if (this.currentActiveId === id) {

                if (this.tabs.size > 0) {

                    const keys = Array.from(this.tabs.keys());
                    const lastId = keys[keys.length - 1];
                    if (lastId) this.activateTab(lastId);

                } else {
                    this.currentActiveId = null;
                }

            }
        }

    }

    /**
    * ***************************************************************************
    * Проверить, существует ли таб с конкретным экземпляром формы.
    * @param {unknown} instance - Экземпляр формы.
    * @returns {string|null} - Возвращает ID таба, если найден.
    * ***************************************************************************
    */
    static hasInstance(instance: unknown): string | null {
        for (const [id, data] of this.tabs) {
            if (data.instance === instance) return id;
        }
        return null;
    }

    // ***************************************************************************
    // Шаблон таба
    // ***************************************************************************
    static _templateTab(): HTMLElement {

        // Пилюля: статика (высота, скругления, типографика) — здесь,
        // а состояния hover/active — в css/forms/home.css, потому что
        // активность переключается классом .active из activateTab()
        const tab = new DOMParser().parseFromString(`

            <div class="tab flex flex-row items-center gap-2 h-12 max-w-[15rem] pl-2 pr-2 cursor-pointer select-none rounded-md transition-all duration-150 motion-reduce:transition-none">
                <div class="flex flex-col min-w-0">
                    <span class="tab-name text-sm font-semibold text-secondary truncate transition-colors duration-150 motion-reduce:transition-none"></span>
                    <span class="tab-subtitle text-xs font-medium text-secondary empty:hidden truncate"></span>
                </div>
                <button type="button" class="tab-close grid place-items-center size-5 shrink-0 rounded-full bg-transparent border-0 text-sm leading-none cursor-pointer select-none text-secondary opacity-0 pointer-events-none transition-all duration-150 motion-reduce:transition-none">×</button>
            </div>

        `, "text/html").querySelector<HTMLElement>(".tab");

        // invariant: корневой .tab входит в сам шаблон — разбор не может
        // не найтись; падаем явно, а не отдаём null дальше
        if (!tab) throw new Error("Не удалось разобрать шаблон вкладки");

        // Доступное имя кнопки закрытия — из локали (уклон от «×», как у тоста)
        tab.querySelector(".tab-close")
            ?.setAttribute("aria-label", window._lc?.components?.tabs?.close ?? "Закрыть вкладку");

        return tab;

    }

}
