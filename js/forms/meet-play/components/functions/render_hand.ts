// Импортируем utils
import { Icons } from "../../../../utils/icons.js";

// Импортируем functions
import { isHandRaised } from "../../functions/parse_participant.js";

// Импортируем типы
import type { ParticipantItem } from "../participant.js";

/**
 * ***************************************************************************
 * renderHand - Показывает или прячет значок поднятой руки на плитке.
 *
 * Значок нужен всем, а не только организатору: поднятая рука — это
 * «дайте слово», и её должен видеть тот, кого сейчас слушают, иначе
 * человек не поймёт, к кому вообще обращаться.
 *
 * Контейнер живёт в шаблоне плитки и не пересоздаётся: иконка ставится
 * один раз, дальше переключается только видимость. Видимость меняем
 * парой `hidden`/`flex`, а не одним `hidden` поверх статичного `flex` —
 * display-утилиты в собранном CSS идут по алфавиту.
 * @param item - Экземпляр плитки участника.
 * @returns {void}
 * ***************************************************************************
 */
export function renderHand(item: ParticipantItem): void {

    const participant = item?.data?.participant;
    const element = item?.element?.querySelector<HTMLElement>(":scope [data-hand]");
    if (!element) return;

    // ---------- СОСТОЯНИЕ ----------
    const raised = isHandRaised(participant);

    // ---------- ВИДИМОСТЬ ----------
    element.classList.toggle("hidden", !raised);
    element.classList.toggle("flex", raised);

    // ---------- ИКОНКА ----------
    // Рисуем один раз: событие ParticipantMetadataChanged прилетает на
    // любое изменение метаданных, а пересобирать DOM на каждый тик
    // незачем. Icons.icon возвращает null на неизвестном имени, поэтому
    // результат проверяем — иначе appendChild бросил бы исключение
    if (raised && !element.childElementCount) {
        const icon = Icons.icon("hand-finger", {
            classes: ["meet-play-hand-badge"],
            settings: { size: 16 }
        });
        if (icon) element.appendChild(icon);
    }

    // ---------- ДОСТУПНОСТЬ ----------
    // Подписи на плитке нет — места нет, а молчаливый значок не значит
    // ничего. Роль `img` обязательна: на голом `div` с одной подписью
    // скринридер промолчит.
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", window._lc?.forms?.meet_play?.hand_raised || "");

}
