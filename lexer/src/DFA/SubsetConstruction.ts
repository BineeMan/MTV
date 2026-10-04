import type { NFAState } from "../NFA/NfaState.js";
import { DFAState } from "./DFAState.js";

export class SubsetConstruction {
    private static epsilonClosure(nfaStates: Set<NFAState>): Set<NFAState> {
        const closure = new Set<NFAState>(nfaStates);
        const stack = Array.from(nfaStates);
        
        while (stack.length > 0) {
            const state = stack.pop()!;
            
            const epsilonTransitions = state.transitions.get(null) || [];

            for (const nextState of epsilonTransitions) {
                if (closure.has(nextState)) {
                    continue;
                }
                closure.add(nextState);
                stack.push(nextState);
            }

        }

        return closure;
    }

    private static move(nfaStates: Set<NFAState>, symbol: string) : Set<NFAState> {
        const result = new Set<NFAState>;
        
        for (const state of nfaStates) {
            const transitions = state.getTransition(symbol);
            for (const transition of transitions) {
                result.add(transition);
            }
        }

        return result;
    }

    private static getStatesKey(states: Set<NFAState>): string {
        return Array.from(states)
        .map(s => s.id)
        .sort((a, b) => a - b)
        .join(',');
    }
    
    public static convert(nfaStart: NFAState, alphabet: Array<string>): DFAState {
        const initialClosure : Set<NFAState> = this.epsilonClosure(new Set<NFAState>([nfaStart]));
        
        const dfaStatesMap = new Map<string, DFAState>();
        const startDFA : DFAState = new DFAState(initialClosure);
        
        dfaStatesMap.set(this.getStatesKey(initialClosure), startDFA);
        
        const queue = Array.from([startDFA]);
        
        while (queue.length > 0) {
            const currentDFA : DFAState = queue.shift()!;
            for (const symbol of alphabet) {
                const moveResult : Set<NFAState> = this.move(currentDFA.nfaStates, symbol);
                if (moveResult.size == 0) {
                    continue;
                }

                const closureResult : Set<NFAState> = this.epsilonClosure(moveResult);
                if (closureResult.size == 0) {
                    continue;
                }

                const key : string = this.getStatesKey(closureResult);
                let targetDfa = dfaStatesMap.get(key);
                if (!targetDfa) {
                    targetDfa = new DFAState(closureResult);
                    dfaStatesMap.set(key, targetDfa);
                    queue.push(targetDfa)
                }
                currentDFA.setTransition(symbol, targetDfa);
            }
        }
        return startDFA;
    }
}