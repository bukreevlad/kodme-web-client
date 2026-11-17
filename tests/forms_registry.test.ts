// Импортируем bun test
import { beforeEach, describe, expect, mock, test } from "bun:test";

// Импортируем managers
import { FormsRegistry } from "../js/core/managers/forms_registry.js";

// Импортируем типы
import type { FormEntry } from "../js/core/managers/forms_registry.js";

/**
 * ***************************************************************************
 * Фейковый контейнер слоя: реестру нужен только признак смонтированности.
 * @param isConnected - Смонтирован ли слой в DOM.
 * @returns Объект-контейнер.
 * ***************************************************************************
 */
function createWrap(isConnected = true): HTMLElement {
    return { isConnected } as unknown as HTMLElement;
}

/**
 * ***************************************************************************
 * Создаёт запись реестра с фейковым контейнером.
 * @param id - Id записи.
 * @param extra - Дополнительные поля записи.
 * @returns Запись реестра.
 * ***************************************************************************
 */
function createEntry(id: string, extra: Partial<FormEntry> = {}): FormEntry {
    return {
        id,
        instance: { id },
        wrap: createWrap(),
        placement: "workspace",
        ...extra
    };
}

/**
 * ***************************************************************************
 * Тесты единого реестра открытых форм: порядок слоёв, дедуп по экземпляру,
 * поиск по роли/родителю/месту, подрезка несмонтированных слоёв, события.
 * ***************************************************************************
 */
describe("FormsRegistry", () => {

    beforeEach(() => {
        FormsRegistry.clear();
    });

    /**
     * ***************************************************************************
     * Порядок реестра = порядок слоёв, верхний — последний.
     * ***************************************************************************
     */
    test("register кладёт записи в порядке слоёв, верхний — последний", () => {
        const first = createEntry("a");
        const second = createEntry("b");

        FormsRegistry.register(first);
        FormsRegistry.register(second);

        expect(FormsRegistry.layers().map((entry) => entry.id)).toEqual(["a", "b"]);
        expect(FormsRegistry.isTop("b")).toBe(true);
        expect(FormsRegistry.isTop("a")).toBe(false);
    });

    /**
     * ***************************************************************************
     * Перерегистрация слоя не плодит дубли и не сбрасывает оболочку
     * (роль/заголовки пиуль задаёт update/addTab).
     * ***************************************************************************
     */
    test("перерегистрация слоя обновляет служебные поля и сохраняет оболочку", () => {
        const overlay = { id: "overlay" };
        const wrap = createWrap();
        FormsRegistry.register(createEntry("a"));
        FormsRegistry.update("a", { title: "Трансляция", placement: "workspace", workspace: "a" });

        // Слой смонтировался: перерегистрация с тем же id
        FormsRegistry.register({ id: "a", instance: overlay, wrap, placement: "attached" });

        expect(FormsRegistry.layers().length).toBe(1);
        const entry = FormsRegistry.get("a");
        expect(entry?.instance).toBe(overlay);
        expect(entry?.wrap).toBe(wrap);
        expect(entry?.placement).toBe("workspace");
        expect(entry?.title).toBe("Трансляция");
    });

    /**
     * ***************************************************************************
     * Заглушка пиуль (создана до монтирования слоя) и слой с одним id
     * сливаются в одну запись — пилюля не снимается перерегистрацией.
     * ***************************************************************************
     */
    test("заглушка и слой с одним id сливаются в одну запись", () => {
        // addTab до монтирования слоя: запись с ролью и заголовком пиуль
        FormsRegistry.register({ id: "ws", instance: {}, wrap: null, placement: "workspace", workspace: "ws", title: "Трансляция" });

        // Слой смонтировался и регистрируется с тем же id
        const overlay = {};
        const wrap = createWrap();
        FormsRegistry.register({ id: "ws", instance: overlay, wrap, placement: "attached" });

        expect(FormsRegistry.layers().length).toBe(1);
        const entry = FormsRegistry.get("ws");
        expect(entry?.placement).toBe("workspace");
        expect(entry?.title).toBe("Трансляция");
        expect(entry?.wrap).toBe(wrap);
    });

    /**
     * ***************************************************************************
     * Снятие слоя — по id и по экземпляру.
     * ***************************************************************************
     */
    test("unregister снимает запись по id и по экземпляру", () => {
        const first = createEntry("a");
        const second = createEntry("b");
        FormsRegistry.register(first);
        FormsRegistry.register(second);

        FormsRegistry.unregister("a");
        expect(FormsRegistry.get("a")).toBeUndefined();

        FormsRegistry.unregister(second.instance);
        expect(FormsRegistry.getByInstance(second.instance)).toBeUndefined();
        expect(FormsRegistry.layers().length).toBe(0);
    });

    /**
     * ***************************************************************************
     * Подъём слоя наверх и no-op для отсутствующего.
     * ***************************************************************************
     */
    test("raise поднимает существующий слой, отсутствующий игнорирует", () => {
        const first = createEntry("a");
        const second = createEntry("b");
        FormsRegistry.register(first);
        FormsRegistry.register(second);

        FormsRegistry.raise(first.instance);
        expect(FormsRegistry.isTop(first.instance)).toBe(true);

        FormsRegistry.raise("missing");
        expect(FormsRegistry.layers().length).toBe(2);
    });

    /**
     * ***************************************************************************
     * Запись находится по контенту слоя — так вложенная форма находит родителя.
     * ***************************************************************************
     */
    test("getByContent находит запись по контенту слоя", () => {
        const content = createWrap();
        FormsRegistry.register({ id: "parent", instance: {}, wrap: createWrap(), content, placement: "workspace" });

        expect(FormsRegistry.getByContent(content)?.id).toBe("parent");
        expect(FormsRegistry.getByContent(createWrap())).toBeUndefined();
        expect(FormsRegistry.getByContent(null)).toBeUndefined();
    });

    /**
     * ***************************************************************************
     * Владелец записи доступен как форма, closeLayer закрывает слой.
     * ***************************************************************************
     */
    test("getOwner возвращает форму-владельца, closeLayer закрывает слой", () => {
        const close = mock(() => {});
        FormsRegistry.register({
            id: "ws",
            instance: { close },
            owner: { name: "форма" },
            wrap: createWrap(),
            placement: "workspace"
        });

        expect(FormsRegistry.getOwner<{ name: string }>("ws")?.name).toBe("форма");
        expect(FormsRegistry.getOwner("missing")).toBeUndefined();

        FormsRegistry.closeLayer("ws");
        expect(close).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Поиск по роли, родителю и рабочему месту.
     * ***************************************************************************
     */
    test("find и children находят записи по роли, родителю и месту", () => {
        FormsRegistry.register(createEntry("ws", { placement: "workspace", workspace: "ws" }));
        FormsRegistry.register(createEntry("chat", { placement: "pane", parent: "ws", workspace: "ws" }));
        FormsRegistry.register(createEntry("profile", { placement: "stack", parent: "chat" }));
        FormsRegistry.register(createEntry("dialog", { placement: "dialog" }));

        expect(FormsRegistry.find({ placement: "pane" }).map((entry) => entry.id)).toEqual(["chat"]);
        expect(FormsRegistry.find({ workspace: "ws" }).map((entry) => entry.id)).toEqual(["ws", "chat"]);
        expect(FormsRegistry.children("ws").map((entry) => entry.id)).toEqual(["chat"]);
        expect(FormsRegistry.children("chat").map((entry) => entry.id)).toEqual(["profile"]);
    });

    /**
     * ***************************************************************************
     * Несмонтированные слои подрезаются: верхним становится живой.
     * Записи без wrap (ещё не смонтированный слой) не вырезаются.
     * ***************************************************************************
     */
    test("top подрезает несмонтированные слои, но не записи без wrap", () => {
        const alive = createEntry("a");
        const dead = createEntry("b", { wrap: createWrap(false) });
        FormsRegistry.register({ id: "pending", instance: {}, wrap: null, placement: "workspace" });
        FormsRegistry.register(alive);
        FormsRegistry.register(dead);

        expect(FormsRegistry.top()?.id).toBe("a");
        expect(FormsRegistry.isTop(dead)).toBe(false);
        expect(FormsRegistry.get("pending")).toBeDefined();

        // Запись без wrap не считается слоем: ей рано ловить Escape
        FormsRegistry.unregister("a");
        FormsRegistry.unregister("b");
        expect(FormsRegistry.top()).toBeNull();
    });

    /**
     * ***************************************************************************
     * События реестра и отписка от них.
     * ***************************************************************************
     */
    test("события registered/unregistered/raised приходят с записью", () => {
        const entry = createEntry("a");
        const registered = mock((_: FormEntry) => {});
        const unregistered = mock((_: FormEntry) => {});
        const raised = mock((_: FormEntry) => {});
        const offRegistered = FormsRegistry.on("registered", registered);
        const offUnregistered = FormsRegistry.on("unregistered", unregistered);
        const offRaised = FormsRegistry.on("raised", raised);

        FormsRegistry.register(entry);
        FormsRegistry.register(entry);   // повторная регистрация — это raise
        offRaised();
        FormsRegistry.raise(entry.instance);
        FormsRegistry.unregister(entry.instance);

        expect(registered).toHaveBeenCalledTimes(1);
        expect(raised).toHaveBeenCalledTimes(1);
        expect(unregistered).toHaveBeenCalledTimes(1);
        expect(unregistered).toHaveBeenCalledWith(entry);

        // Отписки — чтобы подписки не пережили тест
        offRegistered();
        offUnregistered();
    });

});
