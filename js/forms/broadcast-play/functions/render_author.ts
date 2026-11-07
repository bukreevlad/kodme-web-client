// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { t } from "../../../utils/i18n/index.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";
import type { BroadcastCast } from "../types.js";

/**
 * ***************************************************************************
 * RENDER_AUTHOR - рендерит строку автора трансляции.
 *
 * Зачем отдельная функция, а не `author.textContent = data.created_display_name`
 * ------------------------------------------------
 * У автора есть два разных состояния: человек и бот. Сервер отдаёт уже
 * готовую строку (для бота — его `link`, для человека — имя и фамилию),
 * но визуально их не отличить: автор бота выглядит как обычный никнейм,
 * и пользователь не понимает, что эфир ведёт автоматика.
 *
 * Поэтому рядом с именем ставится отметка бота с иконкой, а сама строка
 * помечается `data-author-is-bot` — по этому атрибуту можно менять стиль,
 * не читая текст.
 *
 * @param form - Экземпляр формы.
 * @param data - Данные трансляции. По умолчанию — из формы.
 * @returns true, если строка отрисована.
 * ***************************************************************************
 */
export function renderAuthor(form: BroadcastPlay, data?: BroadcastCast | null): boolean {

    try {

        // Элемент имени и его контейнер
        const author = form?.author;
        const wrapper = form?.authorWrap || author?.parentElement;

        if (!author || !wrapper) return false;

        const cast = data || form.cast;
        if (!cast) return false;

        // Имя. Ответ сервера уже содержит отформатированную строку,
        // поэтому здесь нет ни склейки, ни транслитерации
        author.textContent = cast.created_display_name || "";

        // ---------- ОТМЕТКА БОТА ----------
        const isBot = Boolean(cast.is_bot);

        wrapper.setAttribute("data-author-is-bot", String(isBot));

        // Повторный вызов не должен плодить бейджи
        const badge = wrapper.querySelector(":scope [data-author-badge]");
        if (badge) badge.remove();

        if (!isBot) return true;

        // Бейдж: иконка + подпись. Собираем через DOM, а не строкой
        // шаблона — имена авторов сюда не попадают, а так ничего
        // экранировать не придётся
        const badgeElement = document.createElement("span");
        badgeElement.setAttribute("data-author-badge", "");

        // Иконка бота. Если реестр её не отдал — бейдж останется
        // с текстом, внешний вид не ломается
        const botIcon = Icons.icon("robot");
        if (botIcon) badgeElement.appendChild(botIcon);

        const badgeText = document.createElement("span");
        badgeText.textContent = t("forms.broadcast_play.bot_badge");
        badgeElement.appendChild(badgeText);

        wrapper.appendChild(badgeElement);

        return true;

    } catch (error) {

        // Строка автора — не критично для воспроизведения
        Logger.error(error);
        return false;

    }

}
