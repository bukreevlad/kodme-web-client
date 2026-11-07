// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import type { AvatarSize } from "../../../components/avatars.js";

/**
 * ***************************************************************************
 * ВАЖНО: components/avatars.ts ожидает документ картинки
 * ({ id, token, metadata: { thumbnails } }), а не URL-строку.
 * Поэтому здесь поддерживаются оба варианта, а строка-URL монтируется
 * напрямую в <img> с кешированием через CacheManager.
 */
import { CacheManager } from "../../../utils/cache_manager.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { CallAvatar } from "../types.js";
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Определяет тип переданных данных аватара.
 * @param avatar - Документ аватара или URL.
 * @returns Тип аватара (null — ничего не передали).
 * ***************************************************************************
 */
function getAvatarType(avatar: CallAvatar): "document" | "url" | null {

    // Ничего не передали
    if (!avatar) return null;

    // Это URL-строка
    if (typeof avatar === "string") return "url";

    // Это документ (есть id)
    if (typeof avatar === "object" && avatar.id) return "document";

    return null;

}

/**
 * ***************************************************************************
 * Рендерит аватар собеседника в указанный элемент.
 * Поддерживает и документ аватара, и URL-строку.
 * @param form - Экземпляр формы Call.
 * @param selector - Селектор элемента внутри формы.
 * @param size - Размер аватара Avatars.
 * @returns Экземпляр Avatars (для документа и акронима), иначе null.
 * ***************************************************************************
 */
export function renderAvatar(form: Call, selector: string, size: AvatarSize = "xl"): Avatars | null {

    try {

        const element = form.tpl?.querySelector<HTMLElement>(selector);
        if (!element) return null;

        // Ничего не прислали — оставляем акроним
        const avatar = form.avatar;
        const type = getAvatarType(avatar);

        // Нет аватара — Avatars сам нарисует цветной акроним
        if (!type) {
            return new Avatars({
                element,
                id: form.userId ?? undefined,
                name: form.displayName,
                size
            });
        }

        // Документ аватара — штатный путь компонента
        if (type === "document" && typeof avatar === "object") {
            return new Avatars({
                element,
                id: form.userId ?? undefined,
                name: form.displayName,
                image: avatar,
                size
            });
        }

        // URL-строка — монтируем картинку вручную через кеш-менеджер
        if (typeof avatar === "string") {
            element.innerHTML = "";
            const img = document.createElement("img");
            img.className = "w-full h-full object-cover rounded-full";
            img.alt = form.displayName || "Avatar";
            img.loading = "lazy";
            img.src = CacheManager.getMediaSrc({ url: avatar, type: "image" });
            img.onerror = () => {
                Logger.debug("[app][call]: Не удалось загрузить аватар по URL, показываем акроним");
                img.remove();
                new Avatars({ element, id: form.userId ?? undefined, name: form.displayName, size });
            };
            element.appendChild(img);
        }

        return null;

    } catch (error) {
        Logger.error("[app][call]: Не удалось отрисовать аватар", error);
        return null;
    }

}
