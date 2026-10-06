export interface Position {
    position: number;
}

export type VarType = 'int' | 'int[]';

export interface VarDef {
    name: string;
    varType: VarType | undefined;
}

export interface LocalVarDef {
    name: string;
    varType?: VarType | undefined; // тип опционален
}

// --- Expressions ---

export interface NumberNode extends Position {
    type: "Number";
    value: number;
}

export interface VarRefNode extends Position {
    type: "VarRef";
    name: string;
}

export interface ArrayAccessNode extends Position {
    type: "ArrayAccess";
    array: ExpressionNode; 
    index: ExpressionNode;
}

export interface FunctionCallNode extends Position {
    type: "FunctionCall";
    name: string;
    args: ExpressionNode[];
}

export interface BinaryExprNode extends Position {
    type: "BinaryExpr";
    operator: "+" | "-" | "*" | "/";
    left: ExpressionNode;
    right: ExpressionNode;
}

export interface UnaryExprNode extends Position {
    type: "UnaryExpr";
    operator: "-";
    operand: ExpressionNode;
}

export type ExpressionNode =
    | NumberNode
    | VarRefNode
    | ArrayAccessNode
    | FunctionCallNode
    | BinaryExprNode
    | UnaryExprNode;

// --- Conditions Predicates ---

export interface BooleanLiteralNode extends Position {
    type: "BooleanLiteral";
    value: boolean;
}

export interface ComparisonNode extends Position {
    type: "Comparison";
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    left: ExpressionNode;
    right: ExpressionNode;
}

export interface BinaryLogicNode extends Position {
    type: "BinaryLogic";
    operator: "and" | "or" | "->";
    left: LogicNode;
    right: LogicNode;
}

export interface UnaryLogicNode extends Position {
    type: "UnaryLogic";
    operator: "not";
    operand: LogicNode;
}

export interface QuantifierNode extends Position {
    type: "Quantifier";
    quantifier: "forall" | "exists";
    variable: VarDef;
    predicate: LogicNode;
}

export interface FormulaRefNode extends Position {
    type: "FormulaRef";
    name: string;
    args: ExpressionNode[];
}

export type LogicNode =
    | BooleanLiteralNode
    | ComparisonNode
    | BinaryLogicNode
    | UnaryLogicNode
    | QuantifierNode
    | FormulaRefNode;

// --- Statements ---

export interface AssignmentStmtNode extends Position {
    type: "AssignmentStmt";
    targets: string[];
    value: ExpressionNode;
}

export interface IfStmtNode extends Position {
    type: "IfStmt";
    condition: LogicNode;
    thenBranch: StatementNode;
    elseBranch?: StatementNode | undefined;
}

export interface WhileStmtNode extends Position {
    type: "WhileStmt";
    condition: LogicNode;
    invariant?: LogicNode | undefined;
    body: StatementNode;
}

export interface BlockStmtNode extends Position {
    type: "BlockStmt";
    statements: StatementNode[];
}

export interface AssertStmtNode extends Position {
    type: "AssertStmt";
    predicate: LogicNode;
}

export interface AssumeStmtNode extends Position {
    type: "AssumeStmt";
    predicate: LogicNode;
}

export type StatementNode =
    | AssignmentStmtNode
    | IfStmtNode
    | WhileStmtNode
    | BlockStmtNode
    | AssertStmtNode
    | AssumeStmtNode;

// --- Top-Level Declarations ---

export interface FunctionDeclNode extends Position {
    type: "FunctionDecl";
    name: string;
    params: VarDef[];
    returns: VarDef[];
    requires?: LogicNode | undefined;
    ensures?: LogicNode | undefined;
    uses: LocalVarDef[];
    body: StatementNode;
}

export interface FormulaDeclNode extends Position {
    type: "FormulaDecl";
    name: string;
    params: VarDef[];
    body: LogicNode;
}

export interface ModuleNode extends Position {
    type: "Module";
    functions: FunctionDeclNode[];
    formulas: FormulaDeclNode[];
}

// Объединенный тип всех узлов AST
export type ASTNode =
    | ExpressionNode
    | LogicNode
    | StatementNode
    | FunctionDeclNode
    | FormulaDeclNode
    | ModuleNode;