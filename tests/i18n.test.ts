// Импортируем bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

// Импортируем utils
import { I18n, t } from "../js/utils/i18n/index.js";

// Импортируем locales
import ru from "../locales/ru.json";

/**
 * ***************************************************************************
 * Тесты сервиса локализации: инициализация, перевод по ключу, смена языка
 * в реальном времени с событием и сохранением выбора. В bun нет
 * window/localStorage — заглушки создаются через defineProperty.
 * ***************************************************************************
 */
describe("сервис локализации I18n", () => {

    beforeAll(async () => {
        await I18n.init();
    });

    afterAll(() => {
        // Убираем заглушки окружения из глобальной области
        Reflect.deleteProperty(globalThis, "window");
        Reflect.deleteProperty(globalThis, "localStorage");
    });

    test("init: язык по умолчанию ru, дерево строк на месте", () => {
        expect(I18n.language).toBe("ru");
        expect(I18n.tree.locale).toBe("ru-RU");
        expect(I18n.tree.locale).toBe(ru.locale);
    });

    test("t: перевод по ключу возвращает строку локали", () => {
        expect(t("api.errors.server_error")).toBe("Ошибка сервера. Попробуйте позже");
        expect(t("api.errors.server_error")).toBe(ru.api.errors.server_error);
    });

    test("t: плуралы по count подбирают форму слова", () => {
        expect(t("utils.duration_formatter.days", { count: 1 })).toBe("день");
        expect(t("utils.duration_formatter.days", { count: 3 })).toBe("дня");
        expect(t("utils.duration_formatter.days", { count: 5 })).toBe("дней");

        expect(t("forms.comments.dec_files", { count: 1 })).toBe("вложение");
        expect(t("forms.comments.dec_files", { count: 2 })).toBe("вложения");
        expect(t("forms.comments.dec_files", { count: 5 })).toBe("вложений");
    });

    test("t: интерполяция {{name}}/{{size}} подставляет параметры", () => {
        expect(t("forms.messages.toasts.file_too_large", { name: "a.png", size: "10 МБ" }))
            .toBe("Файл a.png больше 10 МБ");
    });

    test("t: подстановки registration/call подставляют все параметры", () => {
        expect(t("forms.registration.step", { current: 1, total: 3 })).toBe("Шаг 1 из 3");
        expect(t("forms.call.toasts.busy_incoming", { name: "Иван" }))
            .toBe("Иван пытается вам позвонить, но вы уже разговариваете");
        expect(t("forms.bot_app.permission.desc", { app: "Мой бот", permission: "камеру" }))
            .toBe("Приложение «Мой бот» запрашивает доступ к камеру.");
    });

    test("changeLanguage: смена языка, сохранение выбора и событие", async () => {
        // Заглушки: в bun нет ни window, ни localStorage
        const stored = new Map<string, string>();
        const events: string[] = [];

        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            value: {
                getItem: (key: string) => stored.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    stored.set(key, value);
                }
            }
        });
        Object.defineProperty(globalThis, "window", {
            configurable: true,
            value: {
                dispatchEvent: (event: { type: string }) => {
                    events.push(event.type);
                    return true;
                }
            }
        });

        // Настоящая локаль en подключается ленивым import() из чанка
        await I18n.changeLanguage("en");
        expect(I18n.language).toBe("en");
        expect(stored.get("kodme_lang")).toBe("en");
        expect(events).toContain("[app][locale]::changed");

        // Неподключённый язык игнорируется
        await I18n.changeLanguage("de");
        expect(I18n.language).toBe("en");

        // Повторная смена на русский сохраняет выбор и снова шлёт событие
        await I18n.changeLanguage("ru");
        expect(I18n.language).toBe("ru");
        expect(stored.get("kodme_lang")).toBe("ru");
        expect(events.filter((type) => type === "[app][locale]::changed")).toHaveLength(2);
    });

    test("changeLanguage: ленивая загрузка en даёт английские тексты и плуралы", async () => {
        await I18n.changeLanguage("en");
        expect(I18n.language).toBe("en");
        expect(I18n.tree.locale).toBe("en-US");
        expect(I18n.tree.locale_name).toBe("English");
        expect(t("api.errors.server_error")).toBe("Server error. Try again later");

        // Плуралы en по CLDR: одна форма на единственное, вторая — на множественное
        expect(t("utils.duration_formatter.days", { count: 1 })).toBe("day");
        expect(t("utils.duration_formatter.days", { count: 5 })).toBe("days");
        expect(t("forms.comments.dec_files", { count: 2 })).toBe("attachments");

        // Возврат на русский — ru предзагружен в основном бандле
        await I18n.changeLanguage("ru");
        expect(t("api.errors.server_error")).toBe("Ошибка сервера. Попробуйте позже");
    });

    test("languages: список языков с самоназваниями для переключателя", async () => {
        const languages = await I18n.languages();
        expect(languages).toEqual([
            { code: "ru", name: "Русский" },
            { code: "en", name: "English" }
        ]);
    });

    test("старт со сохранённым en не падает до инициализации i18next (регресс)", async () => {
        // Регресс: registerLanguage звал i18next.addResourceBundle до init(),
        // а i18next назначает цепочный метод внутри init — старт со стартовым
        // языком en ронял load-хендлер («addResourceBundle is not a function»,
        // страница не открывалась). Свежая копия сервиса повторяет сценарий
        // браузера: ensureLanguage до i18next.init
        const stored = new Map<string, string>([["kodme_lang", "en"]]);
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            value: {
                getItem: (key: string) => stored.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    stored.set(key, value);
                }
            }
        });

        // Путь с query — только чтобы получить свежую копию модуля в этом
        // процессе; тип берём у обычного specifier, tsc query не резолвит
        const freshPath = "../js/utils/i18n/index.ts?fresh=1";
        const fresh: typeof import("../js/utils/i18n/index.js") = await import(freshPath);
        await fresh.I18n.init();

        expect(fresh.I18n.language).toBe("en");
        expect(fresh.I18n.tree.locale).toBe("en-US");
        expect(fresh.t("api.errors.server_error")).toBe("Server error. Try again later");
    });

    test("холодный старт со en в чистом процессе не падает (регресс)", async () => {
        // Ветка «registerLanguage до i18next.init» воспроизводится только
        // в чистом процессе: здесь i18next уже инициализирован предыдущими
        // тестами. Ровно этот сценарий ронял страницу в браузере
        const script = `
            Object.defineProperty(globalThis, "localStorage", {
                value: { getItem: (key) => key === "kodme_lang" ? "en" : null, setItem: () => {} }
            });
            const { I18n, t } = await import("./js/utils/i18n/index.ts");
            await I18n.init();
            console.log("COLD_START_OK", I18n.language, t("api.errors.server_error"));
        `;

        const proc = Bun.spawn({
            cmd: [process.execPath, "-e", script],
            cwd: import.meta.dir + "/..",
            stdout: "pipe",
            stderr: "pipe"
        });

        const [exitCode, stdout] = await Promise.all([
            proc.exited,
            new Response(proc.stdout).text()
        ]);

        expect(exitCode).toBe(0);
        expect(stdout).toContain("COLD_START_OK en Server error. Try again later");
    });

});
