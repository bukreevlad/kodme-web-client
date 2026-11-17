// Импортируем bun test
import { describe, expect, mock, test } from "bun:test";

// Импортируем utils
import { Store } from "../js/utils/store.js";

/**
 * ***************************************************************************
 * Фейковая DOM-копия строки: без DOM в тестах достаточно метода remove(),
 * который стор вызывает при снятии копии.
 * @returns Объект с элементом и моком remove для проверок.
 * ***************************************************************************
 */
function createFakeRow() {
    const remove = mock(() => {});
    const element = Object.assign(new EventTarget(), { remove }) as unknown as HTMLElement;
    return { element, remove };
}

/**
 * ***************************************************************************
 * Тесты реестра DOM-копий и подписок Store: стор снимает только свои копии,
 * даже когда запись общая для нескольких сторов.
 * ***************************************************************************
 */
describe("реестр DOM-копий Store", () => {

    /**
     * ***************************************************************************
     * Регистрация и чтение копий.
     * ***************************************************************************
     */
    test("registerDomElement накапливает копии, getDomElements возвращает их", () => {
        const store = new Store();
        const first = createFakeRow();
        const second = createFakeRow();

        store.registerDomElement("a", first.element);
        store.registerDomElement("a", second.element);

        expect(store.getDomElements("a")).toEqual([first.element, second.element]);
        expect(store.getDomElements("missing")).toEqual([]);
    });

    /**
     * ***************************************************************************
     * Удаление элемента снимает его копии и закрывает подписки.
     * ***************************************************************************
     */
    test("remove снимает DOM-копии и вызывает подписки строки", () => {
        const store = new Store();
        store.add({ id: "a" });
        const row = createFakeRow();
        store.registerDomElement("a", row.element);
        const unsubscribe = mock(() => {});
        store.addItemSubscription("a", unsubscribe);
        const removed = mock(() => {});
        store.on("item::removed", removed);

        store.remove("a");

        expect(removed).toHaveBeenCalledTimes(1);
        expect(row.remove).toHaveBeenCalledTimes(1);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(store.getDomElements("a")).toEqual([]);
    });

    /**
     * ***************************************************************************
     * Очистка стора снимает копии всех элементов.
     * ***************************************************************************
     */
    test("removeAll снимает DOM-копии всех элементов", () => {
        const store = new Store();
        store.add({ id: "a" });
        store.add({ id: "b" });
        const first = createFakeRow();
        const second = createFakeRow();
        store.registerDomElement("a", first.element);
        store.registerDomElement("b", second.element);

        store.removeAll();

        expect(first.remove).toHaveBeenCalledTimes(1);
        expect(second.remove).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Тихое удаление DOM не трогает: список перерисовывает сама форма.
     * ***************************************************************************
     */
    test("removeAll({ silent: true }) не снимает DOM-копии", () => {
        const store = new Store();
        store.add({ id: "a" });
        const row = createFakeRow();
        store.registerDomElement("a", row.element);

        store.removeAll({ silent: true });

        expect(row.remove).not.toHaveBeenCalled();
    });

    /**
     * ***************************************************************************
     * Ключевой сценарий: запись живёт в двух сторах, закрытие одного стора
     * не снимает DOM-копии другого.
     * ***************************************************************************
     */
    test("два стора с общей записью снимают только свои копии", () => {
        const shared = { id: "group-1" };
        const mainStore = new Store();
        const formStore = new Store();
        mainStore.add(shared);
        formStore.add(shared);

        const mainRow = createFakeRow();
        const formRow = createFakeRow();
        mainStore.registerDomElement(shared.id, mainRow.element);
        formStore.registerDomElement(shared.id, formRow.element);

        formStore.removeAll();

        expect(formRow.remove).toHaveBeenCalledTimes(1);
        expect(mainRow.remove).not.toHaveBeenCalled();
        expect(mainStore.getDomElements(shared.id)).toEqual([mainRow.element]);
    });

    /**
     * ***************************************************************************
     * Снятие одной копии (например, перенос канала в другую папку).
     * ***************************************************************************
     */
    test("removeDomElement снимает только одну копию строки", () => {
        const store = new Store();
        const first = createFakeRow();
        const second = createFakeRow();
        store.registerDomElement("a", first.element);
        store.registerDomElement("a", second.element);

        store.removeDomElement("a", first.element);

        expect(first.remove).toHaveBeenCalledTimes(1);
        expect(second.remove).not.toHaveBeenCalled();
        expect(store.getDomElements("a")).toEqual([second.element]);
    });

    /**
     * ***************************************************************************
     * Замена id переносит копии и подписки на новый id.
     * ***************************************************************************
     */
    test("replaceId переносит DOM-копии и подписки на новый id", () => {
        const store = new Store();
        store.add({ id: "temp" });
        const row = createFakeRow();
        store.registerDomElement("temp", row.element);
        const unsubscribe = mock(() => {});
        store.addItemSubscription("temp", unsubscribe);

        store.replaceId("temp", "server-id");

        expect(store.getDomElements("temp")).toEqual([]);
        expect(store.getDomElements("server-id")).toEqual([row.element]);

        store.remove("server-id");

        expect(row.remove).toHaveBeenCalledTimes(1);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    /**
     * ***************************************************************************
     * Подписки накапливаются по числу строк и закрываются все разом.
     * ***************************************************************************
     */
    test("addItemSubscription хранит подписки всех строк элемента", () => {
        const store = new Store();
        store.add({ id: "a" });
        const first = mock(() => {});
        const second = mock(() => {});
        store.addItemSubscription("a", first);
        store.addItemSubscription("a", second);

        store.remove("a");

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

});
