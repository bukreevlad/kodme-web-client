// Импортируем utils
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { createStickerPakRow } from "../components/sticker_pak_row.js";

// Импортируем requests
import { getStickerPaksRequest } from "../requests/get_sticker_paks.js";

// Импортируем типы
import type { Emoji } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Количество паков в одной выборке панели (максимум сервера).
 */
const PAKS_LIMIT = 100;

/**
 * ***************************************************************************
 * Загрузка списка паков в панель «Стикеры» (стадия 1).
 *
 * Состав — «мои + добавленные»: сервер отдаёт публичный
 * каталог и свои паки, здесь из выборки оставляются свои (`is_author`)
 * и подписки (`is_member`). Панель грузится один раз за жизнь формы.
 * @param form - Форма эмодзи.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function loadStickerPaks(form: Emoji): Promise<void> {

    // Панель уже грузилась — повторная загрузка не нужна
    if (form.isPaksLoaded) return;

    try {

        // Запрос списка (ошибки сервера сокет пробрасывает reject'ом)
        const response = await getStickerPaksRequest({ limit: PAKS_LIMIT });

        // Неожиданный ответ — просто выходим
        if (!Array.isArray(response?.data)) return;

        // Оставляем «мои + добавленные» (серверная выборка шире — каталог)
        const paks = response.data.filter((pak) => pak.is_author || pak.is_member);

        // Помечаем панель загруженной (даже пустой список — он валиден)
        form.isPaksLoaded = true;
        form.isPaksEmpty = paks.length === 0;

        // Рендерим строки паков
        paks.forEach((pak) => {
            const row = createStickerPakRow(form, pak);
            if (row) form.paksList?.append(row);
        });

        // Пустое состояние: показываем только при пустом списке
        form.stickersEmpty?.classList.toggle("hidden", !form.isPaksEmpty);

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][emoji][load-sticker-paks]",
            fallback: t("forms.emoji.stickers.load_error")
        });

    }

}
