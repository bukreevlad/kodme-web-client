// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем config формы
import { SECTION_IDS, SECTIONS } from "../config/sections.js";

// Импортируем типы
import type { SearchSection } from "../config/sections.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Разметка вкладок и панелей формы поиска: собирается по `config/sections.ts`,
 * поэтому новая категория добавляется одной записью в конфиг плюс ключом
 * в `locales/ru.json`.
 *
 * Все категории рендерятся, а не только разрешённые: скрывает их
 * `Tabs.hiddenTab` в `_onBeforeOpen` — иначе проверка «у каждой категории
 * есть панель» ругалась бы на намеренно скрытые вкладки.
 ***************************************************************************
 */

/**
 * ***************************************************************************
 * Список вкладок (горизонтальная лента между шапкой и контентом).
 * @returns HTML вкладок.
 ***************************************************************************
 */
export function tabsMarkup(): string {

    return SECTION_IDS.map(id => sectionMarkup(SECTIONS[id])).join("");

}

/**
 * ***************************************************************************
 * Панели вкладок с состоянием и списком.
 *
 * Разметка панели одинакова, кроме кнопки в шапке: она задаётся полем
 * `createBotKey` в описании категории (сейчас только у вкладки ботов).
 * Активность первой панели выставляет `Tabs.activateTab` в `_onBeforeOpen` —
 * до загрузки данных, чтобы стартовая вкладка была видна сразу.
 *
 * @returns HTML панелей.
 ***************************************************************************
 */
export function panesMarkup(): string {

    return SECTION_IDS.map(id => paneMarkup(SECTIONS[id])).join("");

}

/**
 * ***************************************************************************
 * Приватный: разметка одной вкладки ленты (горизонтальная лента вкладок
 * между шапкой и контентом).
 *
 * Визуал вкладки: без скругления, выделение — верхняя линия 3px
 * (активная — цвет бренда, наведение — серый); фон не заливается.
 * @param section - Описание категории.
 * @returns HTML вкладки.
 ***************************************************************************
 */
function sectionMarkup(section: SearchSection): string {

    return `
        <li data-target="${section.id}" class="item flex flex-row flex-1 justify-center flex-shrink-0 gap-2 p-2 items-center transition-colors duration-150 cursor-pointer border-b-[3px] border-transparent hover:border-[var(--text-muted)] hover:text-[var(--text-color)] [&.active]:border-[var(--color-brand)] [&.active]:text-[var(--text-color)] [&.active]:font-semibold [&.active:hover]:border-[var(--color-brand)]">
            <span class="flex flex-row gap-2 items-center font-semibold text-sm text-center">${label(section)}</span>
        </li>
    `;

}

/**
 * ***************************************************************************
 * Приватный: разметка одной панели вкладки.
 * @param section - Описание категории.
 * @returns HTML панели.
 ***************************************************************************
 */
function paneMarkup(section: SearchSection): string {

    return `
        <div class="item flex flex-col gap-0" data-target="${section.id}">
            ${section.createBotKey ? panelButton(section.createBotKey) : ""}
            <div data-state="${section.id}" class="hidden flex-col items-center justify-center w-full p-4 text-center text-muted text-sm"></div>
            <div data-list="${section.id}" class="flex flex-col p-2 gap-0 w-full"></div>
        </div>
    `;

}

/**
 * ***************************************************************************
 * Подпись вкладки из локализации.
 * @param section - Описание категории.
 * @returns Текст вкладки.
 ***************************************************************************
 */
function label(section: SearchSection): string {

    return I18n.tree.forms.search?.[section.id] ?? "";

}

/**
 * ***************************************************************************
 * Кнопка в шапке панели.
 * @param key - Ключ подписи кнопки из локализации (см. SearchSection.createBotKey).
 * @returns HTML кнопки.
 ***************************************************************************
 */
function panelButton(key: NonNullable<SearchSection["createBotKey"]>): string {

    return Buttons.transparent({
        text: I18n.tree.forms.search?.[key] ?? "",
        attributes: ["action-create-bot"],
        classes: ["w-full"],
        icon: "robot"
    }).html;

}
