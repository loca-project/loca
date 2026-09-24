/** 英語リソースの型。未定義のキーは日本語にフォールバックするので、すべて省略できる形にする。 */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
