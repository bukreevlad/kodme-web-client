// Импортируем типы
import type { ChannelProfile, ChannelSectionItemData, MediaSection } from "../types.js";

/**
 * ***************************************************************************
 * Приватный: месячная метка записи ("YYYY-MM" в локальном времени).
 * @param data - Данные записи секции.
 * @returns Метка или undefined, если даты нет или она не разбирается.
 * ***************************************************************************
 */
function readMonthKey(data?: ChannelSectionItemData): string | undefined {

    // Даты может не быть: вложение без сообщения или локальная загрузка
    const raw = data?.created_at;
    if (!raw) return undefined;

    // Некорректная строка — границу группы по ней не строим
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return undefined;

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * ***************************************************************************
 * Приватный: заголовок разделителя — «Октябрь 2026».
 *
 * Месяц берётся из Intl по локали окна (как в TimeAgoFormatter) — массива
 * месяцев в коде нет; год приклеивается вручную, чтобы не тянуть из Intl
 * служебное «г.».
 *
 * @param key - Месячная метка ("YYYY-MM").
 * @returns Текст заголовка.
 * ***************************************************************************
 */
function monthTitle(key: string): string {

    // Метка всегда нашего формата, но дефолты спасают strict-типизацию
    const [year, month] = key.split("-").map(Number);
    const date = new Date(year ?? 1970, (month ?? 1) - 1, 1);

    const name = new Intl.DateTimeFormat(window._lc?.locale || "ru-RU", { month: "long" }).format(date);
    return name.charAt(0).toUpperCase() + name.slice(1) + " " + date.getFullYear();
}

/**
 * ***************************************************************************
 * Приватный: DOM-элемент разделителя месяца.
 * @param section - Описание секции (см. config/media_sections.ts).
 * @param key - Месячная метка ("YYYY-MM").
 * @returns Элемент с data-month и текстом заголовка.
 * ***************************************************************************
 */
function createDivider(section: MediaSection, key: string): HTMLElement {

    const divider = document.createElement("div");
    divider.setAttribute("data-month", key);

    // В сетке разделитель занимает всю строку (col-span-full), в списке —
    // обычный блок; sticky прилипает к верху панели при скролле, фон панели
    // прячет записи, проходящие под заголовком
    divider.className = section.layout === "grid"
        ? "col-span-full sticky top-0 z-10 p-1.5 text-sm font-medium text-muted bg-[var(--form-bg)]"
        : "sticky top-0 z-10 w-full py-1.5 text-sm font-medium text-muted bg-[var(--second-bg)]";

    divider.textContent = monthTitle(key);
    return divider;
}

/**
 * ***************************************************************************
 * Сверка разделителей месяцев в списке секции.
 *
 * Разделители — только DOM (data-month), в Store не попадают: пагинация,
 * счётчики и MediaViewer работают со стором и их не видят. Сверка
 * идемпотентная: один проход по списку, лишние разделители убираются,
 * правильно стоящие не перевставляются (нет мигания и нет сдвига скролла).
 *
 * Вызывается из subscribe_section на каждый item::added / item::removed:
 * страница приходит пачкой, но строки встают по одной — граница месяца
 * отслеживается сразу.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание секции (см. config/media_sections.ts).
 * @returns void
 * ***************************************************************************
 */
export function syncMonthDividers(form: ChannelProfile, section: MediaSection): void {

    // Список секции ещё не собран — сверять нечего
    const list = form[section.listKey];
    if (!list) return;

    // Месяц текущей группы: метка последней записи с датой
    let group: string | undefined;

    // Идём по детям вживую: после insertBefore / remove nextElementSibling
    // пересчитывается, обход ломаться не может
    let element: Element | null = list.firstElementChild;

    while (element) {

        // Судьбу разделителя решает стоящая за ним запись
        if (element.hasAttribute("data-month")) {
            element = element.nextElementSibling;
            continue;
        }

        // Месяц записи; записи без даты к текущей группе прилипают и
        // границу не создают
        const data = form[section.storeKey].get(element.getAttribute("data-id") || "");
        const key = readMonthKey(data);

        if (key !== undefined && key !== group) {

            // Начало новой группы: перед записью должен стоять разделитель
            const previous = element.previousElementSibling;

            if (previous?.hasAttribute("data-month")) {

                // Уже стоит — метку поправляем на месте, без перевставления
                if (previous.getAttribute("data-month") !== key) {
                    previous.setAttribute("data-month", key);
                    previous.textContent = monthTitle(key);
                }

            } else {
                list.insertBefore(createDivider(section, key), element);
            }

            group = key;

        } else if (element.previousElementSibling?.hasAttribute("data-month")) {

            // Месяц не сменился (или у записи нет даты) — разделитель
            // перед ней лишний
            element.previousElementSibling.remove();

        }

        element = element.nextElementSibling;
    }

    // Хвостовой разделитель без записей за ним — сирота после удаления
    while (list.lastElementChild?.hasAttribute("data-month")) {
        list.lastElementChild.remove();
    }

}
