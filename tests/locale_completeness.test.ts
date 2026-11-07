// Импортируем bun test
import { describe, expect, test } from "bun:test";

// Импортируем локали
import ru from "../locales/ru.json";
import en from "../locales/en.json";

/**
 * Собирает плоскую карту «путь → тип леса»: строки и массивы — листья,
 * объекты — ветви (массивы не разворачиваются — они сравниваются целиком).
 * @param node - Узел дерева локали.
 * @param prefix - Накопленный путь.
 * @param into - Карта результата.
 * @returns void
 */
function collect(node: unknown, prefix: string, into: Map<string, string>): void {

    if (node !== null && typeof node === "object" && !Array.isArray(node)) {
        for (const [key, value] of Object.entries(node)) {
            collect(value, prefix ? `${prefix}.${key}` : key, into);
        }
        return;
    }

    into.set(prefix, Array.isArray(node) ? "array" : typeof node);

}

/**
 * ***************************************************************************
 * Полнота локалей: en обязан содержать все ключи ru и наоборот, а типы
 * значений (строка/массив) — совпадать. Ловит незамеченный ключ при
 * добавлении строки только в одну локаль.
 * ***************************************************************************
 */
describe("полнота локалей", () => {

    test("ru и en эквивалентны по составу ключей и типов", () => {
        const ruMap = new Map<string, string>();
        const enMap = new Map<string, string>();
        collect(ru, "", ruMap);
        collect(en, "", enMap);

        const missing = [...ruMap.keys()].filter((key) => !enMap.has(key));
        const extra = [...enMap.keys()].filter((key) => !ruMap.has(key));
        const mismatch = [...ruMap.entries()]
            .filter(([key, type]) => enMap.has(key) && enMap.get(key) !== type)
            .map(([key, type]) => `${key}: ru=${type} en=${enMap.get(key)}`);

        expect(missing).toEqual([]);
        expect(extra).toEqual([]);
        expect(mismatch).toEqual([]);
    });

});
