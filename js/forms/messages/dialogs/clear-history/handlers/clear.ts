// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем типы
import type { ClearHistory } from "../index.js";

/**
 * ***************************************************************************
 * Отправить ответ диалога очистки истории (значение checkbox «удалить для
 * всех») и закрыть диалог.
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function clearHandler(form: ClearHistory): Promise<void> {

    // Устанавливаем элементы
    let forAll = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="for-all"]`);

    try {

        // Отправляем ответ
        // Чекбокс «для всех» — UI-флаг: нет элемента ⇒ не отмечен
        form.callback({
            for_all: forAll?.checked ?? false
        });
        form.modal?.close();

    } catch (error) {

        // Если не удалось отправить ответ
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
