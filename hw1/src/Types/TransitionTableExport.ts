import type { TokenType } from "./TokenType.js";

export interface TransitionTableExport {
    startState: number;
    trapState: number;
    acceptingStates: Record<number, TokenType>;
    transitions: Record<number, Record<string, number>>;
}