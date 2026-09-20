import { TokenType } from "../Types/TokenType.js";
import { DFAState } from "./DFAState.js";

export class DFAMinimizer {
    private static getGroupsByTokenType(dfaStates: Set<DFAState>): Map<TokenType | null, Set<DFAState>> {
        const groupsByTokenType = new Map<TokenType | null, Set<DFAState>>();
        for (const state of dfaStates) {
            const key = state.isAccepting ? state.tokenType : null;
            if (!groupsByTokenType.has(key)) {
                groupsByTokenType.set(key, new Set<DFAState>);
            }
            groupsByTokenType.get(key)!.add(state);
        }
        return groupsByTokenType;
    }



    public static minimize(startState: DFAState, alphabet: Array<string>): DFAState {
        const allStates: Set<DFAState> = startState.getAllStates();

        let partitions = new Set<Set<DFAState>>(
            this.getGroupsByTokenType(allStates).values()
        );

        const queue: Array<Set<DFAState>> = Array.from(partitions);

        while (queue.length > 0) {
            const A: Set<DFAState> = queue.shift()!; // A
            
            // Защита от удаленных групп
            if (!partitions.has(A)) {
                continue;
            }

            for (const symbol of alphabet) {
                // Ищем все состояния автомата, которые по символу попадают в A (currentPartition)
                const X = new Set<DFAState>();
                for (const state of allStates) {
                    const targetState = state.getNeighborState(symbol);
                    if (targetState && A.has(targetState)) {
                        X.add(state);
                    }
                }
                
                const nextPartitions : Set<Set<DFAState>> = new Set<Set<DFAState>>();
                for (const Y of partitions) {
                    const intersectionXY = Y.intersection(X);
                    if (intersectionXY.size > 0 && intersectionXY.size < Y.size) {
                        // Расщепляем Y на X-Y и X and Y
                        const differenceYX = Y.difference(X);

                        nextPartitions.add(differenceYX);
                        nextPartitions.add(intersectionXY);

                        queue.push(differenceYX);
                        queue.push(intersectionXY);
                    }
                    else {
                        nextPartitions.add(Y);
                    }
                }
                partitions = nextPartitions;
            }
        }

        // Собираем новый ДКА
        const groupToNewStateMap = new Map<Set<DFAState>, DFAState>();
        const oldToNewState = new Map<DFAState, DFAState>();

        let newIdCounter = 0;
        let newStartState: DFAState | null = null;

        // Создаем новое состояние на каждую группу старых состояний
        for (const group of partitions) {
            const newState = new DFAState();
            newState.id = newIdCounter++;

            // Берем данные из первого состояния
            const representative : DFAState = group.values().next().value!;
            newState.isAccepting = representative.isAccepting;
            newState.tokenType = representative.tokenType;
            newState.priority = representative.priority;
            
            groupToNewStateMap.set(group, newState);

            for (const oldState of group) {
                oldToNewState.set(oldState, newState);
                if (oldState === startState) {
                    newStartState = newState;
                }
            }
        }

        //
        for (const [group, newState] of groupToNewStateMap) {
            const representative: DFAState = group.values().next().value!;
            // for (const symbol of alphabet) {
            //     const targetOldState = representative.getNeighborState(symbol);
            //     if (targetOldState) {
            //         const targetNewState = oldToNewState.get(targetOldState)!;
            //         newState.setTransition(symbol, targetNewState)
            //     }
            // }
            for (const [symbol, stateTo] of representative.transitions) {
                newState.setTransition(symbol, oldToNewState.get(stateTo)!);
            }
        }

        return newStartState!;
    }
}