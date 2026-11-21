// Импортируем managers
import { FormsRegistry } from "./forms_registry.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем типы
import type { FormEntry } from "./forms_registry.js";

/**
 * Раскладка рабочего места: `single` (одна панель), `split-right` (панель
 * справа) и т.д. Строка открытая: как выглядит раскладка — решает CSS по
 * атрибуту `data-layout` контейнера места.
 */
export type WorkspaceLayout = string;

/**
 * Панель рабочего места: контейнер со стеком форм.
 */
export interface PaneState {

    /** Id панели внутри места. */
    id: string;

    /** Контейнер панели в DOM (слот раскладки). */
    container: HTMLElement | null;

    /** Стек форм панели: id записей реестра, вершина — последняя. */
    stack: string[];

}

/**
 * Рабочее место: единица переключения (пилюля) со своей раскладкой.
 */
export interface WorkspaceState {

    /** Id рабочего места. */
    id: string;

    /** Раскладка места. */
    layout: WorkspaceLayout;

    /** Корневой контейнер места в DOM. */
    container: HTMLElement | null;

    /** Панели места по id. */
    panes: Map<string, PaneState>;

}

/** Нагрузка события менеджера раскладок. */
export interface LayoutEventPayload {

    /** Id рабочего места. */
    workspaceId: string;

    /** Id панели (для событий панелей). */
    paneId?: string;

    /** Id записи реестра открытых форм (для событий панелей). */
    entryId?: string;

}

/** Наблюдатель событий менеджера раскладок. */
export type LayoutManagerListener = (payload: LayoutEventPayload) => void;

/** Имена событий менеджера раскладок. */
export type LayoutManagerEvent =
    | "workspace-opened"
    | "workspace-closed"
    | "workspace-activated"
    | "pane-form-pushed"
    | "pane-form-popped";

/**
 * ***************************************************************************
 * LAYOUT_MANAGER - рабочие места, панели и видимость контейнеров.
 * ***************************************************************************
 *
 * Владеет раскладками и видимостью: активное рабочее место видно целиком
 * (его контейнеры и вершины стеков панелей), остальные места скрыты одним
 * действием. Формы в панели живут стеком: видна только вершина, закрытие
 * вершины показывает предыдущую («назад»).
 *
 * Данные об открытых формах живут в `FormsRegistry`; этот менеджер хранит
 * только id записей в стеках и сам подчищает их по событию `unregistered`
 * (форма закрылась — стек актуален без участия форм).
 *
 * Кто чем владеет:
 * - `FormsRegistry` — данные об открытом;
 * - этот менеджер — контейнеры, раскладки, видимость;
 * - `TabsManager` — только пилюли (переключение = `activate` места).
 *
 * Мобильная версия: рабочих мест нет (стек форм в `.left`), менеджер
 * не используется — как и пилюли.
 * ***************************************************************************
 */
export class LayoutManager {

    /** Рабочие места по id: порядок Map = порядок открытия. */
    private static _workspaces = new Map<string, WorkspaceState>();

    /** Id активного рабочего места. */
    private static _activeId: string | null = null;

    /** Наблюдатели событий по именам. */
    private static _listeners: Record<string, LayoutManagerListener[]> = {};

    /** Отписка от реестра открытых форм (подписка — одна на приложение). */
    private static _offUnregistered: (() => void) | null = null;

    /**
     * ***************************************************************************
     * Открывает рабочее место и сразу активирует его.
     * @param {string} id - Id рабочего места.
     * @param {Object} [options] - Настройки места.
     * @param {WorkspaceLayout} [options.layout="single"] - Раскладка места.
     * @param {HTMLElement | null} [options.container=null] - Корневой контейнер места.
     * ***************************************************************************
     */
    static openWorkspace(id: string, options?: { layout?: WorkspaceLayout; container?: HTMLElement | null }): void {
        if (!id) return;
        this._ensureWatch();

        // Повторное открытие места обновляет настройки (контейнер подхватывается
        // после монтирования слоя), но активность не переключает: место
        // активируется один раз — при создании
        const existing = this._workspaces.get(id);
        if (existing) {
            if (options?.container !== undefined && options.container) existing.container = options.container;
            if (options?.layout) existing.layout = options.layout;
            this._applyLayoutAttribute(existing);
            this._applyVisibility();
            return;
        }

        const workspace: WorkspaceState = {
            id,
            layout: options?.layout ?? "single",
            container: options?.container ?? null,
            panes: new Map()
        };
        this._workspaces.set(id, workspace);

        // Вид раскладки решает CSS по атрибуту контейнера
        this._applyLayoutAttribute(workspace);
        this.activate(id);
        this._emit("workspace-opened", { workspaceId: id });
    }

    /**
     * ***************************************************************************
     * Закрывает рабочее место. Если оно было активным — активируется последнее
     * из оставшихся (порядок открытия детерминирован).
     * @param {string} id - Id рабочего места.
     * ***************************************************************************
     */
    static closeWorkspace(id: string): void {
        const workspace = this._workspaces.get(id);
        if (!workspace) return;

        // Контейнеры закрытого места не трогаем: они либо уходят из DOM
        // вместе с формой, либо переезжают к другому владельцу
        // (сворачивание WebApp в бот-профиль)
        this._workspaces.delete(id);

        const wasActive = this._activeId === id;
        if (wasActive) {
            const lastId = Array.from(this._workspaces.keys()).pop();
            this._activeId = lastId ?? null;
            this._applyVisibility();
        }

        this._emit("workspace-closed", { workspaceId: id });

        // Активность сменилась вместе с закрытием — сообщаем, что место
        // активировано (пилюли подсвечиваются именно по этому событию)
        if (wasActive && this._activeId) {
            this._emit("workspace-activated", { workspaceId: this._activeId });
        }
    }

    /**
     * ***************************************************************************
     * Привязывает контейнер панели к рабочему месту (панель создаётся при
     * отсутствии).
     * @param {string} workspaceId - Id рабочего места.
     * @param {string} paneId - Id панели.
     * @param {HTMLElement | null} container - Контейнер панели в DOM.
     * ***************************************************************************
     */
    static setPane(workspaceId: string, paneId: string, container: HTMLElement | null): void {
        const workspace = this._workspaces.get(workspaceId);
        if (!workspace) {
            Logger.warn(`[app][layout]: Рабочее место "${workspaceId}" не открыто — панель "${paneId}" не привязана.`);
            return;
        }

        const pane = workspace.panes.get(paneId) ?? { id: paneId, container: null, stack: [] };
        pane.container = container;
        workspace.panes.set(paneId, pane);

        // Контейнер панели подчиняется видимости места
        if (container) this._setElementVisibility(container, this._activeId === workspaceId);
    }

    /**
     * ***************************************************************************
     * Меняет раскладку рабочего места (вид решает CSS по атрибуту контейнера).
     * @param {string} workspaceId - Id рабочего места.
     * @param {WorkspaceLayout} layout - Новая раскладка.
     * ***************************************************************************
     */
    static setLayout(workspaceId: string, layout: WorkspaceLayout): void {
        const workspace = this._workspaces.get(workspaceId);
        if (!workspace) return;

        workspace.layout = layout;
        this._applyLayoutAttribute(workspace);
    }

    /**
     * ***************************************************************************
     * Активирует рабочее место: его контейнеры и вершины стеков видимы,
     * контейнеры остальных мест скрыты.
     * @param {string} workspaceId - Id рабочего места.
     * ***************************************************************************
     */
    static activate(workspaceId: string): void {
        if (!this._workspaces.has(workspaceId)) return;

        this._activeId = workspaceId;
        this._applyVisibility();
        this._emit("workspace-activated", { workspaceId });
    }

    /**
     * ***************************************************************************
     * Кладёт форму в стек панели: видна только вершина стека. Повторный push
     * той же записи поднимает её наверх (без дублей).
     * @param {string} workspaceId - Id рабочего места.
     * @param {string} paneId - Id панели.
     * @param {string} entryId - Id записи реестра открытых форм.
     * ***************************************************************************
     */
    static pushForm(workspaceId: string, paneId: string, entryId: string): void {
        const workspace = this._workspaces.get(workspaceId);
        if (!workspace) {
            Logger.warn(`[app][layout]: Рабочее место "${workspaceId}" не открыто — форма "${entryId}" не встала в стек.`);
            return;
        }
        this._ensureWatch();

        const pane = workspace.panes.get(paneId) ?? { id: paneId, container: null, stack: [] };
        pane.stack = pane.stack.filter((id) => id !== entryId);
        pane.stack.push(entryId);
        workspace.panes.set(paneId, pane);

        this._syncPaneVisibility(workspaceId, paneId);
        this._emit("pane-form-pushed", { workspaceId, paneId, entryId });
    }

    /**
     * ***************************************************************************
     * Возвращает вершину стека панели.
     * @param {string} workspaceId - Id рабочего места.
     * @param {string} paneId - Id панели.
     * @returns {string | null} - Id записи вершины либо null.
     * ***************************************************************************
     */
    static topForm(workspaceId: string, paneId: string): string | null {
        const pane = this._workspaces.get(workspaceId)?.panes.get(paneId);
        return pane?.stack[pane.stack.length - 1] ?? null;
    }

    /**
     * ***************************************************************************
     * Возвращает стек панели (снизу вверх).
     * @param {string} workspaceId - Id рабочего места.
     * @param {string} paneId - Id панели.
     * @returns {string[]} - Копия стека (id записей реестра).
     * ***************************************************************************
     */
    static stackOf(workspaceId: string, paneId: string): string[] {
        return [...(this._workspaces.get(workspaceId)?.panes.get(paneId)?.stack ?? [])];
    }

    /**
     * ***************************************************************************
     * Является ли рабочее место активным.
     * @param {string} workspaceId - Id рабочего места.
     * @returns {boolean} - true, если место активно.
     * ***************************************************************************
     */
    static isActive(workspaceId: string): boolean {
        return this._activeId === workspaceId;
    }

    /**
     * ***************************************************************************
     * Возвращает состояние рабочего места.
     * @param {string} workspaceId - Id рабочего места.
     * @returns {WorkspaceState | undefined} - Состояние места либо undefined.
     * ***************************************************************************
     */
    static getWorkspace(workspaceId: string): WorkspaceState | undefined {
        return this._workspaces.get(workspaceId);
    }

    /**
     * ***************************************************************************
     * Подписывается на событие менеджера раскладок.
     * @param {LayoutManagerEvent} event - Имя события.
     * @param {LayoutManagerListener} listener - Наблюдатель.
     * @returns {() => void} - Функция отписки.
     * ***************************************************************************
     */
    static on(event: LayoutManagerEvent, listener: LayoutManagerListener): () => void {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(listener);

        return () => {
            const list = this._listeners[event];
            if (!list) return;
            this._listeners[event] = list.filter((item) => item !== listener);
            if (this._listeners[event]?.length === 0) delete this._listeners[event];
        };
    }

    /**
     * ***************************************************************************
     * Полный сброс менеджера (например, в тестах).
     * ***************************************************************************
     */
    static clear(): void {
        this._workspaces.clear();
        this._activeId = null;
        this._offUnregistered?.();
        this._offUnregistered = null;
    }

    // --- Private Methods ---

    /**
     * ***************************************************************************
     * Подписывается на закрытие форм в реестре (один раз на приложение):
     * закрытая форма сама уходит из стека панели, вершина показывается.
     * @private
     * ***************************************************************************
     */
    private static _ensureWatch(): void {
        if (this._offUnregistered) return;
        this._offUnregistered = FormsRegistry.on("unregistered", (entry) => this._handleUnregistered(entry));
    }

    /**
     * ***************************************************************************
     * Убирает закрытую форму из всех стеков, прячет её обёртку и показывает
     * новые вершины.
     * @private
     * @param {FormEntry} entry - Закрытая запись реестра.
     * ***************************************************************************
     */
    private static _handleUnregistered(entry: FormEntry): void {

        // Сходя со стека, форма прячет свою обёртку: дальше её показывает
        // только новая вершина панели
        if (entry.wrap) this._setElementVisibility(entry.wrap, false);

        this._workspaces.forEach((workspace, workspaceId) => {
            workspace.panes.forEach((pane, paneId) => {
                if (!pane.stack.includes(entry.id)) return;

                pane.stack = pane.stack.filter((id) => id !== entry.id);
                this._syncPaneVisibility(workspaceId, paneId);
                this._emit("pane-form-popped", { workspaceId, paneId, entryId: entry.id });
            });
        });
    }

    /**
     * ***************************************************************************
     * Показывает вершину стека панели и скрывает остальные формы стека.
     * @private
     * @param {string} workspaceId - Id рабочего места.
     * @param {string} paneId - Id панели.
     * ***************************************************************************
     */
    private static _syncPaneVisibility(workspaceId: string, paneId: string): void {
        const pane = this._workspaces.get(workspaceId)?.panes.get(paneId);
        if (!pane) return;

        const topId = this.topForm(workspaceId, paneId);
        pane.stack.forEach((entryId) => {
            const wrap = FormsRegistry.get(entryId)?.wrap;
            if (wrap) this._setElementVisibility(wrap, entryId === topId);
        });
    }

    /**
     * ***************************************************************************
     * Применяет видимость: контейнеры активного места видимы, остальных
     * скрыты; вершины стеков каждого места синхронизируются.
     * @private
     * ***************************************************************************
     */
    private static _applyVisibility(): void {
        this._workspaces.forEach((workspace, workspaceId) => {
            const visible = workspaceId === this._activeId;
            this._setContainersVisibility(workspace, visible);

            workspace.panes.forEach((_, paneId) => {
                this._syncPaneVisibility(workspaceId, paneId);
            });
        });
    }

    /**
     * ***************************************************************************
     * Переключает видимость контейнеров места (корень и панели).
     * @private
     * @param {WorkspaceState} workspace - Рабочее место.
     * @param {boolean} visible - Показать ли контейнеры.
     * ***************************************************************************
     */
    private static _setContainersVisibility(workspace: WorkspaceState, visible: boolean): void {
        if (workspace.container) this._setElementVisibility(workspace.container, visible);
        workspace.panes.forEach((pane) => {
            if (pane.container) this._setElementVisibility(pane.container, visible);
        });
    }

    /**
     * ***************************************************************************
     * Переключает видимость элемента (как переключение табов: скрытый
     * элемент сохраняет размеры, скролл и медиа — display:none их теряет).
     * @private
     * @param {HTMLElement} element - Элемент.
     * @param {boolean} visible - Показать ли элемент.
     * ***************************************************************************
     */
    private static _setElementVisibility(element: HTMLElement, visible: boolean): void {
        element.style.visibility = visible ? "" : "hidden";
        element.style.opacity = visible ? "" : "0";
        element.style.pointerEvents = visible ? "" : "none";

        // Явный признак для CSS: раскладки (сплит и т.п.) реагируют на него,
        // а не на наполненность контейнера (скрытая форма в нём остаётся)
        element.classList.toggle("is-hidden", !visible);
    }

    /**
     * ***************************************************************************
     * Ставит атрибут раскладки на контейнере места (вид решает CSS).
     * @private
     * @param {WorkspaceState} workspace - Рабочее место.
     * ***************************************************************************
     */
    private static _applyLayoutAttribute(workspace: WorkspaceState): void {
        if (workspace.container) workspace.container.dataset.layout = workspace.layout;
    }

    /**
     * ***************************************************************************
     * Рассылает событие наблюдателям.
     * @private
     * @param {LayoutManagerEvent} event - Имя события.
     * @param {LayoutEventPayload} payload - Нагрузка события.
     * ***************************************************************************
     */
    private static _emit(event: LayoutManagerEvent, payload: LayoutEventPayload): void {
        const list = this._listeners[event];
        if (!list) return;
        list.forEach((listener) => {
            try {
                listener(payload);
            } catch (error) {
                Logger.error(error);
            }
        });
    }

}
