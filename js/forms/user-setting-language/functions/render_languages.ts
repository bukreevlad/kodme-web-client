// Импортируем components
import { Toggle } from "../../../components/toggle.js";

// Импортируем utils
import { I18n } from "../../../utils/i18n/index.js";

// Импортируем типы
import type { UserSettingLanguage } from "../index.js";

/**
 * ***************************************************************************
 * renderLanguages - список доступных языков строками-карточками.
 *
 * Рендер штатным Toggle.cardGroup: отметка текущего языка рисуется
 * компонентом, значения едут в атрибутах radio. Лениво подключает ещё не
 * загруженные локали — при первом открытии подтягивается чанк en.
 * @param form - Экземпляр формы.
 * @returns Промис без значения.
 * ***************************************************************************
 */
export async function renderLanguages(form: UserSettingLanguage): Promise<void> {

    // Список входит в шаблон — без него рендерить нечего
    const list = form.tpl?.querySelector<HTMLElement>(":scope >.content [data-language-list]");
    if (!list) return;

    // Загрузка чанка локали асинхронна — форма могла закрыться за это время
    const languages = await I18n.languages();
    if (!form.tpl || !list.isConnected) return;

    const current = I18n.language;

    // Значения обязаны ехать в атрибутах radio: обработчик читает выбор
    // именно оттуда, а не из замыкания (паттерн настроек раскладки встречи)
    list.replaceChildren(Toggle.cardGroupDom(languages.map((language) => ({
        name: "language",
        value: language.code,
        checked: language.code === current,
        text: language.name,
        attributes: [
            { name: "data-language", value: language.code },
            { name: "data-name", value: language.name }
        ]
    }))));

}
