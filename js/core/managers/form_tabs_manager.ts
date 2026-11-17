// Импортируем utils
import type { Home } from "../../forms/home/index.js";
import { IsMobile } from "../../utils/helpers/is_mobile.js";
import { Logger } from "../../utils/logs/logger.js";
import { t } from "../../utils/i18n/index.js";

// Импортируем managers
import { FormsRegistry } from "./forms_registry.js";
import { LayoutManager } from "./layout_manager.js";

// Импортируем типы
import type { FormEntry } from "./forms_registry.js";

// Собственные события window приложения: типизация detail для слушателей ниже.
declare global {
    interface WindowEventMap {
        /** Запрос активации уже открытой формы: `detail.id` — id слоя. */
        "[app][form]::activate": CustomEvent<{ id: string }>;
    }
}

/**
 * ***************************************************************************
 * TABS_MANAGER - пульт пилюль вкладок.
 * ***************************************************************************
 *
 * Рисует пилюли для записей реестра открытых форм с ролью `workspace`:
 * создание/обновление/удаление пилюли идут по событиям `FormsRegistry`,
 * а видимостью форм владеет `LayoutManager` (активация рабочего места).
 * Пилюля ничего не решает сама — она только передаёт команды:
 * клик → активировать форму, крестик → закрыть форму.
 *
 * Кто чем владеет:
 * - `FormsRegistry` — данные об открытом (включая заголовки пилюль);
 * - `LayoutManager` — контейнеры, раскладки, видимость;
 * - этот менеджер — только DOM пилюль.
 *
 * Мобильная версия: пилюль нет (стек форм в `.left`), менеджер не работает.
 * ***************************************************************************
 */
export class TabsManager {

    /** Панель пилюль (контейнер в DOM). */
    static container: HTMLElement | null = null;

    /** Список пилюль (контейнер-обёртка панели). */
    static list: Element | null = null;

    /** Пилюли по id записей реестра открытых форм. */
    static tabs = new Map<string, HTMLElement>();

    /** Подписки инициализированы (init может вызываться повторно). */
    private static _watchAttached = false;

    /**
     * ***************************************************************************
     * Инициализация пульта: панель пилюль и подписки на реестр/раскладки.
     * @param {HTMLElement} container - Элемент панели пиуль (с `[data-list]`).
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
     * Создаёт DOM-элемент пилюли. Фабрика вынесена отдельно: её переопределяют
     * тесты (без DOM в тестовом окружении).
     * @returns {HTMLElement} - DOM-элемент пилюли.
     * ***************************************************************************
     */
    static createTabElement(): HTMLElement {

        // Пилюля: статика (высота, скругления, типографика) — здесь,
        // а состояния hover/active — в css/forms/home.css, потому что
        // активность переключается классом .active из _syncActiveState()
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
            ?.setAttribute("aria-label", t("components.tabs.close"));

        return tab;

    }

    // --- Private Methods ---

    /**
     * ***************************************************************************
     * Инициализирует подписки: события реестра (пилюли) и раскладок
     * (активность), мост старых событий форм.
     * @private
     * ***************************************************************************
     */
    static _initGlobalEvents(): void {

        // Подписки вешаются один раз: init может вызываться повторно
        if (this._watchAttached) return;
        this._watchAttached = true;

        // Запись реестра создана/обновлена — показать/обновить пилюлю
        FormsRegistry.on("registered", (entry) => this._syncPill(entry));
        FormsRegistry.on("updated", (entry) => this._syncPill(entry));

        // Запись снята — пилюля уходит, рабочее место закрывается
        FormsRegistry.on("unregistered", (entry) => {
            this._dropPill(entry.id);
            LayoutManager.closeWorkspace(entry.id);
        });

        // Место активировано — подсветить его пилюлю
        LayoutManager.on("workspace-activated", () => this._syncActiveState());

        // форма выведена на передний план — активировать её рабочее место
        window.addEventListener("[app][form]::activate", (e) => {
            const { id } = e.detail;
            if (id) LayoutManager.activate(id);
        });

    }

    /**
     * ***************************************************************************
     * Синхронизирует пилюлю с записью реестра: создаёт/обновляет пилюлю
     * рабочего места либо убирает пилюлю, если запись перестала быть местом.
     * @private
     * @param {FormEntry} entry - Запись реестра открытых форм.
     * ***************************************************************************
     */
    static _syncPill(entry: FormEntry): void {

        // Если мобильная версия — пилюль и рабочих мест нет
        if (IsMobile.get()) return;

        const workspaceId = entry.workspace ?? entry.id;

        // Пилюли положены только рабочим местам; если роль сменилась —
        // убрать пилюлю и закрыть место
        if (entry.placement !== "workspace") {
            this._dropPill(entry.id);
            // Своё место закрываем, чужое (владелец панели) — не трогаем
            if (workspaceId === entry.id) LayoutManager.closeWorkspace(workspaceId);
            return;
        }

        // Рабочее место живёт вместе с пикулей: создаётся один раз (и
        // активируется), контейнер подхватывается после монтирования слоя
        LayoutManager.openWorkspace(workspaceId, entry.wrap ? { container: entry.wrap } : undefined);

        // Панель пиуль не инициализирована — отображать нечего
        if (!this.list) return;

        let tab = this.tabs.get(entry.id);
        if (!tab) {
            tab = this.createTabElement();
            tab.dataset.id = entry.id;
            this._bindTab(tab, entry.id);
            this.list.append(tab);
            this.tabs.set(entry.id, tab);
            this._scrollPillIntoView(tab);
        }

        this._fillTab(tab, entry);
    }

    /**
     * ***************************************************************************
     * Привязывает команды пилюли: клик активирует форму, крестик закрывает.
     * @private
     * @param {HTMLElement} tab - DOM-элемент пилюли.
     * @param {string} id - Id записи реестра.
     * ***************************************************************************
     */
    static _bindTab(tab: HTMLElement, id: string): void {

        // Клик по пикуле — вывести форму на передний план
        tab.addEventListener("click", (e) => {
            // Клик по кнопке закрытия гасится её обработчиком (stopPropagation);
            // проверка цели — страховка от клика по её потомкам
            const target = e.target;
            if (target && "closest" in target && typeof target.closest === "function" && target.closest(".tab-close")) return;
            this._activateEntry(id);
        });

        // Клик по кнопке закрытия — закрыть форму
        tab.querySelector(".tab-close")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this._closeEntry(id);
        });

    }

    /**
     * ***************************************************************************
     * Заполняет пилюлю данными записи и подсвечивает активность.
     * @private
     * @param {HTMLElement} tab - DOM-элемент пилюли.
     * @param {FormEntry} entry - Запись реестра открытых форм.
     * ***************************************************************************
     */
    static _fillTab(tab: HTMLElement, entry: FormEntry): void {

        const tabName = tab.querySelector(".tab-name");
        const tabSubtitle = tab.querySelector(".tab-subtitle");
        if (tabName) tabName.textContent = entry.title ?? null;
        if (tabSubtitle) tabSubtitle.textContent = entry.subtitle ?? null;

        tab.classList.toggle("active", LayoutManager.isActive(entry.workspace ?? entry.id));
    }

    /**
     * ***************************************************************************
     * Убирает пилюлю из DOM (само рабочее место не трогает).
     * @private
     * @param {string} id - Id записи реестра.
     * ***************************************************************************
     */
    static _dropPill(id: string): void {

        const tab = this.tabs.get(id);
        if (!tab) return;

        tab.remove();
        this.tabs.delete(id);
    }

    /**
     * ***************************************************************************
     * Переподсвечивает активность всех пиуль (по активному рабочему месту).
     * @private
     * ***************************************************************************
     */
    static _syncActiveState(): void {

        this.tabs.forEach((tab, id) => {
            const entry = FormsRegistry.get(id);
            tab.classList.toggle("active", LayoutManager.isActive(entry?.workspace ?? id));
        });
    }

    /**
     * ***************************************************************************
     * Выводит форму на передний план: форма сама активируется (raise +
     * навигация), а её рабочее место подсвечивается.
     * @private
     * @param {string} id - Id записи реестра.
     * ***************************************************************************
     */
    static _activateEntry(id: string): void {

        const entry = FormsRegistry.get(id);
        if (!entry) return;

        // Форма умеет активировать себя сама (слой + навигация)
        if ("activate" in entry.instance && typeof entry.instance.activate === "function") {
            void entry.instance.activate();
            return;
        }

        // Без activate — выводим слой и место напрямую
        FormsRegistry.raise(id);
        LayoutManager.activate(entry.workspace ?? id);
    }

    /**
     * ***************************************************************************
     * Закрывает форму: форма закрывается сама (событие и снятие с реестра
     * придут от её слоя), иначе снимаем пилюлю сами.
     * @private
     * @param {string} id - Id записи реестра.
     * ***************************************************************************
     */
    static _closeEntry(id: string): void {

        const entry = FormsRegistry.get(id);
        if (!entry) return;

        // Форма умеет закрывать себя сама
        if ("close" in entry.instance && typeof entry.instance.close === "function") {
            void entry.instance.close();
            return;
        }

        // Без close — снимаем пилюлю и рабочее место
        Logger.warn(`[app][tabs]: Слой "${id}" не закрывается сам — снимаем пилюлю.`);
        this._dropPill(id);
        LayoutManager.closeWorkspace(entry.workspace ?? id);
    }

    /**
     * ***************************************************************************
     * Прокручивает панель пиуль к новой пикуле.
     * @private
     * @param {HTMLElement} tab - DOM-элемент пилюли.
     * ***************************************************************************
     */
    static _scrollPillIntoView(tab: HTMLElement): void {

        // Даем время браузеру отрисовать новый таб, потом обновляем OS.
        // Home импортируется лениво: он тянет DOM-компоненты, а пульт не
        // должен зависеть от конкретной формы
        requestAnimationFrame(() => {
            void import("../../forms/home/index.js").then(({ Home }) => {
                const os = FormsRegistry.getOwner<Home>("home")?.osListScrollInstance;
                if (!os) return;
                os.update();
                tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            });
        });
    }

}
