// Импортируем bun test
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Импортируем managers
import { FormsRegistry } from "../js/core/managers/forms_registry.js";
import { LayoutManager } from "../js/core/managers/layout_manager.js";

/**
 * ***************************************************************************
 * Фейковый контейнер/обёртка: менеджеру нужны только видимость и смонтированность.
 * @param isConnected - Смонтирован ли элемент в DOM.
 * @returns Объект-элемент.
 * ***************************************************************************
 */
function createElement(isConnected = true): HTMLElement {
    return { isConnected, style: { visibility: "", opacity: "", pointerEvents: "" }, dataset: {}, classList: { toggle: () => {} } } as unknown as HTMLElement;
}

/**
 * ***************************************************************************
 * Регистрирует запись в реестре открытых форм с фейковой обёрткой.
 * @param id - Id записи.
 * @returns Обёртка записи (для проверок видимости).
 * ***************************************************************************
 */
function registerEntry(id: string): HTMLElement {
    const wrap = createElement();
    FormsRegistry.register({ id, instance: { id }, wrap, placement: "stack" });
    return wrap;
}

/**
 * ***************************************************************************
 * Тесты менеджера раскладок: рабочие места, видимость контейнерами,
 * стеки панелей (вершина видна, закрытие вершины показывает предыдущую),
 * раскладки и события.
 * ***************************************************************************
 */
describe("LayoutManager", () => {

    beforeEach(() => {
        LayoutManager.clear();
        FormsRegistry.clear();
    });

    /**
     * ***************************************************************************
     * Открытие места: создание, активация, атрибут раскладки.
     * ***************************************************************************
     */
    test("openWorkspace создаёт место, активирует его и ставит атрибут раскладки", () => {
        const container = createElement();
        const opened = mock((_: unknown) => {});
        LayoutManager.on("workspace-opened", opened);

        LayoutManager.openWorkspace("ws", { layout: "split-right", container });

        const workspace = LayoutManager.getWorkspace("ws");
        expect(workspace?.layout).toBe("split-right");
        expect(container.dataset.layout).toBe("split-right");
        expect(LayoutManager.isActive("ws")).toBe(true);
        expect(opened).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Активация места прячет контейнеры остальных мест.
     * ***************************************************************************
     */
    test("activate показывает контейнеры активного места и скрывает чужие", () => {
        const firstRoot = createElement();
        const firstPane = createElement();
        const secondRoot = createElement();
        LayoutManager.openWorkspace("first", { container: firstRoot });
        LayoutManager.setPane("first", "main", firstPane);
        LayoutManager.openWorkspace("second", { container: secondRoot });

        // Открытие second уже активировало его
        expect(firstRoot.style.visibility).toBe("hidden");
        expect(firstPane.style.visibility).toBe("hidden");
        expect(secondRoot.style.visibility).toBe("");

        LayoutManager.activate("first");

        expect(firstRoot.style.visibility).toBe("");
        expect(firstPane.style.visibility).toBe("");
        expect(secondRoot.style.visibility).toBe("hidden");
    });

    /**
     * ***************************************************************************
     * Стек панели: видна только вершина, повторный push поднимает без дублей.
     * ***************************************************************************
     */
    test("pushForm показывает вершину стека и скрывает предыдущие формы", () => {
        LayoutManager.openWorkspace("ws");
        const first = registerEntry("profile");
        const second = registerEntry("settings");

        LayoutManager.pushForm("ws", "main", "profile");
        expect(first.style.visibility).toBe("");

        LayoutManager.pushForm("ws", "main", "settings");
        expect(second.style.visibility).toBe("");
        expect(first.style.visibility).toBe("hidden");
        expect(LayoutManager.topForm("ws", "main")).toBe("settings");
        expect(LayoutManager.stackOf("ws", "main")).toEqual(["profile", "settings"]);

        // Повторный push той же записи — без дублей, наверх стека
        LayoutManager.pushForm("ws", "main", "profile");
        expect(LayoutManager.stackOf("ws", "main")).toEqual(["settings", "profile"]);
        expect(first.style.visibility).toBe("");
        expect(second.style.visibility).toBe("hidden");
    });

    /**
     * ***************************************************************************
     * Закрытие верхней формы само убирает её из стека и показывает предыдущую.
     * ***************************************************************************
     */
    test("закрытие формы убирает её из стека и показывает предыдущую", () => {
        LayoutManager.openWorkspace("ws");
        const first = registerEntry("profile");
        const second = registerEntry("settings");
        LayoutManager.pushForm("ws", "main", "profile");
        LayoutManager.pushForm("ws", "main", "settings");

        const popped = mock((_: unknown) => {});
        LayoutManager.on("pane-form-popped", popped);

        // Форма закрылась сама — реестр снимает запись, стек подчищается
        FormsRegistry.unregister("settings");

        expect(LayoutManager.stackOf("ws", "main")).toEqual(["profile"]);
        expect(LayoutManager.topForm("ws", "main")).toBe("profile");
        expect(first.style.visibility).toBe("");
        expect(second.style.visibility).toBe("hidden");
        expect(popped).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Смена раскладки обновляет атрибут контейнера.
     * ***************************************************************************
     */
    test("setLayout меняет атрибут раскладки контейнера", () => {
        const container = createElement();
        LayoutManager.openWorkspace("ws", { container });

        LayoutManager.setLayout("ws", "split-right");

        expect(LayoutManager.getWorkspace("ws")?.layout).toBe("split-right");
        expect(container.dataset.layout).toBe("split-right");
    });

    /**
     * ***************************************************************************
     * Панели одного места независимы (каждая ведёт свой стек).
     * ***************************************************************************
     */
    test("панели одного места ведут независимые стеки", () => {
        LayoutManager.openWorkspace("ws");
        const chat = registerEntry("chat");
        const video = registerEntry("video");

        LayoutManager.pushForm("ws", "main", "video");
        LayoutManager.pushForm("ws", "side", "chat");

        expect(video.style.visibility).toBe("");
        expect(chat.style.visibility).toBe("");
        expect(LayoutManager.topForm("ws", "main")).toBe("video");
        expect(LayoutManager.topForm("ws", "side")).toBe("chat");
    });

    /**
     * ***************************************************************************
     * Закрытие активного места активирует последнее из оставшихся.
     * ***************************************************************************
     */
    test("closeWorkspace активирует последнее оставшееся место", () => {
        const firstRoot = createElement();
        const secondRoot = createElement();
        LayoutManager.openWorkspace("first", { container: firstRoot });
        LayoutManager.openWorkspace("second", { container: secondRoot });

        const closed = mock((_: unknown) => {});
        LayoutManager.on("workspace-closed", closed);
        LayoutManager.closeWorkspace("second");

        expect(LayoutManager.getWorkspace("second")).toBeUndefined();
        expect(LayoutManager.isActive("first")).toBe(true);
        expect(firstRoot.style.visibility).toBe("");
        expect(closed).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Повторное открытие места обновляет настройки, но активность не трогает.
     * ***************************************************************************
     */
    test("повторное openWorkspace обновляет место без переключения активности", () => {
        const container = createElement();
        LayoutManager.openWorkspace("first");
        LayoutManager.openWorkspace("second");

        LayoutManager.openWorkspace("first", { layout: "split-right", container });

        expect(LayoutManager.isActive("second")).toBe(true);
        expect(LayoutManager.getWorkspace("first")?.layout).toBe("split-right");
        expect(container.dataset.layout).toBe("split-right");
        expect(container.style.visibility).toBe("hidden");
    });

});
