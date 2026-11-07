// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { Icons } from "../../../../../utils/icons.js";

// Ипортируем forms
import { BotApp } from "../../../../bot-app/index.js";

// Импортируем типы
import { BotAppItem } from "../../../../bot-profile/requests/get_bot_info.js";
import type { BotAppsList } from "../index.js";

/**
 * ***************************************************************************
 * Создание DOM-элемента строки приложения бота.
 *
 * Был классом-фабрикой (constructor возвращал элемент) — переведён в
 * функцию по канону миграции. Элемент живёт в data.__domElements__ (для
 * удаления копий при выгрузке из стора).
 * @param form - Экземпляр диалога приложений.
 * @param data - Данные приложения.
 * @returns DOM-элемент строки приложения.
 * ***************************************************************************
 */
export function createAppItem(form: BotAppsList, data: BotAppItem): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = createTemplate();

    // Актуальные данные элемента
    let currentData = data;

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param itemData - Данные приложения.
     * ***************************************************************************
     */
    const setup = (itemData: BotAppItem): void => {

        try {

            // Сохраняем актуальные данные
            currentData = itemData;

            // Название
            const name = element.querySelector("[data-name]");
            if (name) name.textContent = itemData.name;

        } catch (error) {
            Logger.error(error);
        }

    };

    /**
     * ***************************************************************************
     * Обработчики элемента.
     * ***************************************************************************
     */
    const actions = (): void => {

        // Открываем app и закрываем диалог приложений
        element.addEventListener("click", () => {
            new BotApp({ appId: currentData?.id });
            form?.modal?.close();
        });

    };

    // Записываем ссылку на DOM-элемент в данные
    if (!currentData.__domElements__) {
        currentData.__domElements__ = [];
    }
    currentData.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(currentData);

    // Прикрепляем обработчики событий
    actions();

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента: DOMParser для безопасного создания DOM без innerHTML.
 * @returns DOM-элемент строки приложения.
 * ***************************************************************************
 */
function createTemplate(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-1 w-full p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg ring ring-black/10 dark:ring-white/10 justify-between items-center cursor-pointer">
            <div class="flex flex-col gap-0">
                <div class="flex flex-row gap-2 items-center">
                    <div class="shrink-0">${Icons.icon("app-window")?.outerHTML}</div>
                    <span data-name class="truncate w-full"></span>
                </div>
            </div>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}
