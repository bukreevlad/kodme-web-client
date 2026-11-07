// Импортируем requests
import { generateInitDataRequest } from "../requests/generate_init_data.js";

// Импортируем типы
import type { BotApp } from "../index.js";

/**
 * ***************************************************************************
 * Загрузка init-данных приложения до создания формы.
 *
 * Запрашивает подпись у сервера и заполняет initData/appOrigin формы.
 * Ошибка пробрасывается наружу — тост и очистку реестра выполняет вызывающий
 * код (index.ts, _open): форма без init-данных не должна открываться.
 * @param form - Экземпляр формы WebApp-приложения.
 * @returns Promise<void>.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function loadInitData(form: BotApp): Promise<void> {

    // Запрашиваем init-данные
    const response = await generateInitDataRequest({ bot_app_id: form.appId });

    // Ответ без полезной нагрузки считаем ошибкой открытия
    if (!response.data) throw new Error("Нет init-данных приложения");

    // Записываем initData
    form.initData = response.data;

    // Кэшируем origin приложения: мост сверяет с ним происхождение
    // postMessage-команд — iframe мог сам себя перенаправить на другой домен
    form.appOrigin = new URL(form.initData.url).origin;

}
