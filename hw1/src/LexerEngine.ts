import { DFAMinimizer } from "./DFA/DFAMinimizer.js";
import { DFAState } from "./DFA/DFAState.js";
import { SubsetConstruction } from "./DFA/SubsetConstruction.js";
import type { NFAFragment } from "./NFA/NFAFragment.js";
import { NFAState } from "./NFA/NfaState.js";
import { RegexParser } from "./RegexParser/RegexParser.js";
import type { Token } from "./Types/Token.js";
import type { TokenType } from "./Types/TokenType.js";
import type { TransitionTableExport } from "./Types/TransitionTableExport.js";

export class LexerEngine {

    private readonly nfa: NFAState;

    private readonly dfa: DFAState;

    private readonly dfaMinimized: DFAState;

    private readonly trapStateId : number = -1;

    constructor(
        private readonly regularExpressionsMap: Map<TokenType, string>,
        public readonly alphabet: string[]
    ) {
        this.nfa = this.buildNfa();
        this.dfa = SubsetConstruction.convert(this.nfa, alphabet);
        this.dfaMinimized = DFAMinimizer.minimize(this.dfa, alphabet);
    }

    private buildNfa() {
        const startState = new NFAState();
        let priority = 0;

        for (const [tokenType, regExpression] of this.regularExpressionsMap) {

            const parser = new RegexParser(regExpression);

            const nfa: NFAFragment = parser.parse().toNFA();

            nfa.end.isAccepting = true;
            nfa.end.tokenType = tokenType;
            nfa.end.priority = priority++;

            startState.addTransition(null, nfa.start);
        }
        return startState;
    }

    public tokenize(input: string) : Token[] {
        const tokens: Token[] = [];
        let currentPos = 0;

        while (currentPos < input.length) {
            let lastAcceptingPos = -1;
            let searchPos = currentPos;
            let lastAcceptingTokenType: TokenType | null = null;
            
            // Скользим по автомату
            let currentState: DFAState | null = this.dfaMinimized;
            while (searchPos < input.length && currentState !== null) {
                let currentChar: string = input[searchPos]!;
                currentState = currentState.getNeighborState(currentChar);
                
                if (currentState && currentState.isAccepting){
                    lastAcceptingTokenType = currentState.tokenType;
                    lastAcceptingPos = searchPos + 1;
                }
                searchPos++;
            }
            
            // Добавляем токен
            if (lastAcceptingTokenType !== null) {
                const tokenValue = input.slice(currentPos, lastAcceptingPos);
                tokens.push({
                    type: lastAcceptingTokenType,
                    value: tokenValue,
                    position: currentPos
                });  
                currentPos = lastAcceptingPos;
            }
            else {
                const errorChar = input[currentPos];
                throw new Error(`Lexical error: unexpected character '${errorChar}' at position ${currentPos}`);
            }
        }
        return tokens;
    }

    public exportTranstionTable() : TransitionTableExport {
        const transitions: Record<number, Record<string, number>> = {};
        const allStates : Map<DFAState, number> = this.dfaMinimized.getAllStatesMap();
        const acceptingStates: Record<number, TokenType> = {};

        for (const [state, idx] of allStates) {
            transitions[idx] = {};

            if (state.isAccepting && state.tokenType) {
                acceptingStates[idx] = state.tokenType;
            }

            for (const symbol of this.alphabet){
                const neightborState = state.getNeighborState(symbol);
                if (neightborState !== null) {
                    transitions[idx][symbol] = allStates.get(neightborState)!;
                }
                else{
                    transitions[idx][symbol] = this.trapStateId;
                }
            }
        }

        return {
            startState: allStates.get(this.dfaMinimized)!,
            trapState: this.trapStateId,
            acceptingStates,
            transitions
        }
    }
}