// Импортируем типы
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * Возврат к списку паков из стикеров пака (стадия 1 панели).
 * @param form - Форма эмодзи.
 * ***************************************************************************
 */
export function backToPaks(form: Emoji): void {

    // Прячем стадию стикеров пака (вместе с плашкой пустого пака)
    form.stickersView?.classList.add("hidden");
    form.stickersPakEmpty?.classList.add("hidden");

    // Показываем список паков
    form.paksList?.classList.remove("hidden");

    // Пустое состояние — только если паков и правда нет
    form.stickersEmpty?.classList.toggle("hidden", !form.isPaksEmpty);

}
