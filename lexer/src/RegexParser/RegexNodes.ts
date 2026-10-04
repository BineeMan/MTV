import { DFAState } from "../DFA/DFAState.js";
import { SubsetConstruction } from "../DFA/SubsetConstruction.js";
import { NFAFragment } from "../NFA/NFAFragment.js";
import { NFAState } from "../NFA/NfaState.js";

export interface RegexNode {
    toNFA(): NFAFragment;
}

export class CharNode implements RegexNode {
    constructor(public readonly char: string){

    }

    public getCode() {
        const code = this.char.codePointAt(0);
        if (!code) {
            throw new Error("this.char.codePointAt(0) !code");
        }
        return code!;
    }

    toNFA(): NFAFragment {
        const start = new NFAState();
        const end = new NFAState();
        start.addTransition(this.char, end)
        return new NFAFragment(start, end);
    }
}

export class UnionNode implements RegexNode {
    constructor(private left: RegexNode, private right: RegexNode) {
    }

    toNFA(): NFAFragment {
        const leftNFA = this.left.toNFA();
        const rightNFA = this.right.toNFA();

        const start = new NFAState();
        const end = new NFAState();
        start.addTransition(null, leftNFA.start)
        start.addTransition(null, rightNFA.start)

        leftNFA.end.addTransition(null, end);
        rightNFA.end.addTransition(null, end);
        
        return new NFAFragment(start, end);
    }
}

export class ConcatNode implements RegexNode {
    constructor(private left: RegexNode, private right: RegexNode) {
    }

    toNFA(): NFAFragment {
        const leftNFA = this.left.toNFA();
        const rightNFA = this.right.toNFA();

        leftNFA.end.addTransition(null, rightNFA.start);
        return new NFAFragment(leftNFA.start, rightNFA.end);
    }
}

// a*
export class StarNode implements RegexNode {
    constructor(private child: RegexNode) {
    }

    toNFA(): NFAFragment {
        const childNFA = this.child.toNFA();

        const start = new NFAState();
        const end = new NFAState();
        
        start.addTransition(null, childNFA.start);
        start.addTransition(null, end);

        childNFA.end.addTransition(null, childNFA.start);
        childNFA.end.addTransition(null, end);

        return new NFAFragment(start, end);
    }
}

export class EpsilonNode implements RegexNode {
    toNFA(): NFAFragment {
        const start = new NFAState();
        const end = new NFAState();

        start.addTransition(null, end);
        return new NFAFragment(start, end);
    }
}