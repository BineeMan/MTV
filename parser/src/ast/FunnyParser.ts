import type { Token } from "../../../lexer/src/Types/Token.js";
import { TokenType } from "../../../lexer/src/Types/TokenType.js";
import type {
    // базовые
    Position,
    VarType,
    VarDef,
    LocalVarDef,

    // выражения
    NumberNode,
    VarRefNode,
    ArrayAccessNode,
    FunctionCallNode,
    BinaryExprNode,
    UnaryExprNode,
    ExpressionNode,

    // условия/предикаты
    BooleanLiteralNode,
    ComparisonNode,
    BinaryLogicNode,
    UnaryLogicNode,
    QuantifierNode,
    FormulaRefNode,
    LogicNode,

    // операторы
    AssignmentStmtNode,
    IfStmtNode,
    WhileStmtNode,
    BlockStmtNode,
    AssertStmtNode,
    AssumeStmtNode,
    StatementNode,

    // top-level
    FunctionDeclNode,
    FormulaDeclNode,
    ModuleNode,

    // объединение всех узлов
    ASTNode,
} from "./AstNodes.js";

export type * from "./AstNodes.js";

export class FunnyParser {
    private current: number = 0;

    constructor(private tokens: Token[]) {
    }

    public parse(): ModuleNode {
        const startPos = this.peek().position;
        const functions: FunctionDeclNode[] = [];
        const formulas: FormulaDeclNode[] = []
        while (!this.isAtEnd()) {
            if (this.isFormulaDecl()) {
                formulas.push(parseFormula());
            }
            else {
                functions.push(parseFunction());
            }
        }
    }

    private isFormulaDecl(): boolean {
        // Смотрим вперед: если после name(...) идет "=>", это формула
        let lookahead = this.current;
        if (this.tokens[lookahead]?.type !== TokenType.IDENT) return false;
        lookahead++;
        if (this.tokens[lookahead]?.value !== "(") return false;

        let depth = 1;
        lookahead++;
        while (lookahead < this.tokens.length && depth > 0) {
            if (this.tokens[lookahead]?.value === "(") depth++;
            if (this.tokens[lookahead]?.value === ")") depth--;
            lookahead++;
        }
        return this.tokens[lookahead]?.value === "=>";
    }

    private peek(): Token {
        return this.tokens[this.current] || { type: TokenType.KEYWORD, value: "EOF", position: -1 }
    }

    private isAtEnd(): boolean {
        return this.current >= this.tokens.length;
    }
}