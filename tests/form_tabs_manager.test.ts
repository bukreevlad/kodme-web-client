// Импортируем bun test
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

// Импортируем managers
import { FormsRegistry } from "../js/core/managers/forms_registry.js";
import { LayoutManager } from "../js/core/managers/layout_manager.js";
import { TabsManager } from "../js/core/managers/form_tabs_manager.js";

// Импортируем utils
import { IsMobile } from "../js/utils/helpers/is_mobile.js";

/** Фейковая пилюля: EventTarget + минимум DOM-поверхности пиуль. */
interface FakeTab {
    tab: HTMLElement;
    closeBtn: EventTarget;
    name: { textContent: string | null };
    subtitle: { textContent: string | null };
    toggle: ReturnType<typeof mock>;
    remove: ReturnType<typeof mock>;
}

// Исходные глобалы: тесты подменяют window и requestAnimationFrame
const originalWindow = globalThis.window;
const originalRaf = globalThis.requestAnimationFrame;

/** Текущая фейковая пилюля (её выдаёт переопределённая фабрика). */
let currentTab: FakeTab;

/**
 * ***************************************************************************
 * Создаёт фейковую пилюлю для переопределённой фабрики TabsManager.
 * @returns Фейковая пилюля с моками DOM-частей.
 * ***************************************************************************
 */
function createFakeTab(): FakeTab {
    const closeBtn = new EventTarget();
    const name = { textContent: null as string | null };
    const subtitle = { textContent: null as string | null };
    const toggle = mock(() => {});
    const remove = mock(() => {});
    const tab = Object.assign(new EventTarget(), {
        dataset: {} as Record<string, string>,
        classList: { toggle },
        querySelector: (selector: string) => {
            if (selector === ".tab-close") return closeBtn;
            if (selector === ".tab-name") return name;
            if (selector === ".tab-subtitle") return subtitle;
            return null;
        },
        remove
    }) as unknown as HTMLElement;
    return { tab, closeBtn, name, subtitle, toggle, remove };
}

/**
 * ***************************************************************************
 * Регистрирует запись рабочего места в реестре открытых форм.
 * @param id - Id записи.
 * @param extra - Дополнительные поля записи.
 * @returns Экземпляр слоя (для проверок активации/закрытия).
 * ***************************************************************************
 */
function registerWorkspace(id: string, extra: Record<string, unknown> = {}): object {
    const instance = Object.assign(new EventTarget(), extra);
    const wrap = { isConnected: true, dataset: {}, style: { visibility: "", opacity: "", pointerEvents: "" }, classList: { toggle: () => {} } } as unknown as HTMLElement;
    FormsRegistry.register({ id, instance, wrap, placement: "workspace", workspace: id });
    return instance;
}

/**
 * ***************************************************************************
 * Тесты пульта пиуль: пилюли создаются/обновляются/удаляются по записям
 * реестра, клик активирует форму, крестик закрывает, смена роли убирает
 * пикулю без закрытия формы.
 * ***************************************************************************
 */
describe("TabsManager (пульт пиуль)", () => {

    beforeAll(() => {

        // Тестовое окружение без DOM: window с десктопным UA (IsMobile.get
        // читает navigator), rAF не исполняет колбэк (косметика пиуль в
        // тестах не нужна)
        globalThis.window = Object.assign(new EventTarget(), {
            navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }
        }) as unknown as Window & typeof globalThis;
        globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;

    });

    afterAll(() => {
        globalThis.window = originalWindow;
        globalThis.requestAnimationFrame = originalRaf;
    });

    beforeEach(() => {
        FormsRegistry.clear();
        LayoutManager.clear();
        TabsManager.tabs.clear();
        currentTab = createFakeTab();
        TabsManager.createTabElement = () => currentTab.tab;

        // Панель пиуль: фейк-контейнер с [data-list]
        const list = { append: mock(() => {}) };
        const container = { querySelector: () => list } as unknown as HTMLElement;
        TabsManager.init(container);
    });

    /**
     * ***************************************************************************
     * Запись рабочего места рисует пилюлю и открывает место.
     * ***************************************************************************
     */
    test("запись workspace создаёт пикулю и рабочее место", () => {
        registerWorkspace("chat");
        FormsRegistry.update("chat", { title: "Трансляция", subtitle: "Эфир" });

        expect(TabsManager.tabs.has("chat")).toBe(true);
        expect(LayoutManager.isActive("chat")).toBe(true);
        expect(currentTab.name.textContent).toBe("Трансляция");
        expect(currentTab.subtitle.textContent).toBe("Эфир");
        expect(currentTab.toggle).toHaveBeenCalledWith("active", true);
    });

    /**
     * ***************************************************************************
     * Обновление записи реестра обновляет пилюлю.
     * ***************************************************************************
     */
    test("обновление записи обновляет текст пилюли", () => {
        registerWorkspace("chat");
        FormsRegistry.update("chat", { title: "Старое имя" });

        FormsRegistry.update("chat", { title: "Новое имя" });

        expect(currentTab.name.textContent).toBe("Новое имя");
    });

    /**
     * ***************************************************************************
     * Снятие записи убирает пилюлю и закрывает рабочее место.
     * ***************************************************************************
     */
    test("снятие записи убирает пикулю и закрывает рабочее место", () => {
        registerWorkspace("chat");

        FormsRegistry.unregister("chat");

        expect(TabsManager.tabs.has("chat")).toBe(false);
        expect(currentTab.remove).toHaveBeenCalledTimes(1);
        expect(LayoutManager.getWorkspace("chat")).toBeUndefined();
    });

    /**
     * ***************************************************************************
     * Смена роли убирает пикулю и закрывает место, но форму не закрывает.
     * ***************************************************************************
     */
    test("смена роли убирает пикулю, не закрывая форму", () => {
        const close = mock(() => {});
        registerWorkspace("chat", { close });

        // Сворачивание формы: она остаётся открытой, но пикули не имеет
        FormsRegistry.update("chat", { placement: "attached", workspace: null });

        expect(TabsManager.tabs.has("chat")).toBe(false);
        expect(LayoutManager.getWorkspace("chat")).toBeUndefined();
        expect(close).not.toHaveBeenCalled();
    });

    /**
     * ***************************************************************************
     * Панель (например, чат трансляции) не закрывает рабочее место владельца.
     * ***************************************************************************
     */
    test("панель не закрывает чужое рабочее место", () => {
        registerWorkspace("broadcast-play:1");
        FormsRegistry.register({
            id: "messages:10",
            instance: {},
            wrap: currentTab.tab,
            placement: "pane",
            workspace: "broadcast-play:1"
        });

        // Пиули у панели нет, место владельца живо
        expect(TabsManager.tabs.size).toBe(1);
        expect(LayoutManager.getWorkspace("broadcast-play:1")).toBeDefined();

        // Смена роли панели тоже не трогает чужое место
        FormsRegistry.update("messages:10", { placement: "attached" });
        expect(LayoutManager.getWorkspace("broadcast-play:1")).toBeDefined();
    });

    /**
     * ***************************************************************************
     * Клик по пикуле выводит форму на передний план.
     * ***************************************************************************
     */
    test("клик по пикуле активирует форму", () => {
        const activate = mock(() => {});
        registerWorkspace("chat", { activate });

        currentTab.tab.dispatchEvent(new Event("click"));

        expect(activate).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Крестик закрывает форму.
     * ***************************************************************************
     */
    test("крестик закрывает форму", () => {
        const close = mock(() => {});
        registerWorkspace("chat", { close });

        currentTab.closeBtn.dispatchEvent(new Event("click"));

        expect(close).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * На мобильных пиуль и рабочих мест нет.
     * ***************************************************************************
     */
    test("мобильная версия: пилюли и места не создаются", () => {
        const isMobile = IsMobile.get;
        IsMobile.get = () => true;

        registerWorkspace("chat");

        IsMobile.get = isMobile;
        expect(TabsManager.tabs.size).toBe(0);
        expect(LayoutManager.getWorkspace("chat")).toBeUndefined();
    });

});
