// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ownVersion } from './own-version.js';

/**
 * Чем сделан отчёт.
 *
 * ОТКУДА. Опубликованное средство запустили по трём сайтам и прочли то, что оно
 * написало: пять полей верхнего уровня, и ни одного слова о том, что их
 * произвело. Ни версии средства, ни версии набора правил, ни браузера.
 *
 * Для вывода, который существует как доказательство, это не опрятность.
 * Заявление о доступности — то, что человек подписывает, и отчёт под ним обязан
 * говорить, чем он получен. Без этого находку нельзя отнести к набору правил, а
 * исправленный изъян — провести по отчётам, которые он испортил: за один месяц
 * несколько правил изменились, и ни один отчёт не скажет, по каким его считали.
 *
 * ВЕРСИЯ, КОТОРУЮ НЕ УДАЛОСЬ УЗНАТЬ, ГОВОРИТ ОБ ЭТОМ. Не опускается: пропущенное
 * поле читается как «правил не было», а это противоположно «правила были, а
 * какие — неизвестно». Тот же порядок, что у соседних средств: отсутствие
 * находок и невозможность искать — разные ответы.
 */
export interface Proiskhozhdenie {
	/** Имя средства, каким оно опубликовано. */
	readonly tool: string;
	/** Его версия, либо `unknown`, если прочесть не удалось. */
	readonly version: string;
	/** Версии пакетов правил и движка — по одной на пакет, `unknown` при неудаче. */
	readonly components: Readonly<Record<string, string>>;
	/** Когда снят отчёт. */
	readonly scannedAt: string;
}

/**
 * Отчёт, каким он ложится на диск: происхождение впереди содержимого.
 *
 * Названо один раз и здесь, чтобы место записи и сторож говорили об одной форме,
 * а не сходились на ней по совпадению.
 */
export type SProiskhozhdeniem<T> = T & { readonly producedBy: Proiskhozhdenie };

/** Пакеты, чья версия меняет то, что отчёт утверждает. */
const SOSTAVLYAYUSHCHIE = [
	'@ariada-org/core-engine',
	'@ariada-org/core-playwright',
	'@ariada-org/wcag-rules-extended',
];

/**
 * Опись пакета ищется по дереву каталогов, а не через разрешение имени.
 *
 * Разрешение спрашивает у пакета, что он выставляет наружу, и все три отвечают
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` — ни `<имя>/package.json`, ни даже точка входа
 * не открыты для чтения извне. Это их право; но версия от этого не перестаёт
 * существовать, и спросить её надо у файловой системы, а не у настроек вывоза.
 */
function versiyaPaketa(imya: string): string {
	try {
		let katalog = dirname(fileURLToPath(import.meta.url));
		for (let shag = 0; shag < 8; shag += 1) {
			const put = join(katalog, 'node_modules', imya, 'package.json');
			if (existsSync(put)) {
				const opis = JSON.parse(readFileSync(put, 'utf8')) as { version?: string };
				return typeof opis.version === 'string' ? opis.version : 'unknown';
			}
			const vyshe = dirname(katalog);
			if (vyshe === katalog) break;
			katalog = vyshe;
		}
		return 'unknown';
	}
	catch {
		// `unknown`, а не пропуск: пропущенная строка читается как «этого пакета не
		// было», и это утверждение сильнее и невернее, чем «версия не прочлась».
		return 'unknown';
	}
}

/**
 * @param seychas откуда берётся время — подставляется, чтобы отчёт был проверяем
 * @param sostavlyayushchie какие пакеты называть; подставляется затем, что в
 *   рабочем дереве читаются все три, и случай «версия не прочлась» иначе не
 *   воспроизвести. Ответ, который нельзя вызвать, нельзя и проверить: снятие
 *   запасного `unknown` оставляло сторожа зелёным, пока перечень был жёстким.
 */
export function proiskhozhdenie(
	seychas: () => Date = () => new Date(),
	sostavlyayushchie: readonly string[] = SOSTAVLYAYUSHCHIE,
): Proiskhozhdenie {
	const components: Record<string, string> = {};
	for (const imya of sostavlyayushchie) components[imya] = versiyaPaketa(imya);
	return {
		tool: '@ariada-org/cli',
		version: ownVersion(),
		components,
		scannedAt: seychas().toISOString(),
	};
}
