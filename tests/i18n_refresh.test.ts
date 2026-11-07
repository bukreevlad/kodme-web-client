// Импортируем bun test
import { describe, expect, test } from "bun:test";

// Импортируем чистые функции сопоставления
import { applyTranslation, buildLanguageIndex, matchTranslation } from "../js/utils/i18n/language_index.js";

// Импортируем локали
import ru from "../locales/ru.json";
import en from "../locales/en.json";

/**
 * ***************************************************************************
 * Тесты живого обновления текста при смене языка: строка на языке A →
 * ключ → перевод на B. Чистые функции, DOM не нужен.
 * ***************************************************************************
 */
describe("сопоставление строк локалей (живое обновление)", () => {

    const ruIndex = buildLanguageIndex(ru);
    const enIndex = buildLanguageIndex(en);

    /**
     * Сопоставляет текст индексом языка A и переводит на язык B.
     * @param index - Индекс языка, на котором написан текст.
     * @param text - Текст.
     * @param language - Код языка назначения.
     * @param tree - Дерево языка назначения.
     * @returns Перевод либо null.
     */
    const swap = (
        index: ReturnType<typeof buildLanguageIndex>,
        text: string,
        language: string,
        tree: typeof ru | typeof en
    ): string | null => {
        const match = matchTranslation(index, text);
        return match ? applyTranslation(language, tree, match) : null;
    };

    test("точное совпадение: ru → en и обратно", () => {
        expect(swap(ruIndex, "Ничего не найдено", "en", en)).toBe("Nothing found");
        expect(swap(enIndex, "Nothing found", "ru", ru)).toBe("Ничего не найдено");
    });

    test("параметрический шаблон: email и шаги", () => {
        expect(swap(ruIndex, "Код подтверждения отправлен на ivan@mail.ru", "en", en))
            .toBe("Confirmation code sent to ivan@mail.ru");
        expect(swap(ruIndex, "Шаг 2 из 3", "en", en)).toBe("Step 2 of 3");
        expect(swap(enIndex, "Step 2 of 3", "ru", ru)).toBe("Шаг 2 из 3");
    });

    test("число и множественная форма: слово по CLDR, число на месте", () => {
        expect(swap(ruIndex, "5 файлов", "en", en)).toBe("5 files");
        // Категория языка назначения: у en одна форма на единственное/множественное
        expect(swap(ruIndex, "1 день", "en", en)).toBe("1 day");
        expect(swap(ruIndex, "3 дня", "en", en)).toBe("3 days");
        // Идентичная смена не должна ломать текст
        expect(swap(ruIndex, "5 файлов", "ru", ru)).toBe("5 файлов");
        // en → ru: 5 files → категория many → «файлов»
        expect(swap(enIndex, "5 files", "ru", ru)).toBe("5 файлов");
    });

    test("статические строки массивов локали тоже подхватываются", () => {
        expect(swap(ruIndex, "записывают голосовые...", "en", en))
            .toBe("are recording voice...");
    });

    test("не трогаем чужой текст: даты и произвольные строки", () => {
        expect(matchTranslation(ruIndex, "Был(а) 5 мин.")).toBeNull();
        expect(matchTranslation(ruIndex, "Привет, мир")).toBeNull();
        expect(matchTranslation(ruIndex, "")).toBeNull();
        expect(matchTranslation(ruIndex, "   ")).toBeNull();
    });

    test("отсутствующее значение целевого языка — текст остаётся", () => {
        const broken = { forms: { only_ru: { title: "Только по-русски" } } };
        const index = buildLanguageIndex(broken);
        const match = matchTranslation(index, "Только по-русски");
        expect(match).not.toBeNull();
        if (match) expect(applyTranslation("en", { forms: {} }, match)).toBeNull();
    });

});
