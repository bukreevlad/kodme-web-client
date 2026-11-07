// Импортируем bun test
import { describe, expect, test, beforeEach } from "bun:test";

// Импортируем functions
import { getGrantedPermissions, grantPermission, isAppPermission } from "../js/forms/bot-app/functions/permissions.js";

// Хранилище в памяти: тестовое окружение Bun не даёт window/localStorage
const memory = new Map<string, string>();
const storage = {
    getItem: (key: string): string | null => memory.get(key) ?? null,
    setItem: (key: string, value: string): void => { memory.set(key, value); },
    removeItem: (key: string): void => { memory.delete(key); }
};

// invariant: другие тесты не используют window — подмена глобала безопасна
Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
    writable: true
});

// Очистка хранилища между тестами
beforeEach(() => {
    memory.clear();
});

/**
 * ***************************************************************************
 * Тесты хранилища разрешений WebApp-приложений (форма bot-app).
 * ***************************************************************************
 */
describe("bot-app permissions", () => {

    /**
     * ***************************************************************************
     * Распознавание типов доступа.
     * ***************************************************************************
     */
    test("isAppPermission принимает только известные типы доступа", () => {
        expect(isAppPermission("camera")).toBe(true);
        expect(isAppPermission("clipboard-write")).toBe(true);
        expect(isAppPermission("screen-recording")).toBe(false);
        expect(isAppPermission(42)).toBe(false);
        expect(isAppPermission(undefined)).toBe(false);
    });

    /**
     * ***************************************************************************
     * Выданное разрешение читается обратно для конкретного приложения.
     * ***************************************************************************
     */
    test("grantPermission / getGrantedPermissions: выданное читается обратно", () => {
        grantPermission("app-1", "camera");
        expect(getGrantedPermissions("app-1")).toEqual(["camera"]);
        expect(getGrantedPermissions("app-2")).toEqual([]);
    });

    /**
     * ***************************************************************************
     * Повторное выдачение не дублирует токен в списке.
     * ***************************************************************************
     */
    test("повторное выдачение не дублирует разрешение", () => {
        grantPermission("app-1", "camera");
        grantPermission("app-1", "camera");
        expect(getGrantedPermissions("app-1")).toEqual(["camera"]);
    });

    /**
     * ***************************************************************************
     * Разрешения разных приложений не смешиваются.
     * ***************************************************************************
     */
    test("разрешения приложений изолированы друг от друга", () => {
        grantPermission("app-1", "camera");
        grantPermission("app-2", "microphone");
        expect(getGrantedPermissions("app-1")).toEqual(["camera"]);
        expect(getGrantedPermissions("app-2")).toEqual(["microphone"]);
    });

    /**
     * ***************************************************************************
     * Повреждённые данные хранилища не роняют чтение.
     * ***************************************************************************
     */
    test("повреждённое хранилище — пустой список", () => {
        memory.set("bot_app_permissions", "{не json");
        expect(getGrantedPermissions("app-1")).toEqual([]);
    });

    /**
     * ***************************************************************************
     * Чужие значения в сохранённом списке отфильтровываются.
     * ***************************************************************************
     */
    test("неизвестные значения в списке отбрасываются", () => {
        memory.set("bot_app_permissions", JSON.stringify({ "app-1": ["camera", "evil", 7] }));
        expect(getGrantedPermissions("app-1")).toEqual(["camera"]);
    });

});
