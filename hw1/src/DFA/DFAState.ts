import type { NFAState } from "../NFA/NfaState.js";
import type { TokenType } from "../Types/TokenType.js";

export class DFAState {
    public static idCounter = 0;
    public id: number;
    public nfaStates: Set<NFAState>;

    public readonly transitions: Map<string, DFAState> = new Map();

    public isAccepting: boolean = false;
    public tokenType: TokenType | null = null;
    public priority: number = Infinity;


    constructor(nfaStates: Set<NFAState> = new Set<NFAState>) {
        this.id = DFAState.idCounter++;
        this.nfaStates = nfaStates;
        this.analyzeAccepting();

    }

    private analyzeAccepting(): void {
        for (const nfaState of this.nfaStates) {
            if (nfaState.isAccepting || nfaState.tokenType !== null) {
                this.isAccepting = true;
                if (nfaState.priority < this.priority) {
                    this.priority = nfaState.priority;
                    this.tokenType = nfaState.tokenType;
                }
            }
        }
    }

    public setTransition(symbol: string, DfaState: DFAState) {
        this.transitions.set(symbol, DfaState);
    }

    public getNeighborState(symbol: string) {
        return this.transitions.get(symbol) ?? null;
    }

    public getAllStates(): Set<DFAState> {
        const visited = new Set<DFAState>([this]);
        const stack : Array<DFAState> = Array.from([this]);

        while (stack.length > 0) {
            const currentState : DFAState = stack.pop()!;

            for (const state of currentState.transitions.values()) {
                if (visited.has(state)) {
                    continue;
                }
                stack.push(state);
                visited.add(state);
            }
        }
        return visited;
    }

    public getAllStatesMap(): Map<DFAState, number> {
        const visited = new Map<DFAState, number>();
        visited.set(this, 0);
        let counter = 1;
        const stack : Array<DFAState> = Array.from([this]);

        while (stack.length > 0) {
            const currentState : DFAState = stack.pop()!;

            for (const state of currentState.transitions.values()) {
                if (visited.has(state)) {
                    continue;
                }
                stack.push(state);
                visited.set(state, counter++);
            }
        }
        return visited;
    }
}