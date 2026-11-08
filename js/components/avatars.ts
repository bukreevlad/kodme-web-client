// Импортируем utils
import { hashString } from "../utils/string/string_to_hash.js";
import { CacheManager } from "../utils/cache_manager.js";
import { Icons } from "../utils/icons.js";
import { getThumbnailSizeQuery } from "../utils/helpers/get_thumbnail_size_query.js";

// Импортируем типы
import type { Thumbnail } from "../utils/helpers/get_thumbnail_size_query.js";

/**
 * Размер аватара (Tailwind-варианты от 3xs до 9xl).
 */
export type AvatarSize = "3xs" | "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "8xl" | "9xl";

/**
 * Статус присутствия пользователя (точка в правом нижнем углу).
 */
export type AvatarStatus = "online" | "offline" | "away" | "busy";

/**
 * Атрибут для элемента аватара: голое имя либо объект `{ name, value }`.
 */
export type AvatarAttribute = string | { name: string; value?: string };

/**
 * Документ картинки (используются только поля, нужные аватару).
 */
export interface AvatarImageDocument {
    /** ID файла изображения (строится URL превью). */
    id?: string;
    /** Токен доступа к файлу. */
    token?: string;
    /** Метаданные файла (из них берутся миниатюры). */
    metadata?: {
        /** Список серверных миниатюр. */
        thumbnails?: Thumbnail[];
    };
}

/**
 * Настройки аватара.
 */
export interface AvatarOptions {
    /** DOM-элемент аватара (если не передан — создаётся div). */
    element?: HTMLElement | null | undefined;
    /** Уникальный ID (подбирается цвет). */
    id?: string | null | undefined;
    /** Название (акроним). */
    name?: string | null | undefined;
    /** Документ картинки. */
    image?: AvatarImageDocument | null | undefined;
    /** Иконка (из Icons). */
    icon?: string | null;
    /** Размер аватара. */
    size?: AvatarSize | undefined;
    /** Статус (online, offline, away, busy). */
    status?: AvatarStatus | null;
    /** Дополнительные классы. */
    classes?: string[];
    /** Дополнительные классы для wrap-элемента. */
    wrapClasses?: string[];
    /** Дополнительные атрибуты. */
    attributes?: AvatarAttribute[];
}

/**
 * Настройки экземпляра после применения дефолтов конструктора.
 */
interface ResolvedAvatarOptions {
    /** DOM-элемент аватара. */
    element: HTMLElement;
    /** Уникальный ID. */
    id: string | null;
    /** Название (акроним). */
    name: string | null;
    /** Документ картинки. */
    image: AvatarImageDocument | null;
    /** Иконка. */
    icon: string | null;
    /** Размер аватара. */
    size: AvatarSize;
    /** Статус. */
    status: AvatarStatus | null;
    /** Дополнительные классы. */
    classes: string[];
    /** Дополнительные классы wrap. */
    wrapClasses: string[];
    /** Дополнительные атрибуты. */
    attributes: AvatarAttribute[];
}

export class Avatars {

    // Базовые стили для всех аватаров
    static #baseStyles = "inline-flex items-center justify-center flex-shrink-0";

    // Варианты размеров (Tailwind)
    static #sizes: Record<AvatarSize, string> = {
        "3xs": "w-[4.5] h-[4.5] text-xs",
        "2xs": "w-5 h-5 text-xs",
        xs: "w-6 h-6 text-xs",
        sm: "w-8 h-8 text-sm",
        md: "w-10 h-10 text-base",
        lg: "w-12 h-12 text-lg",
        xl: "w-14 h-14 text-xl",
        "2xl": "w-16 h-16 text-2xl",
        "3xl": "w-20 h-20 text-3xl",
        "4xl": "w-24 h-24 text-4xl",
        "5xl": "w-32 h-32 text-5xl",
        "6xl": "w-40 h-40 text-6xl",
        "7xl": "w-48 h-48 text-7xl",
        "8xl": "w-56 h-56 text-8xl",
        "9xl": "w-64 h-64 text-9xl"
    };

    // Добавляем классы для размера иконки
    static #iconSizes: Record<AvatarSize, string> = {
        "3xs": "w-2 h-2",
        "2xs": "w-3 h-3",
        xs: "w-4 h-4",
        sm: "w-5 h-5",
        md: "w-6 h-6",
        lg: "w-7 h-7",
        xl: "w-8 h-8",
        "2xl": "w-9 h-9",
        "3xl": "w-10 h-10",
        "4xl": "w-12 h-12",
        "5xl": "w-14 h-14",
        "6xl": "w-16 h-16",
        "7xl": "w-20 h-20",
        "8xl": "w-24 h-24",
        "9xl": "w-28 h-28"
    };

    // Цвета аватаров (теперь каждый цвет - массив классов)
    static #colors = [
        { param: "--avatar-red", class: "bg-linear-to-b from-[#FF845E] to-[#D45246]" },
        { param: "--avatar-orange", class: "bg-linear-to-b from-[#FEBB5B] to-[#F68136]" },
        { param: "--avatar-violet", class: "bg-linear-to-b from-[#B694F9] to-[#6C61DF]" },
        { param: "--avatar-green", class: "bg-linear-to-b from-[#9AD164] to-[#46BA43]" },
        { param: "--avatar-cyan", class: "bg-linear-to-b from-[#53edd6] to-[#28c9b7]" },
        { param: "--avatar-blue", class: "bg-linear-to-b from-[#38b9fa] to-[#0088cc]" },
        { param: "--avatar-pink", class: "bg-linear-to-b from-[#FF8AAC] to-[#D95574]" },
        { param: "--avatar-archive", class: "bg-linear-to-b from-[#B8C2CC] to-[#9EAAB5]" },
        { param: "--avatar-saved", class: "bg-linear-to-b from-[#b2a6eb] to-[#8774e1]" }
    ];

    /**
     * ***************************************************************************
     * Вспомогательный метод для добавления классов
     * @param {Element} element - Целевой элемент.
     * @param {string} [classString] - Строка классов.
     * ***************************************************************************
     */
    static _addClasses(element: Element, classString?: string | null) {
        if (!classString) return;
        classString.split(" ").filter(Boolean).forEach(cls => {
            element.classList.add(cls);
        });
    }

    /**
     * ***************************************************************************
     * Вспомогательный метод для удаления классов
     * @param {Element} element - Целевой элемент.
     * @param {string} [classString] - Строка классов.
     * ***************************************************************************
     */
    static _removeClasses(element: Element, classString?: string | null) {
        if (!classString) return;
        classString.split(" ").filter(Boolean).forEach(cls => {
            element.classList.remove(cls);
        });
    }

    /** Настройки экземпляра (с дефолтами конструктора). */
    options: ResolvedAvatarOptions;

    /** Wrap-контейнер изображения/акронима. */
    wrap: HTMLDivElement | null;

    /** Элемент акронима. */
    acronym: HTMLSpanElement | null;

    /** Элемент картинки. */
    img: HTMLImageElement | null;

    /** Точка статуса. */
    status: HTMLDivElement | null;

    /** Текущий тип содержимого (для пересборки при смене размера). */
    private _currentType: "image" | "icon" | "acronym" | null;

    /** Корневой элемент аватара. */
    private _element: HTMLElement;

    /**
     * ***************************************************************************
     * Компонент аватар.
     * @param {AvatarOptions} options - Настройки аватара.
     * ***************************************************************************
     */
    constructor({
        element,
        id = null,
        name = null,
        image = null,
        icon = null,
        size = "lg",
        status = null,
        classes = [],
        wrapClasses = ["rounded-full"],
        attributes = []
    }: AvatarOptions = {}) {

        if (!element) {
            element = document.createElement("div");
            element.classList.add("cdm-avatar");
        }

        this.options = {
            element,
            id,
            name,
            image,
            icon,
            size,
            status,
            classes,
            wrapClasses,
            attributes
        };

        // Элементы
        this.wrap = null;
        this.acronym = null;
        this.img = null;
        this.status = null;
        this._currentType = null; // "image", "icon", "acronym"

        this._element = element;
        this._init();
    }

    /**
     * ***************************************************************************
     * Инициализация аватара
     * ***************************************************************************
     */
    _init() {

        // Очищаем элемент
        this._element.innerHTML = "";

        // Применяем базовые стили
        Avatars._addClasses(this._element, Avatars.#baseStyles);

        // Применяем размер
        const sizeClass = Avatars.#sizes[this.options.size] || Avatars.#sizes.md;
        Avatars._addClasses(this._element, sizeClass);

        // Добавляем пользовательские классы
        this.options.classes.forEach(cls => {
            this._element.classList.add(cls);
        });

        // Добавляем атрибуты
        this.options.attributes.forEach(attr => {
            if (typeof attr === "string") {
                this._element.setAttribute(attr, "");
            } else if (typeof attr === "object" && attr.name) {
                this._element.setAttribute(attr.name, attr.value || "");
            }
        });

        // Создаем структуру аватара
        this._buildAvatar();

    }

    /**
     * ***************************************************************************
     * Сборка аватара
     * ***************************************************************************
     */
    _buildAvatar() {

        // Контейнер для изображения/акронима
        this.wrap = document.createElement("div");
        this.wrap.className = "w-full h-full flex items-center justify-center overflow-hidden relative";

        // Если указаны классы для wrap
        // (захват в локальную: суждение this.wrap из присваивания выше
        // не переносится внутрь замыкания forEach)
        const wrap = this.wrap;
        this.options.wrapClasses.forEach(cls => {
            wrap.classList.add(cls);
        });

        // Добавляем элемент
        this._element.appendChild(this.wrap);

        // Приоритет: image > icon > name
        if (this.options.image) {
            this._createImage();
        } else if (this.options.icon) {
            this._createIcon();
        } else {
            this._createAcronym();
        }

        // Добавляем статус если есть
        if (this.options.status) {
            this._addStatus();
        }

        // Применяем цвет только если нет изображения
        if (!this.options.image) {
            this._applyColor();
        } else if (this.options.icon) {
            // Для иконок добавляем цвет фона
            this._applyColor();
            // Делаем иконку белой для контраста
            const iconElement = this.wrap.querySelector("svg");
            if (iconElement) {
                iconElement.classList.add("text-[var(--color-white)]");
            }
        }

    }

    /**
     * ***************************************************************************
     * Создание изображения
     * ***************************************************************************
     */
    _createImage() {

        // Контейнер создаётся в _buildAvatar: без него некуда вставлять картинку
        if (!this.wrap) return;

        // Удаляем старые элементы
        if (this.acronym) {
            this.acronym.remove();
            this.acronym = null;
        }
        if (this.img) {
            this.img.remove();
            this.img = null;
        }

        this._currentType = "image";

        this.img = document.createElement("img");
        this.img.className = "w-full h-full object-cover";
        this.img.alt = this.options.name || "Avatar";

        // Получаем URL через CacheManager
        const thumbSize = this._getThumbSize();
        const mediaUrl = CacheManager.getMediaSrc({
            url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${this.options?.image?.id}${thumbSize}`,
            file_token: this.options?.image?.token,
            type: "image"
        });

        this.img.src = mediaUrl;
        this.wrap.appendChild(this.img);
    }

    /**
     * ***************************************************************************
     * Создание иконки
     * ***************************************************************************
     */
    _createIcon() {

        // Контейнер создаётся в _buildAvatar: без него некуда вставлять иконку
        if (!this.wrap) return;

        // Удаляем старые элементы
        if (this.acronym) {
            this.acronym.remove();
            this.acronym = null;
        }
        if (this.img) {
            this.img.remove();
            this.img = null;
        }

        this._currentType = "icon";

        // Создаем иконку
        // Строка иконки может отсутствовать — lookup по "" не найдёт иконки,
        // тогда срабатывает fallback на акроним (ветка else ниже)
        const iconElement = Icons.icon(this.options.icon ?? "", { settings: { filled: true, color: "var(--color-white)" } });
        if (iconElement) {

            const iconSize = Avatars.#iconSizes[this.options.size] || Avatars.#iconSizes.md;
            Avatars._addClasses(iconElement, iconSize);

            // Добавляем класс для адаптации к фону
            iconElement.classList.add("flex-shrink-0");

            this.wrap.appendChild(iconElement);
        } else {
            // Если иконка не найдена, показываем акроним
            this._createAcronym();
        }

    }

    /**
     * ***************************************************************************
     * Создание акронима
     * ***************************************************************************
     */
    _createAcronym() {

        // Контейнер создаётся в _buildAvatar: без него некуда вставлять акроним
        if (!this.wrap) return;

        // Удаляем старые элементы
        if (this.img) {
            this.img.remove();
            this.img = null;
        }
        if (this.acronym) {
            this.acronym.remove();
            this.acronym = null;
        }

        this._currentType = "acronym";

        this.acronym = document.createElement("span");
        this.acronym.className = "font-semibold text-[var(--color-white)] select-none";

        if (this.options.name) {
            const text = this.options.name
                .split(/\s/)
                .reduce((response, word) => response + word.slice(0, 1), "")
                .slice(0, 2)
                .toUpperCase();
            this.acronym.textContent = text || "?";
        } else {
            this.acronym.textContent = "?";
        }

        this.wrap.appendChild(this.acronym);

    }

    /**
     * ***************************************************************************
     * Добавление статуса
     * ***************************************************************************
     */
    _addStatus() {
        // Удаляем старый статус если есть
        if (this.status) {
            this.status.remove();
            this.status = null;
        }

        const statusConfig: Record<AvatarStatus, { classes: string }> = {
            online: { classes: "bg-green-500 dark:bg-green-400" },
            offline: { classes: "bg-gray-400 dark:bg-gray-500" },
            away: { classes: "bg-yellow-500 dark:bg-yellow-400" },
            busy: { classes: "bg-red-500 dark:bg-red-400" }
        };

        this.status = document.createElement("div");
        // Статус может быть не задан (null) — тогда фолбэк на offline
        const statusClass = (this.options.status && statusConfig[this.options.status]?.classes) || statusConfig.offline.classes;

        // Базовые классы для статуса
        const baseStatusClasses = "absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800";
        const fullStatusClasses = `${baseStatusClasses} ${statusClass}`;

        Avatars._addClasses(this.status, fullStatusClasses);

        // Добавляем position relative если его нет
        if (!this._element.classList.contains("relative")) {
            this._element.classList.add("relative");
        }

        this._element.appendChild(this.status);
    }

    /**
     * ***************************************************************************
     * Применение цвета
     * ***************************************************************************
     */
    _applyColor() {

        // Контейнер создаётся в _buildAvatar: без него красить нечего
        if (!this.wrap) return;
        const wrap = this.wrap;

        let colorClasses = null;

        if (this.options.id) {
            const hash = hashString(this.options.id);
            const colorIndex = Math.abs(hash) % Avatars.#colors.length;
            colorClasses = Avatars.#colors[colorIndex]?.class;
        } else if (this.options.name) {
            // Детерминированный цвет на основе имени
            const hash = hashString(this.options.name);
            const colorIndex = Math.abs(hash) % Avatars.#colors.length;
            colorClasses = Avatars.#colors[colorIndex]?.class;
        } else {
            // Случайный цвет
            const randomIndex = Math.floor(Math.random() * Avatars.#colors.length);
            colorClasses = Avatars.#colors[randomIndex]?.class;
        }

        // Применяем цвет только если нет изображения
        if (!this.options.image && colorClasses) {

            // Разбиваем классы
            const arrayClasses = colorClasses.split(" "); // разбиваем строку на массив классов

            // Добавляем классы
            arrayClasses.forEach(cls => {
                wrap.classList.add(cls);
            });

        }
    }

    /**
     * ***************************************************************************
     * Получение размера превью
     * ***************************************************************************
     */
    _getThumbSize() {

        // Получения размера миниатюры
        const thumbnails = this.options.image?.metadata?.thumbnails;
        let sizeQuery = getThumbnailSizeQuery(thumbnails, 400);

        return sizeQuery?.string || "";

    }

    /**
     * Установить иконку
     * ***************************************************************************
     * @param {string} iconName - Название иконки
     * ***************************************************************************
     */
    setIcon(iconName: string) {
        this.options.icon = iconName;
        this.options.image = null;
        this._createIcon();
        return this;
    }

    /**
     * Установить изображение
     * ***************************************************************************
     * @param {AvatarImageDocument} image - Документ с изображением
     * ***************************************************************************
     */
    setImage(image: AvatarImageDocument) {
        this.options.image = image;
        this.options.icon = null;
        this._createImage();
        return this;
    }

    /**
     * Установить имя (акроним)
     * ***************************************************************************
     * @param {string} name - Имя
     * ***************************************************************************
     */
    setName(name: string) {
        this.options.name = name;
        this.options.image = null;
        this.options.icon = null;
        this._createAcronym();
        return this;
    }

    /**
     * Установить статус
     * ***************************************************************************
     * @param {AvatarStatus} status - Статус (online, offline, away, busy)
     * ***************************************************************************
     */
    setStatus(status: AvatarStatus) {
        this.options.status = status;
        // Удаляем старый статус
        if (this.status) {
            this.status.remove();
            this.status = null;
        }
        if (status) {
            this._addStatus();
        }
        return this;
    }

    /**
     * ***************************************************************************
     * Установить размер
     * @param {AvatarSize} size - Размер
     * ***************************************************************************
     */
    setSize(size: AvatarSize) {
        // Удаляем старый размер
        Object.values(Avatars.#sizes).forEach(sizeClass => {
            Avatars._removeClasses(this._element, sizeClass);
        });

        this.options.size = size;
        const sizeClass = Avatars.#sizes[size] || Avatars.#sizes.md;
        Avatars._addClasses(this._element, sizeClass);

        // Пересоздаем содержимое с новым размером
        this._rebuildContent();
        return this;
    }

    /**
     * ***************************************************************************
     * Перестроить содержимое (для изменения размера)
     * ***************************************************************************
     */
    _rebuildContent() {
        const currentType = this._currentType;
        if (currentType === "image") {
            this._createImage();
        } else if (currentType === "icon") {
            this._createIcon();
        } else {
            this._createAcronym();
        }
    }

    /**
     * ***************************************************************************
     * Геттеры
     * ***************************************************************************
     */
    get dom() { return this._element; }
    get html() { return this._element.outerHTML; }

    toString() { return this.html; }

    /**
     * ***************************************************************************
     * Статический метод создания аватара
     * @param {AvatarOptions} options - Опции
     * ***************************************************************************
     */
    static create(options?: AvatarOptions) {
        return new Avatars(options);
    }

    /**
     * ***************************************************************************
     * Статический метод создания аватара с онлайн статусом
     * @param {AvatarOptions} options - Опции
     * ***************************************************************************
     */
    static online(options?: AvatarOptions) {
        return new Avatars({ ...options, status: "online" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания аватара с оффлайн статусом
     * @param {AvatarOptions} options - Опции
     * ***************************************************************************
     */
    static offline(options?: AvatarOptions) {
        return new Avatars({ ...options, status: "offline" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания аватара с статусом "отошел"
     * @param {AvatarOptions} options - Опции
     * ***************************************************************************
     */
    static away(options?: AvatarOptions) {
        return new Avatars({ ...options, status: "away" });
    }

    /**
     * ***************************************************************************
     * Статический метод создания аватара с статусом "занят"
     * @param {AvatarOptions} options - Опции
     * ***************************************************************************
     */
    static busy(options?: AvatarOptions) {
        return new Avatars({ ...options, status: "busy" });
    }
}
