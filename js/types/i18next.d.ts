// ***************************************************************************
// Типизация i18next: пути ключей t("...") сверяются со структурой
// locales/ru.json — опечатка в ключе становится ошибкой компиляции.
// ***************************************************************************

// Импортируем типы
import type ruLocale from "../../locales/ru.json";

declare module "i18next" {
    /** Ресурсы перевода: namespace translation — дерево locales/<язык>.json. */
    interface CustomTypeOptions {
        resources: {
            translation: typeof ruLocale;
        };
        /** Пустая строка перевода считается отсутствующим ключом. */
        returnEmptyString: false;
    }
}
