export interface BaseNode {
    position: number;
    inferredType?: VarType;
}

export type VarType = 'int' | 'int[]';

export interface VarDef extends BaseNode {
    name: string;
    varType: VarType;
}

export interface LocalVarDef extends BaseNode {
    name: string;
    varType?: VarType; // тип опционален
}

// --- Expressions ---

export interface NumberNode extends BaseNode {
    type: "Number";
    value: number;
}

export interface VarRefNode extends BaseNode {
    type: "VarRef";
    name: string;
}

export interface ArrayAccessNode extends BaseNode {
    type: "ArrayAccess";
    array: ExpressionNode; 
    index: ExpressionNode;
}

export interface FunctionCallNode extends BaseNode {
    type: "FunctionCall";
    name: string;
    args: ExpressionNode[];
}

export interface BinaryExprNode extends BaseNode {
    type: "BinaryExpr";
    operator: "+" | "-" | "*" | "/";
    left: ExpressionNode;
    right: ExpressionNode;
}

export interface UnaryExprNode extends BaseNode {
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

export interface BooleanLiteralNode extends BaseNode {
    type: "BooleanLiteral";
    value: boolean;
}

export interface ComparisonNode extends BaseNode {
    type: "Comparison";
    operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
    left: ExpressionNode;
    right: ExpressionNode;
}

export interface BinaryLogicNode extends BaseNode {
    type: "BinaryLogic";
    operator: "and" | "or" | "->";
    left: LogicNode;
    right: LogicNode;
}

export interface UnaryLogicNode extends BaseNode {
    type: "UnaryLogic";
    operator: "not";
    operand: LogicNode;
}

export interface QuantifierNode extends BaseNode {
    type: "Quantifier";
    quantifier: "forall" | "exists";
    variable: VarDef;
    predicate: LogicNode;
}

export interface FormulaRefNode extends BaseNode {
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

export interface AssignmentStmtNode extends BaseNode {
    type: "AssignmentStmt";
    targets: string[];
    value: ExpressionNode;
}

export interface IfStmtNode extends BaseNode {
    type: "IfStmt";
    condition: LogicNode;
    thenBranch: StatementNode;
    elseBranch?: StatementNode;
}

export interface WhileStmtNode extends BaseNode {
    type: "WhileStmt";
    condition: LogicNode;
    invariant?: LogicNode | undefined;
    body: StatementNode;
}

export interface BlockStmtNode extends BaseNode {
    type: "BlockStmt";
    statements: StatementNode[];
}

export interface AssertStmtNode extends BaseNode {
    type: "AssertStmt";
    predicate: LogicNode;
}

export interface AssumeStmtNode extends BaseNode {
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

export interface FunctionDeclNode extends BaseNode {
    type: "FunctionDecl";
    name: string;
    params: VarDef[];
    returns: VarDef[];
    requires?: LogicNode | undefined;
    ensures?: LogicNode | undefined;
    uses: LocalVarDef[];
    body: StatementNode;
}

export interface FormulaDeclNode extends BaseNode {
    type: "FormulaDecl";
    name: string;
    params: VarDef[];
    body: LogicNode;
}

export interface ModuleNode extends BaseNode {
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