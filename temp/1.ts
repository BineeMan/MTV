import {
    Token,
    TokenType,
    VarType,
    VarDef,
    LocalVarDef,
    ExpressionNode,
    LogicNode,
    StatementNode,
    FunctionDeclNode,
    FormulaDeclNode,
    ModuleNode,
    AssignmentStmtNode,
    IfStmtNode,
    WhileStmtNode,
    BlockStmtNode,
    AssertStmtNode,
    AssumeStmtNode,
    ParseError
} from "./ast";

export class Parser {
    private tokens: Token[];
    private current: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens.filter(
            (t) => t.type !== TokenType.WS && t.type !== TokenType.COMMENT
        );
    }

    public parse(): ModuleNode {
        const startPos = this.peek().position;
        const functions: FunctionDeclNode[] = [];
        const formulas: FormulaDeclNode[] = [];

        while (!this.isAtEnd()) {
            if (this.isFormulaDecl()) {
                formulas.push(this.parseFormulaDecl());
            } else {
                functions.push(this.parseFunctionDecl());
            }
        }

        return { type: "Module", functions, formulas, position: startPos };
    }

    // ==========================================
    // 1. Declarations (Объявления)
    // ==========================================

    private parseFunctionDecl(): FunctionDeclNode {
        const nameToken = this.expect(TokenType.IDENT, undefined, "Expected function name");
        
        this.expect(TokenType.OPERATOR, "(");
        const params = this.parseVarDefList(")");

        const requires = this.parseRequiresClause();

        this.expect(TokenType.KEYWORD, "returns");
        const returns = this.parseVarDefList();

        const ensures = this.parseEnsuresClause();
        const uses = this.parseUsesClause();
        const body = this.parseStatement();

        return {
            type: "FunctionDecl",
            name: nameToken.value,
            params,
            returns,
            requires,
            ensures,
            uses,
            body,
            position: nameToken.position,
        };
    }

    private parseFormulaDecl(): FormulaDeclNode {
        const nameToken = this.expect(TokenType.IDENT, undefined, "Expected formula name");
        
        this.expect(TokenType.OPERATOR, "(");
        const params = this.parseVarDefList(")");
        this.expect(TokenType.OPERATOR, "=>");
        const body = this.parseLogic();

        return {
            type: "FormulaDecl",
            name: nameToken.value,
            params,
            body,
            position: nameToken.position,
        };
    }

    private parseRequiresClause(): LogicNode | undefined {
        if (this.match(TokenType.KEYWORD, "requires")) {
            return this.parseLogic();
        }
        return undefined;
    }

    private parseEnsuresClause(): LogicNode | undefined {
        if (this.match(TokenType.KEYWORD, "ensures")) {
            return this.parseLogic();
        }
        return undefined;
    }

    private parseUsesClause(): LocalVarDef[] {
        if (this.match(TokenType.KEYWORD, "uses")) {
            return this.parseLocalVarDefList();
        }
        return [];
    }

    // ==========================================
    // 2. Variable Definitions (Переменные и Типы)
    // ==========================================

    private parseVarDefList(closeOp?: string): VarDef[] {
        const varDefList: VarDef[] = [];

        if (closeOp && this.check(TokenType.OPERATOR, closeOp)) {
            this.expect(TokenType.OPERATOR, closeOp);
            return varDefList;
        }

        do {
            varDefList.push(this.parseVarDef());
        } while (this.match(TokenType.OPERATOR, ","));

        if (closeOp) {
            this.expect(TokenType.OPERATOR, closeOp);
        }

        return varDefList;
    }

    private parseVarDef(): VarDef {
        const name = this.expect(TokenType.IDENT, undefined, "Expected var name");
        this.expect(TokenType.OPERATOR, ":");
        const varType: VarType = this.parseVarType();
        return { name: name.value, varType };
    }

    private parseLocalVarDefList(): LocalVarDef[] {
        const list: LocalVarDef[] = [];
        do {
            list.push(this.parseLocalVarDef());
        } while (this.match(TokenType.OPERATOR, ","));
        return list;
    }

    private parseLocalVarDef(): LocalVarDef {
        const name = this.expect(TokenType.IDENT, undefined, "Expected local var name").value;
        let varType: VarType | undefined;

        if (this.match(TokenType.OPERATOR, ":")) {
            varType = this.parseVarType();
        }

        return { name, varType };
    }

    private parseVarType(): VarType {
        this.expect(TokenType.KEYWORD, "int");
        if (this.match(TokenType.OPERATOR, "[")) {
            this.expect(TokenType.OPERATOR, "]");
            return "int[]";
        }
        return "int";
    }

    // ==========================================
    // 3. Statements (Операторы)
    // ==========================================

    private parseStatement(): StatementNode {
        if (this.match(TokenType.KEYWORD, "if")) return this.parseIfStmt();
        if (this.match(TokenType.KEYWORD, "while")) return this.parseWhileStmt();
        if (this.match(TokenType.KEYWORD, "assert")) return this.parseAssertStmt();
        if (this.match(TokenType.KEYWORD, "assume")) return this.parseAssumeStmt();
        if (this.check(TokenType.OPERATOR, "{")) return this.parseBlockStmt();

        return this.parseAssignmentStmt();
    }

    private parseAssignmentStmt(): AssignmentStmtNode {
        const startToken = this.peek();

        // Доступ к массиву: a[i] = v; или a[i][j] = v;
        if (this.check(TokenType.IDENT) && this.lookahead(1, TokenType.OPERATOR, "[")) {
            return this.parseArrayAssignmentStmt(startToken);
        }

        // Обычное присваивание: x = v; или x, y = fn();
        const targets: string[] = [
            this.expect(TokenType.IDENT, undefined, "Expected variable name").value
        ];

        while (this.match(TokenType.OPERATOR, ",")) {
            targets.push(this.expect(TokenType.IDENT, undefined, "Expected variable name").value);
        }

        this.expect(TokenType.OPERATOR, "=");
        const value = this.parseExpr();
        this.expect(TokenType.OPERATOR, ";");

        return {
            type: "AssignmentStmt",
            targets,
            value,
            position: startToken.position,
        };
    }

    private parseArrayAssignmentStmt(startToken: Token): AssignmentStmtNode {
        const arrayName = this.advance().value;
        const indices: ExpressionNode[] = [];

        while (this.match(TokenType.OPERATOR, "[")) {
            indices.push(this.parseExpr());
            this.expect(TokenType.OPERATOR, "]");
        }

        this.expect(TokenType.OPERATOR, "=");
        const valueExpr = this.parseExpr();
        this.expect(TokenType.OPERATOR, ";");

        // Обессахаривание: a[i][j] = v -> a = set(a, i, set(a[i], j, v))
        let desugaredValue = valueExpr;
        for (let k = indices.length - 1; k >= 0; k--) {
            let targetArrayExpr: ExpressionNode = {
                type: "VarRef",
                name: arrayName,
                position: startToken.position,
            };

            for (let m = 0; m < k; m++) {
                targetArrayExpr = {
                    type: "ArrayAccess",
                    array: targetArrayExpr,
                    index: indices[m],
                    position: startToken.position,
                };
            }

            desugaredValue = {
                type: "FunctionCall",
                name: "set",
                args: [targetArrayExpr, indices[k], desugaredValue],
                position: startToken.position,
            };
        }

        return {
            type: "AssignmentStmt",
            targets: [arrayName],
            value: desugaredValue,
            position: startToken.position,
        };
    }

    private parseIfStmt(): IfStmtNode {
        const pos = this.previous().position;
        this.expect(TokenType.OPERATOR, "(");
        const condition = this.parseLogic();
        this.expect(TokenType.OPERATOR, ")");
        
        const thenBranch = this.parseStatement();
        let elseBranch: StatementNode | undefined;

        if (this.match(TokenType.KEYWORD, "else")) {
            elseBranch = this.parseStatement();
        }

        return { type: "IfStmt", condition, thenBranch, elseBranch, position: pos };
    }

    private parseWhileStmt(): WhileStmtNode {
        const pos = this.previous().position;
        this.expect(TokenType.OPERATOR, "(");
        const condition = this.parseLogic();
        this.expect(TokenType.OPERATOR, ")");

        let invariant: LogicNode | undefined;
        if (this.match(TokenType.KEYWORD, "invariant")) {
            invariant = this.parseLogic();
        }

        const body = this.parseStatement();

        return { type: "WhileStmt", condition, invariant, body, position: pos };
    }

    private parseBlockStmt(): BlockStmtNode {
        const pos = this.expect(TokenType.OPERATOR, "{").position;
        const statements: StatementNode[] = [];

        while (!this.check(TokenType.OPERATOR, "}") && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }

        this.expect(TokenType.OPERATOR, "}");
        return { type: "BlockStmt", statements, position: pos };
    }

    private parseAssertStmt(): AssertStmtNode {
        const pos = this.previous().position;
        const predicate = this.parseLogic();
        this.expect(TokenType.OPERATOR, ";");
        return { type: "AssertStmt", predicate, position: pos };
    }

    private parseAssumeStmt(): AssumeStmtNode {
        const pos = this.previous().position;
        const predicate = this.parseLogic();
        this.expect(TokenType.OPERATOR, ";");
        return { type: "AssumeStmt", predicate, position: pos };
    }

    // ==========================================
    // 4. Logic & Predicates (Логические выражения)
    // ==========================================

    private parseLogic(): LogicNode {
        return this.parseImplication();
    }

    private parseImplication(): LogicNode {
        let left = this.parseOr();

        if (this.match(TokenType.OPERATOR, "->")) {
            const right = this.parseImplication(); // Правая ассоциативность
            return {
                type: "BinaryLogic",
                operator: "->",
                left,
                right,
                position: left.position,
            };
        }

        return left;
    }

    private parseOr(): LogicNode {
        let left = this.parseAnd();

        while (this.match(TokenType.OPERATOR, "or")) {
            const right = this.parseAnd();
            left = {
                type: "BinaryLogic",
                operator: "or",
                left,
                right,
                position: left.position,
            };
        }

        return left;
    }

    private parseAnd(): LogicNode {
        let left = this.parseNot();

        while (this.match(TokenType.OPERATOR, "and")) {
            const right = this.parseNot();
            left = {
                type: "BinaryLogic",
                operator: "and",
                left,
                right,
                position: left.position,
            };
        }

        return left;
    }

    private parseNot(): LogicNode {
        if (this.match(TokenType.OPERATOR, "not")) {
            const pos = this.previous().position;
            const operand = this.parseNot();
            return { type: "UnaryLogic", operator: "not", operand, position: pos };
        }

        return this.parsePrimaryLogic();
    }

    private parsePrimaryLogic(): LogicNode {
        const token = this.peek();

        if (this.match(TokenType.KEYWORD, "true")) {
            return { type: "BooleanLiteral", value: true, position: token.position };
        }
        if (this.match(TokenType.KEYWORD, "false")) {
            return { type: "BooleanLiteral", value: false, position: token.position };
        }

        if (this.check(TokenType.KEYWORD, "forall") || this.check(TokenType.KEYWORD, "exists")) {
            return this.parseQuantifier();
        }

        if (this.match(TokenType.OPERATOR, "(")) {
            const expr = this.parseLogic();
            this.expect(TokenType.OPERATOR, ")");
            return expr;
        }

        const expr = this.parseExpr();

        if (this.isComparisonOp(this.peek().value)) {
            const opToken = this.advance();
            const right = this.parseExpr();
            return {
                type: "Comparison",
                operator: opToken.value as "==" | "!=" | ">=" | "<=" | ">" | "<",
                left: expr,
                right,
                position: expr.position,
            };
        }

        if (expr.type === "FunctionCall") {
            return {
                type: "FormulaRef",
                name: expr.name,
                args: expr.args,
                position: expr.position,
            };
        }

        throw new ParseError(`Expected predicate or comparison at pos ${token.position}`, token.position);
    }

    private parseQuantifier(): LogicNode {
        const token = this.advance();
        const quantifier = token.value as "forall" | "exists";

        this.expect(TokenType.OPERATOR, "(");
        const varName = this.expect(TokenType.IDENT, undefined, "Expected quantifier variable").value;
        this.expect(TokenType.OPERATOR, ":");
        const varType = this.parseVarType();
        this.expect(TokenType.OPERATOR, "|");
        const predicate = this.parseLogic();
        this.expect(TokenType.OPERATOR, ")");

        return {
            type: "Quantifier",
            quantifier,
            variable: { name: varName, varType },
            predicate,
            position: token.position,
        };
    }

    // ==========================================
    // 5. Arithmetic Expressions (Арифметика)
    // ==========================================

    private parseExpr(): ExpressionNode {
        return this.parseAdditive();
    }

    private parseAdditive(): ExpressionNode {
        let left = this.parseMultiplicative();

        while (this.check(TokenType.OPERATOR, "+") || this.check(TokenType.OPERATOR, "-")) {
            const op = this.advance().value as "+" | "-";
            const right = this.parseMultiplicative();
            left = {
                type: "BinaryExpr",
                operator: op,
                left,
                right,
                position: left.position,
            };
        }

        return left;
    }

    private parseMultiplicative(): ExpressionNode {
        let left = this.parseUnary();

        while (this.check(TokenType.OPERATOR, "*") || this.check(TokenType.OPERATOR, "/")) {
            const op = this.advance().value as "*" | "/";
            const right = this.parseUnary();
            left = {
                type: "BinaryExpr",
                operator: op,
                left,
                right,
                position: left.position,
            };
        }

        return left;
    }

    private parseUnary(): ExpressionNode {
        if (this.match(TokenType.OPERATOR, "-")) {
            const pos = this.previous().position;
            const operand = this.parseUnary();
            return { type: "UnaryExpr", operator: "-", operand, position: pos };
        }

        return this.parsePrimaryExpr();
    }

    private parsePrimaryExpr(): ExpressionNode {
        const token = this.peek();

        if (this.match(TokenType.INT)) {
            return { type: "Number", value: parseInt(token.value, 10), position: token.position };
        }

        if (this.check(TokenType.IDENT)) {
            const ident = this.advance();

            // Вызов функции: foo(...)
            if (this.match(TokenType.OPERATOR, "(")) {
                const args: ExpressionNode[] = [];
                if (!this.check(TokenType.OPERATOR, ")")) {
                    do {
                        args.push(this.parseExpr());
                    } while (this.match(TokenType.OPERATOR, ","));
                }
                this.expect(TokenType.OPERATOR, ")");
                return { type: "FunctionCall", name: ident.value, args, position: ident.position };
            }

            // Переменная или доступ к массиву: a или a[i]
            let expr: ExpressionNode = { type: "VarRef", name: ident.value, position: ident.position };

            while (this.match(TokenType.OPERATOR, "[")) {
                const index = this.parseExpr();
                this.expect(TokenType.OPERATOR, "]");
                expr = { type: "ArrayAccess", array: expr, index, position: ident.position };
            }

            return expr;
        }

        if (this.match(TokenType.OPERATOR, "(")) {
            const expr = this.parseExpr();
            this.expect(TokenType.OPERATOR, ")");
            return expr;
        }

        throw new ParseError(`Unexpected token in expression: '${token.value}'`, token.position);
    }

    // ==========================================
    // 6. Universal Smart Helpers (Универсальные хелперы)
    // ==========================================

    private check(type: TokenType, val?: string): boolean {
        if (this.isAtEnd()) return false;
        const token = this.peek();
        if (token.type !== type) return false;
        if (val !== undefined && token.value !== val) return false;
        return true;
    }

    private match(type: TokenType, val?: string): boolean {
        if (this.check(type, val)) {
            this.advance();
            return true;
        }
        return false;
    }

    private expect(type: TokenType, val?: string, msg?: string): Token {
        if (this.check(type, val)) return this.advance();

        const expected = val ? `'${val}' (${type})` : type;
        const got = `'${this.peek().value}' (${this.peek().type})`;
        throw new ParseError(
            msg || `Expected ${expected}, got ${got}`,
            this.peek().position
        );
    }

    private lookahead(offset: number, type: TokenType, val?: string): boolean {
        const idx = this.current + offset;
        if (idx >= this.tokens.length) return false;
        const token = this.tokens[idx];
        if (token.type !== type) return false;
        if (val !== undefined && token.value !== val) return false;
        return true;
    }

    private isFormulaDecl(): boolean {
        let lookahead = this.current;
        if (this.tokens[lookahead]?.type !== TokenType.IDENT) return false;
        lookahead++;
        if (this.tokens[lookahead]?.value !== "(") return false;

        let depth = 1;
        lookahead++;
        while (lookahead < this.tokens.length && depth > 0) {
            if (this.tokens[lookahead].value === "(") depth++;
            if (this.tokens[lookahead].value === ")") depth--;
            lookahead++;
        }

        return this.tokens[lookahead]?.value === "=>";
    }

    private isComparisonOp(val: string): boolean {
        return ["==", "!=", ">=", "<=", ">", "<"].includes(val);
    }

    private peek(): Token {
        return this.tokens[this.current] || { type: TokenType.KEYWORD, value: "EOF", position: -1 };
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.current >= this.tokens.length;
    }
}