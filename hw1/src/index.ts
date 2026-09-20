import { SubsetConstruction } from "./DFA/SubsetConstruction.js";
import type { NFAFragment } from "./NFA/NFAFragment.js";
import { RegexParser } from "./RegexParser/RegexParser.js";

const expr = "a(b|c)*"
const parser = new RegexParser(expr);

const nfa : NFAFragment = parser.parse().toNFA();
nfa.end.isAccepting = true;

const alphabet = Array.from(['a', 'b', 'c']);
const dfa = SubsetConstruction.convert(nfa.start, alphabet);

const val = Array.from(dfa.transitions.values()).at(0);
console.log(dfa);
console.log(val);

//console.log(dfa);
//console.log("Переходы из старта ДКА:", Array.from(dfa.transitions.keys()));
//console.log("Переходы 0:", Array.from(dfa.transitions.values()));