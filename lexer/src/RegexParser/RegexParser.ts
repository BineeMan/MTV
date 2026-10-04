import { CharNode, ConcatNode, EpsilonNode, StarNode, UnionNode, type RegexNode } from "./RegexNodes.js";

// expression → term | expression '|' term
// term       → factor | term factor
// factor     → atom | atom '*' | atom '+' | atom '?'
// atom       → LETTER | '(' expression ')' | '[' CharacterClass ']' | EscapedChar
// CharacterClass → ['^'] (CharOrEscapedChar '-' CharOrEscapedChar | CharOrEscapedChar)*

export class RegexParser {
    private pos = 0;

    constructor(private input: string, private alphabet: string[]) {}

    public parse(): RegexNode {
        return this.parseExpression();
    }

    // expression → term | expression '|' term
    private parseExpression(): RegexNode {
        let left = this.parseTerm();

        while (this.match('|')) {
            const right = this.parseTerm();
            left = new UnionNode(left, right);
        }
        return left;
    }

    // term → factor | term factor
    private parseTerm(): RegexNode {
        const nodes: Array<RegexNode> = new Array<RegexNode>();
        while (this.hasNext() && !this.check(')') && !this.check('|')) {
            nodes.push(this.parseFactor());
        }

        if (nodes.length === 0) {
            throw new Error("Empty term");
        }

        return nodes.reduce((acc, curr) => new ConcatNode(acc, curr));
    }

    // factor → atom | atom '*' | atom '+' | atom '?'
    private parseFactor(): RegexNode {
        let atom = this.parseAtom();
        if (this.match('*')) {
            return new StarNode(atom);
        } else if (this.match('+')) {
            return new ConcatNode(atom, new StarNode(atom));
        } else if (this.match('?')) {
            return new UnionNode(atom, new EpsilonNode());
        }
        return atom;
    }

    // atom → '(' expression ')' | '[' CharacterClass ']' | CharOrEscapedChar
    private parseAtom(): RegexNode {
        if (this.match('(')) {
            let node = this.parseExpression();
            this.expect(')');
            return node;
        }

        if (this.match('[')) {
            let node = this.parseCharacterClass();
            this.expect(']');
            return node;
        }

        return new CharNode(this.parseCharOrEscapedChar());
    }

    // CharOrEscapedChar -> LETTER | '\'n|t|r|s
    private parseCharOrEscapedChar(): string {
        if (this.match('\\')) {
            let char = this.nextChar();
            switch (char) {
                case 'n': return '\n';
                case 't': return '\t';
                case 'r': return '\r';
                case 's': return ' ';
                default: return char;
            }
        }

        return this.nextChar();
    }

    // CharacterClass → ['^'] (CharOrEscapedChar '-' CharOrEscapedChar | CharOrEscapedChar)*
    private parseCharacterClass(): RegexNode {
        let isNegated = false;

        if (this.match('^')) {
            isNegated = true;
        }

        let charSet = new Set<string>();

        while (this.hasNext() && !this.check(']')) {
            const charLeft = this.parseCharOrEscapedChar();
            if (this.check('-') && !this.checkNext(']')) {
                this.match('-');

                const charRight = this.parseCharOrEscapedChar();

                const startCode = charLeft.charCodeAt(0);
                const endCode = charRight.charCodeAt(0);

                if (startCode > endCode) {
                    throw new Error(`Invalid range in character class: ${charLeft}-${charRight}`);
                }

                for (let i = startCode; i <= endCode; i++) {
                    charSet.add(String.fromCharCode(i));
                }
            } else {
                charSet.add(charLeft);
            }
        }

        let finalSet = charSet;

        if (isNegated) {
            finalSet = new Set<string>();
            for (const char of this.alphabet) {
                if (!charSet.has(char)) {
                    finalSet.add(char);
                }
            }
        }

        return this.createUnionNodeFromSet(finalSet);
    }

    private createUnionNodeFromSet(charSet: Set<string>): RegexNode {
        const chars = Array.from(charSet);
        if (chars.length === 0) {
            throw new Error("Empty character class");
        }

        let node: RegexNode = new CharNode(chars[0]!);
        for (let i = 1; i < chars.length; i++) {
            node = new UnionNode(node, new CharNode(chars[i]!));
        }
        return node;
    }

    private hasNext(): boolean {
        return this.pos < this.input.length;
    }

    private check(char: string): boolean {
        return this.input[this.pos] === char;
    }

    private checkNext(char: string): boolean {
        if (this.pos + 1 >= this.input.length) {
            return false;
        }
        return this.input[this.pos + 1] === char;
    }

    private match(char: string): boolean {
        if (this.check(char)) {
            this.pos++;
            return true;
        }
        return false;
    }

    private expect(char: string) {
        if (!this.match(char)) {
            throw new Error(`Expected '${char}' at ${this.pos}`);
        }
    }

    private nextChar(): string {
        if (this.pos >= this.input.length) {
            throw new Error(`Unexpected end of input at position ${this.pos}`);
        }
        return this.input.charAt(this.pos++);
    }
}