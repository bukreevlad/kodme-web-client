// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импорт components
import { Avatars } from "../../../components/avatars.js";

// Ипортируем handlers
import { messageReactionClickHandler } from "./handlers/message_reaction_click.js";

// Импортируем типы
import type { MessageReaction } from "./types.js";
import type { MessageItem } from "./message.js";

/**
 * ***************************************************************************
 * messageReactions - блок реакций сообщения: кнопки emoji со счётчиком,
 * стопкой аватарок и отметкой «моя реакция».
 * @param message - Экземпляр сообщения.
 * @returns void
 * ***************************************************************************
 */
export function messageReactions(message: MessageItem): void {

    try {

        // Если не передан Dom элемент
        if (!message) return;

        // Получаем реакции
        let reactions = message.data?.reactions || [];

        // Ескли реакций в сообщении нет
        if (!reactions) return;

        // Контейнер реакций
        let reactionsContainer = message.element.querySelector("reactions");
        if (!reactionsContainer) return;
        reactionsContainer.innerHTML = "";

        // Проходим по реакциям
        reactions.forEach(reaction => {

            // Создать реакцию
            let element = templateReaction(reaction);

            // Отображаем аватарки
            let avatarsContainer = element.querySelector("[data-avatars]");
            let countsEl = element.querySelector("[data-counts]");

            // Получаем аватарки
            let avatars = reaction?.avatars || [];

            // Если реакций меньше 3
            if (Number(reaction.count) <= 3) {
                countsEl?.classList.add("hidden");
            } else {
                countsEl?.classList.remove("hidden");
            }

            // Проходим по аватарам
            avatars.forEach(user => {
                let avatarEl = document.createElement("div");
                new Avatars({
                    element: avatarEl,
                    id: user.user_id,
                    name: user.display_name,
                    image: user.avatar,
                    size: "2xs"
                });
                avatarsContainer?.append(avatarEl);
            });

            // Если эта реакция была и у пользователя
            if (reaction.is_selected) {
                element.classList.add("bg-[var(--color-brand)]", "dark:bg-[var(--color-brand)]");
                // Раньше сюда передавался boolean — DOM приводит его к "true"
                element.setAttribute("selected", "true");
            } else {
                element.removeAttribute("selected");
            }

            // Добавляем в шаблон
            reactionsContainer.appendChild(element);

            // Клик: реакция (без эмодзи переключать нечего — серверу не передать)
            element.addEventListener("click", () => {
                if (reaction.reaction === undefined) return;
                messageReactionClickHandler(message, reaction.reaction);
            });

        });

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Шаблон элемента реакции.
 * @param data - Emoji реакция.
 * @returns DOM-элемент кнопки реакции.
 * ***************************************************************************
 */
function templateReaction(data: MessageReaction): HTMLElement {
    const element = new DOMParser().parseFromString(`
            <button class="item flex flex-row rounded-3xl gap-1 p-1 items-center cursor-pointer transition-colors duration-150 bg-[var(--color-black)]/5 hover:bg-[var(--color-black)]/10 active:bg-[var(--color-black)]/15 dark:bg-[var(--color-white)]/10 dark:hover:bg-[var(--color-white)]/15 dark:active:bg-[var(--color-white)]/20">
                <span class="font-emoji text-lg leading-none">${data.reaction}</span>
                <span data-counts>${data.count}</span>
                <div data-avatars class="flex flex-row items-center -space-x-2"></div>
            </button>
        `, "text/html").querySelector<HTMLButtonElement>("button");

    // Своя разметка всегда содержит «button» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: button");

    return element;
}
