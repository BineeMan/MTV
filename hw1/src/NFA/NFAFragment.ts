import type { NFAState } from "./NfaState.js";


export class NFAFragment {
    constructor(public start: NFAState, public end: NFAState) {
    }
}