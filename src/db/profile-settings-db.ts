export type SQLiteBindValue = string | number | null;
export type SQLiteBindParams = SQLiteBindValue[] | Record<string, SQLiteBindValue>;
export const PROFILE_SETTINGS_SINGLETON_ID = "profile";

export interface SQLiteExecutor {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  runAsync(source: string, params: SQLiteBindParams): Promise<unknown>;
}
