// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем core
import { ScrollManager } from "../../../core/managers/scroll_manager.js";

// Импортируем functions
import { registerScrollbar } from "./register_scrollbar.js";
import { loadSection } from "./load_section.js";

// Импортируем типы
import type { ChannelProfile, MediaSection } from "../types.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Шаблон заголовка вкладки.
 *
 * @param section - Описание секции.
 * @param name - Локализованное название вкладки.
 * @returns Элемент заголовка.
 * ***************************************************************************
 */
function templateTab(section: MediaSection, name: string): HTMLElement {

    // DOMParser вместо innerHTML
    const tab = new DOMParser().parseFromString(`
        <div data-target="${section.id}" class="item flex flex-row flex-1 justify-center flex-shrink-0 gap-2 p-2 items-center rounded-lg transition-colors duration-150 cursor-pointer hover:text-[var(--text-color)] hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] [&.active]:text-[var(--text-color)] [&.active]:font-semibold [&.active]:bg-[var(--second-bg)]">
            <span class="flex flex-row gap-2 items-center font-semibold text-sm text-center whitespace-nowrap">${name}</span>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // invariant: шаблон выше всегда содержит корневой .item
    if (!tab) throw new Error(`Не удалось разобрать шаблон вкладки ${section.id}`);

    return tab;

}

/**
 * ***************************************************************************
 * Шаблон панели вкладки.
 *
 * Заменяет бывшие _templateGridPane и _templateFlexPane из index.ts: они
 * различались ровно одним классом контейнера списка, который и задаёт
 * поле layout из config/media_sections.ts.
 *
 * @param section - Описание секции.
 * @param layout - Раскладка списка.
 * @param name - Локализованное название вкладки (fallback пустого
 *   состояния, если перевода для секции ещё нет).
 * @returns Элемент панели.
 ***************************************************************************
 */
function templatePane(section: MediaSection, layout: MediaSection["layout"], name: string): HTMLElement {

    // grid — фото и видео по три в ряд, list — вертикальный список
    const listClasses = layout === "grid"
        ? "grid grid-cols-3 w-full gap-1"
        : "flex flex-col w-full gap-0";

    // Текст пустого состояния: свой ключ на каждую секцию
    const emptyText = I18n.tree.forms.channel_profile.empty?.[section.localeKey] || name;

    // DOMParser вместо innerHTML
    const pane = new DOMParser().parseFromString(`
        <div data-target="${section.id}" class="item flex flex-col w-full p-3 gap-0 bg-[var(--second-bg)] rounded-lg">
            <div data-list class="${listClasses}"></div>

            <div data-empty class="flex flex-col gap-3 p-6 items-center text-center hidden">
                <div class="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                    ${Icons.icon(section.icon, { settings: { size: 26, stroke: 1.5 } })?.outerHTML}
                </div>
                <span class="text-sm text-muted">${emptyText}</span>
            </div>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // invariant: шаблон выше всегда содержит корневой .item
    if (!pane) throw new Error(`Не удалось разобрать шаблон панели ${section.id}`);

    return pane;

}

/**
 * ***************************************************************************
 * Сборка вкладок профиля канала по конфигу секций.
 *
 * Заменяет ~150 строк одинакового кода в _onBeforeOpen: шесть блоков
 * «вкладка + панель + список + скроллбар + addTab(onActivation)»,
 * различавшихся именами.
 *
 * Порядок важен: сначала все вкладки добавляются в Tabs, и только потом
 * активируется первая — иначе Tabs не найдёт соседние панели.
 *
 * @param form - Экземпляр формы.
 * @param sections - Описания секций (config/media_sections.ts).
 * @returns void
 ***************************************************************************
 */
export function buildSections(form: ChannelProfile, sections: MediaSection[]): void {

    if (!form || !Array.isArray(sections)) return;

    for (const section of sections) {

        try {

            // Название вкладки из локали. Отдельного ключа на каждую секцию
            // не заводим: по умолчанию показываем id, чтобы вкладка была
            // кликабельной даже если перевод ещё не добавлен
            const name = I18n.tree.forms.channel_profile?.[section.localeKey] || section.id;

            const tab = templateTab(section, name);
            const pane = templatePane(section, section.layout, name);

            // Контейнер списка запоминаем на форме: по нему и подписка
            // Store, и обработчик скролла, и load_section
            form[section.listKey] = pane.querySelector<HTMLElement>(":scope >[data-list]");

            // Блок пустого состояния секции (переключает
            // functions/update_section_empty.ts)
            form[`${section.id}Empty`] = pane.querySelector<HTMLElement>(":scope >[data-empty]");

            // Добавляем вкладку. Первую страницу грузим при активации,
            // а не сразу: вкладок шесть, а открыта одна — остальные грузили бы
            // впустую. Гарды «первая страница уже загружена / идёт запрос /
            // в направлении больше данных» — внутри loadSection, поэтому
            // повторная активация загруженной вкладки не даёт дубля запроса
            form.tabs?.addTab({
                id: section.id,
                links: tab,
                pane: pane,
                onActivation: () => {
                    loadSection(form, section);
                }
            });

            // Скроллбар панели. Через registerScrollbar, чтобы экземпляр
            // попал в реестр формы и был разрушен при закрытии
            registerScrollbar(form, section.scrollKey, pane);

            // Менеджер якоря скролла секции: вставка пачки prev в начало
            // списка не должна сдвигать видимую часть панели (см.
            // functions/load_section.ts); ключ — от section.id, как и у
            // прочего состояния секции
            const scrollbars = form[section.scrollKey];
            if (scrollbars) {
                form[`${section.id}ScrollManager`] = new ScrollManager(scrollbars);
            }

        } catch (error) {

            // Одна сломанная секция не должна ронять всю форму: цикл идёт
            // дальше, вкладка просто не появится
            Logger.error(`[app][channel-profile][build-sections][${section.id}]:`, error);

        }

    }

}
