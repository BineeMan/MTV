export class Parser {
    private tokens: Token[];
    private current: number = 0;

    constructor(tokens: Token[]) {
        // Пропускаем мусорные токены (пробелы и комментарии)
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
    // Declarations (Функции и Формулы)
    // ==========================================

    private isFormulaDecl(): boolean {
        // Смотрим вперед: если после name(...) идет "=>", это формула
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

    private parseFunctionDecl(): FunctionDeclNode {
        const nameToken = this.expectIdent("Expected function name");
        this.expectOp("(");
        const params = this.parseVarDefList(")");
        
        let requires: LogicNode | undefined;
        if (this.matchKw("requires")) {
            requires = this.parseLogic();
        }

        this.expectKw("returns");
        const returns = this.parseVarDefList();

        let ensures: LogicNode | undefined;
        if (this.matchKw("ensures")) {
            ensures = this.parseLogic();
        }

        const uses: LocalVarDef[] = [];
        if (this.matchKw("uses")) {
            uses.push(...this.parseLocalVarDefList());
        }

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
        const nameToken = this.expectIdent("Expected formula name");
        this.expectOp("(");
        const params = this.parseVarDefList(")");
        this.expectOp("=>");
        const body = this.parseLogic();

        return {
            type: "FormulaDecl",
            name: nameToken.value,
            params,
            body,
            position: nameToken.position,
        };
    }

    // ==========================================
    // Statements (Операторы)
    // ==========================================

    private parseStatement(): StatementNode {
        if (this.matchKw("if")) return this.parseIfStmt();
        if (this.matchKw("while")) return this.parseWhileStmt();
        if (this.matchKw("assert")) return this.parseAssertStmt();
        if (this.matchKw("assume")) return this.parseAssumeStmt();
        if (this.checkOp("{")) return this.parseBlockStmt();

        return this.parseAssignmentStmt();
    }

    private parseAssignmentStmt(): AssignmentStmtNode {
        const startToken = this.peek();

        // 1. Проверяем присваивание массиву: a[i] = v; или a[i][j] = v;
        if (this.check(TokenType.IDENT) && this.lookaheadOp(1, "[")) {
            const arrayName = this.advance().value;
            const indices: ExpressionNode[] = [];

            while (this.matchOp("[")) {
                indices.push(this.parseExpr());
                this.expectOp("]");
            }

            this.expectOp("=");
            const valueExpr = this.parseExpr();
            this.expectOp(";");

            // Обессахаривание: a[i][j] = v -> a = set(a, i, set(a[i], j, v))
            let desugaredValue = valueExpr;
            for (let k = indices.length - 1; k >= 0; k--) {
                const indexExpr = indices[k];
                // Для вложенных уровней берем a[i1]...[ik-1] как целевой массив
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
                    args: [targetArrayExpr, indexExpr, desugaredValue],
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

        // 2. Обычное присваивание: x = expr; или множественный возврат: x, y = foo();
        const targets: string[] = [this.expectIdent().value];
        while (this.matchOp(",")) {
            targets.push(this.expectIdent().value);
        }

        this.expectOp("=");
        const value = this.parseExpr();
        this.expectOp(";");

        return {
            type: "AssignmentStmt",
            targets,
            value,
            position: startToken.position,
        };
    }

    private parseIfStmt(): IfStmtNode {
        const pos = this.previous().position;
        this.expectOp("(");
        const condition = this.parseLogic();
        this.expectOp(")");
        const thenBranch = this.parseStatement();

        let elseBranch: StatementNode | undefined;
        if (this.matchKw("else")) {
            elseBranch = this.parseStatement();
        }

        return { type: "IfStmt", condition, thenBranch, elseBranch, position: pos };
    }

    private parseWhileStmt(): WhileStmtNode {
        const pos = this.previous().position;
        this.expectOp("(");
        const condition = this.parseLogic();
        this.expectOp(")");

        let invariant: LogicNode | undefined;
        if (this.matchKw("invariant")) {
            invariant = this.parseLogic();
        }

        const body = this.parseStatement();

        return { type: "WhileStmt", condition, invariant, body, position: pos };
    }

    private parseBlockStmt(): BlockStmtNode {
        const pos = this.expectOp("{").position;
        const statements: StatementNode[] = [];

        while (!this.checkOp("}") && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }

        this.expectOp("}");
        return { type: "BlockStmt", statements, position: pos };
    }

    private parseAssertStmt(): AssertStmtNode {
        const pos = this.previous().position;
        const predicate = this.parseLogic();
        this.expectOp(";");
        return { type: "AssertStmt", predicate, position: pos };
    }

    private parseAssumeStmt(): AssumeStmtNode {
        const pos = this.previous().position;
        const predicate = this.parseLogic();
        this.expectOp(";");
        return { type: "AssumeStmt", predicate, position: pos };
    }

    // ==========================================
    // Logic & Predicates (Логические выражения)
    // ==========================================

    private parseLogic(): LogicNode {
        return this.parseImplication();
    }

    private parseImplication(): LogicNode {
        let left = this.parseOr();
        if (this.matchOp("->")) {
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
        while (this.matchKw("or") || this.matchOp("||")) {
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
        while (this.matchKw("and") || this.matchOp("&&")) {
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
        if (this.matchKw("not") || this.matchOp("!")) {
            const pos = this.previous().position;
            const operand = this.parseNot();
            return { type: "UnaryLogic", operator: "not", operand, position: pos };
        }
        return this.parsePrimaryLogic();
    }

    private parsePrimaryLogic(): LogicNode {
        const token = this.peek();

        // Булевы константы
        if (this.matchKw("true") || (token.type === TokenType.IDENT && token.value === "true")) {
            this.advance();
            return { type: "BooleanLiteral", value: true, position: token.position };
        }
        if (this.matchKw("false") || (token.type === TokenType.IDENT && token.value === "false")) {
            this.advance();
            return { type: "BooleanLiteral", value: false, position: token.position };
        }

        // Кванторы (forall / exists)
        if (this.matchKw("forall") || this.matchKw("exists")) {
            const quantifier = this.previous().value as "forall" | "exists";
            this.expectOp("(");
            const varName = this.expectIdent().value;
            this.expectOp(":");
            const varType = this.parseVarType();
            this.expectOp("|");
            const predicate = this.parseLogic();
            this.expectOp(")");
            return {
                type: "Quantifier",
                quantifier,
                variable: { name: varName, varType },
                predicate,
                position: token.position,
            };
        }

        // Скобки в логике
        if (this.matchOp("(")) {
            const expr = this.parseLogic();
            this.expectOp(")");
            return expr;
        }

        // Вызов формулы или сравнение выражений
        const expr = this.parseExpr();

        if (this.isComparisonOp(this.peek())) {
            const op = this.advance().value as "==" | "!=" | ">=" | "<=" | ">" | "<";
            const right = this.parseExpr();
            return {
                type: "Comparison",
                operator: op,
                left: expr,
                right,
                position: expr.position,
            };
        }

        // Если это просто вызов функции/формулы как предикат
        if (expr.type === "FunctionCall") {
            return {
                type: "FormulaRef",
                name: expr.name,
                args: expr.args,
                position: expr.position,
            };
        }

        throw new ParseError(`Expected comparison or predicate`, token.position);
    }

    // ==========================================
    // Expressions (Арифметика)
    // ==========================================

    private parseExpr(): ExpressionNode {
        return this.parseAdditive();
    }

    private parseAdditive(): ExpressionNode {
        let left = this.parseMultiplicative();
        while (this.checkOp("+") || this.checkOp("-")) {
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
        while (this.checkOp("*") || this.checkOp("/")) {
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
        if (this.matchOp("-")) {
            const pos = this.previous().position;
            const operand = this.parseUnary();
            return { type: "UnaryExpr", operator: "-", operand, position: pos };
        }
        return this.parsePrimaryExpr();
    }

    private parsePrimaryExpr(): ExpressionNode {
        const token = this.peek();

        // Число
        if (this.match(TokenType.INT)) {
            return { type: "Number", value: parseInt(token.value, 10), position: token.position };
        }

        // Идентификатор (Переменная, Вызов функции или Массив)
        if (this.check(TokenType.IDENT)) {
            const ident = this.advance();

            // Вызов функции: foo(a, b)
            if (this.matchOp("(")) {
                const args: ExpressionNode[] = [];
                if (!this.checkOp(")")) {
                    do {
                        args.push(this.parseExpr());
                    } while (this.matchOp(","));
                }
                this.expectOp(")");
                return { type: "FunctionCall", name: ident.value, args, position: ident.position };
            }

            let expr: ExpressionNode = { type: "VarRef", name: ident.value, position: ident.position };

            // Доступ к массиву: a[i][j]
            while (this.matchOp("[")) {
                const index = this.parseExpr();
                this.expectOp("]");
                expr = { type: "ArrayAccess", array: expr, index, position: ident.position };
            }

            return expr;
        }

        // Скобки: (expr)
        if (this.matchOp("(")) {
            const expr = this.parseExpr();
            this.expectOp(")");
            return expr;
        }

        throw new ParseError(`Unexpected token in expression: '${token.value}'`, token.position);
    }

    // ==========================================
    // Helpers (Служебные методы)
    // ==========================================

    private parseVarDefList(closeToken?: string): VarDef[] {
        const list: VarDef[] = [];
        if (closeToken && this.checkOp(closeToken)) {
            this.expectOp(closeToken);
            return list;
        }

        do {
            const name = this.expectIdent().value;
            this.expectOp(":");
            const varType = this.parseVarType();
            list.push({ name, varType });
        } while (this.matchOp(","));

        if (closeToken) this.expectOp(closeToken);
        return list;
    }

    private parseLocalVarDefList(): LocalVarDef[] {
        const list: LocalVarDef[] = [];
        do {
            const name = this.expectIdent().value;
            let varType: VarType | undefined;
            if (this.matchOp(":")) {
                varType = this.parseVarType();
            }
            list.push({ name, varType });
        } while (this.matchOp(","));
        return list;
    }

    private parseVarType(): VarType {
        this.expectKw("int");
        if (this.matchOp("[")) {
            this.expectOp("]");
            return "int[]";
        }
        return "int";
    }

    private peek(): Token {
        return this.tokens[this.current] || { type: TokenType.KEYWORD, value: "EOF", position: -1 };
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.tokens[this.current - 1];
    }

    private isAtEnd(): boolean {
        return this.current >= this.tokens.length;
    }

    private check(type: TokenType): boolean {
        return !this.isAtEnd() && this.peek().type === type;
    }

    private match(type: TokenType): boolean {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    private checkKw(value: string): boolean {
        return !this.isAtEnd() && this.peek().type === TokenType.KEYWORD && this.peek().value === value;
    }

    private matchKw(value: string): boolean {
        if (this.checkKw(value)) {
            this.advance();
            return true;
        }
        return false;
    }

    private checkOp(value: string): boolean {
        return !this.isAtEnd() && this.peek().type === TokenType.OPERATOR && this.peek().value === value;
    }

    private matchOp(value: string): boolean {
        if (this.checkOp(value)) {
            this.advance();
            return true;
        }
        return false;
    }

    private lookaheadOp(offset: number, value: string): boolean {
        const idx = this.current + offset;
        return idx < this.tokens.length && this.tokens[idx].type === TokenType.OPERATOR && this.tokens[idx].value === value;
    }

    private expectKw(value: string): Token {
        if (this.checkKw(value)) return this.advance();
        throw new ParseError(`Expected keyword '${value}', got '${this.peek().value}'`, this.peek().position);
    }

    private expectOp(value: string): Token {
        if (this.checkOp(value)) return this.advance();
        throw new ParseError(`Expected operator '${value}', got '${this.peek().value}'`, this.peek().position);
    }

    private expectIdent(msg = "Expected identifier"): Token {
        if (this.check(TokenType.IDENT)) return this.advance();
        throw new ParseError(`${msg}, got '${this.peek().value}'`, this.peek().position);
    }

    private isComparisonOp(token: Token): boolean {
        return (
            token.type === TokenType.OPERATOR &&
            ["==", "!=", ">=", "<=", ">", "<"].includes(token.value)
        );
    }
}