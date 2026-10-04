import type { TokenType } from "../Types/TokenType.js";

export class NFAState {
    public static idCounter: number = 0;

    public id: number;

    public readonly transitions: Map<string | null, Set<NFAState>> = new Map<string | null, Set<NFAState>>();

    public tokenType: TokenType | null = null;

    public priority: number = Infinity;

    public isAccepting: boolean = false;

    constructor() {
        this.id = NFAState.idCounter++;
    }

    public addTransition(symbol: string | null, target: NFAState): void {
        if (!this.transitions.has(symbol)) {
            this.transitions.set(symbol, new Set<NFAState>);
        }
        this.transitions.get(symbol)?.add(target);
    }
    
    public findEpsilonTransitions() : Set<NFAState> {
        return this.transitions.get(null) ?? new Set<NFAState>;
    }

    public getTransition(symbol: string) : Set<NFAState>  {
        return this.transitions.get(symbol) ?? new Set<NFAState>;
    }
}