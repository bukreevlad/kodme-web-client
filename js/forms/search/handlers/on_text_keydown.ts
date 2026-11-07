// Импортируем handlers
import { searchHandler } from "./search.js";

// Импортируем типы
import type { Search } from "../index.js";

/**
 * ***************************************************************************
 * Клавиатура в поле поиска: Enter запускает поиск.
 *
 * Зачем: обработчиков клавиатуры в форме не было вообще, поиск срабатывал
 * только по клику на кнопку. Это неочевидно — пользователь набирает запрос,
 * жмёт Enter и ничего не видит.
 *
 * Что НЕ делаем: live-поиск с debounce. Каждая буква — это запрос к серверу по
 * четырём категориям сразу, то есть 4 запроса на keystroke; без защиты от
 * дребезга (плюс рейт-лимит на поисковых сокетах) это легко упирается в
 * RATE_LIMIT_EXCEEDED. Enter — предсказуемый и дешёвый вариант.
 *
 * Кроме Enter гасим и IME-композицию: `keydown` с `isComposing === true` при
 * русской раскладке приходит от дедлайна (буква «ё»), и поиск улетел бы на
 * промежуточном слоге.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки.
 ***************************************************************************
 */
export function onTextKeydownHandler(form: Search): () => void {

    const input = form?.text;
    if (!input) return () => { };

    const onKeydown = (event: KeyboardEvent) => {

        // Не наш Enter: стрелки, Tab, Escape и прочее не трогаем
        if (event.key !== "Enter") return;

        // Идёт ввод с клавиатуры (метод вставки/автозаполнения) — это не
        // пользовательское «ищу», запрос не отправляем
        if (event.isComposing) return;

        event.preventDefault();
        event.stopPropagation();

        // void: запрос сам ловит свои ошибки, ответ вызывающему не нужен
        void searchHandler(form);

    };

    input.addEventListener("keydown", onKeydown);

    // Отписка складывается вместе с остальными в `teardown`: input удаляется
    // вместе с DOM формы, но обработчик держит замыкание на форму
    return () => input.removeEventListener("keydown", onKeydown);

}
