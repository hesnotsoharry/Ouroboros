---
wave: 21
status: DRAFT
title: Tree-Sitter Class Heritage & IMPLEMENTS Edge Research
created: 2026-05-26
---

# Wave 21 Phase 1 — Tree-Sitter Class Heritage & IMPLEMENTS Edge Research

## Question
How does tree-sitter's TypeScript/TSX grammar expose `class_heritage` via the web-tree-sitter v0.26.x Node API, and what is the equivalent pattern for extracting base classes/trait implementations in other languages (Java, Python, C++, Rust, Go)?

---

## 1. TypeScript/TSX: class_heritage Node Structure

### Grammar Rules (TypeScript/common)

**Source:** [tree-sitter-typescript/common/define-grammar.js](https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js)

The `class_heritage` rule combines inheritance and interface implementation as a choice:

```javascript
class_heritage: $ => choice(
  seq($.extends_clause, optional($.implements_clause)),
  $.implements_clause,
)
```

### Named Children: extends_clause and implements_clause

**Source:** [tree-sitter-typescript test corpus](https://github.com/tree-sitter/tree-sitter-typescript/blob/master/test/corpus/declarations.txt)

Both are exposed as **named children** of `class_heritage` — field names are `extends_clause` and `implements_clause` respectively, accessible via `childForFieldName()`.

#### Extends Clause

Structure:
```javascript
extends_clause: $ => seq(
  'extends',
  commaSep1($._extends_clause_single)
)
```

- **Children:** one or more type expressions (identifiers, call expressions, generic types)
- **Field name:** `extends_clause` (single parent class in TypeScript; multiple entries are for mixins/union types in advanced patterns)
- **Example AST:**
  ```
  (class_declaration
    name: (type_identifier) "MyClass"
    (class_heritage
      (extends_clause
        (identifier) "BaseClass")))
  ```

#### Implements Clause

Structure:
```javascript
implements_clause: $ => seq(
  'implements',
  commaSep1($.type)
)
```

- **Children:** one or more `type_identifier` or `generic_type` nodes (comma-separated, multiple interfaces)
- **Field name:** `implements_clause`
- **Example AST:**
  ```
  (class_declaration
    name: (type_identifier) "MyClass"
    (class_heritage
      (extends_clause
        (identifier) "BaseClass")
      (implements_clause
        (type_identifier) "Interface1"
        (type_identifier) "Interface2")))
  ```

### JSX/TSX: No Differences

TSX class_heritage is **identical** to TypeScript. JSX has no classes, interfaces, or implements — `jsx` is an expression syntax only. TSX reuses the full TypeScript grammar.

---

## 2. web-tree-sitter v0.26.x Node API: Field Access Patterns

**Source:** [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter) (v0.26.8 as of Wave 93)  
**Source:** [tree-sitter discussion #1636 — field name access in WASM](https://github.com/tree-sitter/tree-sitter/discussions/1636)  
**Source:** [Agent IDE vendor-gotchas/tree-sitter.md](C:\Web App\AgentIDE\.claude\vendor-gotchas\tree-sitter.md) — Wave 93 migration notes

### Recommended API: childForFieldName()

```typescript
const heritageNode = classNode.childForFieldName('class_heritage');
const extendsClause = heritageNode?.childForFieldName('extends_clause');
const implementsClause = heritageNode?.childForFieldName('implements_clause');
```

**Type:** `childForFieldName(fieldName: string): Node | null`

- Returns the **first child** matching the field name, or `null` if not present
- For multi-child fields (e.g., interfaces in `implements_clause`), use `namedChildren` to iterate:
  ```typescript
  const interfaces = implementsClause?.namedChildren ?? [];
  ```

### Alternative: namedChildren Array

```typescript
const heritageNode = classNode.childForFieldName('class_heritage');
const allHeritageChildren = heritageNode?.namedChildren ?? [];
// Filter: extends_clause and implements_clause nodes by type
const extendsClause = allHeritageChildren.find(n => n.type === 'extends_clause');
const implementsClause = allHeritageChildren.find(n => n.type === 'implements_clause');
```

**When to use:**
- `childForFieldName()` — preferred for single-child fields (most semantic)
- `namedChildren` — fallback or when iterating all children; less semantic (walk array by type)

### No Field ID Optimization Needed for Phase 1

Tree-sitter offers `childForFieldId()` for performance (pre-looked-up field IDs instead of string lookups). **Skip for now.** The indexer's class inheritance extraction is infrequent compared to symbol scanning; string-based field lookup has negligible cost. Use field IDs only if profiling shows `childForFieldName()` is a bottleneck (unlikely at current scale).

---

## 3. Other Languages: Class/Interface/Trait Extraction Pattern

### Java: class_declaration, extends_clause, implements_clause

**Source:** [tree-sitter-java repository](https://github.com/tree-sitter/tree-sitter-java)

| Concept | Node Type | Field Name | Children |
|---------|-----------|-----------|----------|
| Class declaration | `class_declaration` | — | `name`, `superclass`, `interfaces`, `body` |
| Base class | (via `superclass` field) | `superclass` | single type expression |
| Interfaces | (via `interfaces` field) | `interfaces` | comma-separated `type_identifier` nodes |

**Example:**
```java
class MyClass extends BaseClass implements Interface1, Interface2 {}
```

**Extraction approach:** Walk `namedChildren` of `class_declaration`, find fields `superclass` and `interfaces`.

---

### Python: class_definition with bases field

**Source:** [tree-sitter-python grammar](https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js)

| Concept | Node Type | Field Name | Children |
|---------|-----------|-----------|----------|
| Class definition | `class_definition` | — | `name`, `bases`, `body` |
| Base classes | (via `bases` field) | `bases` | parenthesized expression containing comma-sep arguments |

**Note:** Python has no explicit interface syntax. Inheritance of `ABC` (abstract base) or `Protocol` are convention-based, not grammatical.

**Example:**
```python
class MyClass(BaseClass, Mixin):
    pass
```

**Extraction approach:** `childForFieldName('bases')` on `class_definition`, then walk the parenthesized list's children.

---

### C++: class_specifier with base_class_clause

**Source:** [tree-sitter-cpp grammar](https://github.com/tree-sitter/tree-sitter-cpp)

| Concept | Node Type | Field Name | Children |
|---------|-----------|-----------|----------|
| Class specifier | `class_specifier` | — | `name`, `base_class_clause`, `field_declaration_list` |
| Base classes | (via `base_class_clause` field) | `base_class_clause` | access specifier (`public`/`private`/`protected`) + type name |

**Example:**
```cpp
class MyClass : public BaseClass, private Mixin {};
```

**Extraction approach:** `childForFieldName('base_class_clause')` on `class_specifier`, walk children filtering by `type_identifier`.

---

### Rust: impl_item with trait reference (no inheritance)

**Source:** [tree-sitter-rust repository](https://github.com/tree-sitter/tree-sitter-rust)

| Concept | Node Type | Field Name | Children |
|---------|-----------|-----------|----------|
| Impl block | `impl_item` | — | `type_parameters`, `trait` (optional), `type`, `declaration_list` |
| Trait impl | (via `trait` field) | `trait` | optional: type_identifier of the trait being implemented |

**Note:** Rust has no inheritance or base classes. Struct/enum implementation is via `impl` blocks; trait implementation is via `impl Trait for Type {}`.

**Example:**
```rust
impl Display for MyStruct {}  // trait impl: trait="Display"
impl MyStruct {}              // direct impl: trait field absent
```

**Extraction approach:** For IMPLEMENTS edges, extract `childForFieldName('trait')` on `impl_item`. EXTENDS is not applicable.

---

### Go: No classes or inheritance

**Source:** [tree-sitter-go repository](https://github.com/tree-sitter/tree-sitter-go)

Go has no explicit class declarations, inheritance, or interface implementation syntax. Interfaces are satisfied implicitly via structural typing (methods with matching names/signatures).

**Extraction approach:** Skip class/interface/trait extraction for Go. Interface definitions are parsed as `type_spec` with `interface_type` children, but no IMPLEMENTS edges can be reliably inferred without type-checking context.

---

## 4. Language Support for Phase 1 Scope

Based on grammar structure and IMPLEMENTS edge relevance:

| Language | IMPLEMENTS Edge | EXTENDS Edge | Status for Phase 1 |
|----------|-----------------|--------------|-------------------|
| TypeScript | ✓ (implements_clause) | ✓ (extends_clause) | **IN SCOPE** — primary target |
| TSX | ✓ (identical to TS) | ✓ (identical to TS) | **IN SCOPE** — same extraction |
| JavaScript | ✗ (no interfaces) | ✗ (no extends) | DEFER — ES6 classes have no heritage syntax |
| Python | ✗ (bases only, no interfaces) | ~ (bases field, convention-based) | DEFER — bases extraction is complex (arbitrary expressions); low signal-to-noise |
| Go | ✗ (no classes) | ✗ (no inheritance) | DEFER — implicit satisfaction; requires type-checker context |
| Rust | ✓ (trait impl) | ✗ (no inheritance) | TIER 2 — trait extraction deferred to later phase |
| Java | ✓ (interfaces field) | ✓ (superclass field) | TIER 2 — defer to later phase (grammar similar to TS but lower priority) |
| C++ | ✓ (base_class_clause) | ✓ (base_class_clause) | TIER 2 — defer to later phase |
| C# | ✓ (base_type) | ✓ (base_type) | TIER 2 — defer to later phase |

**Recommendation:** Phase 1 scope = **TypeScript + TSX only**. Both use identical grammar for heritage extraction. Phase 2+ can expand to Java, C++, C# (similar patterns), and Rust (trait-specific pattern).

---

## 5. ABI Compatibility: web-tree-sitter v0.26.x + @vscode/tree-sitter-wasm v0.3.x

**Source:** [Agent IDE vendor-gotchas/tree-sitter.md — ABI compatibility table](C:\Web App\AgentIDE\.claude\vendor-gotchas\tree-sitter.md)

| Package | Version | Supported Grammar ABI |
|---------|---------|----------------------|
| `web-tree-sitter` | `^0.26.8` | 13–15 |
| `@vscode/tree-sitter-wasm` | `^0.3.1` | 15 |
| `tree-sitter-wasms` (fallback) | `0.1.13` | 13–14 |

**Status:** TypeScript/TSX grammars in `@vscode/tree-sitter-wasm@0.3.x` emit ABI 15. `web-tree-sitter@0.26.8` supports ABI 13–15. **No compatibility risk for Phase 1.**

---

## 6. Implementation Checklist for Phase 1

1. **Config update:** Add `implementsNodes` array to `typescriptConfig` and `tsxConfig` in `treeSitterLanguageConfigs.ts`
   - Value: `['class_heritage']` (signal: "walk this node type for IMPLEMENTS edges")

2. **Parser enhancement:** Add function to `treeSitterParserDefs.ts`
   ```typescript
   export function extractClassHeritage(classNode: Node): {
     extendsClass?: string;
     implementsInterfaces: string[];
   } {
     const heritage = classNode.childForFieldName('class_heritage');
     if (!heritage) return { implementsInterfaces: [] };
     
     // Extract extends
     const extendsClause = heritage.childForFieldName('extends_clause');
     const extendsClass = extendsClause?.namedChildren[0]?.text ?? undefined;
     
     // Extract implements
     const implementsClause = heritage.childForFieldName('implements_clause');
     const interfaces = (implementsClause?.namedChildren ?? [])
       .map(n => n.text);
     
     return { extendsClass, implementsInterfaces: interfaces };
   }
   ```

3. **Graph edge emission:** In the indexing loop (treeSitterParser.ts or callSite), emit IMPLEMENTS edges for each interface, EXTENDS edges for the parent class.

4. **Test coverage:** Unit test for `extractClassHeritage()` with fixtures covering:
   - Class with extends only
   - Class with implements only (multiple)
   - Class with both extends and implements
   - Class with no heritage

---

## 7. Version Sensitivity

**As of 2026-05-26:**
- `web-tree-sitter@0.26.8`: API is stable; no breaking changes expected in 0.26.x
- `@vscode/tree-sitter-wasm@0.3.1`: ABI 15 is current; future bumps should verify `web-tree-sitter` support (see vendor-gotchas rule in CLAUDE.md)
- TypeScript grammar: class_heritage structure is stable across grammar versions included in the indexer

---

## Sources

- [tree-sitter/tree-sitter-typescript — GitHub](https://github.com/tree-sitter/tree-sitter-typescript)
- [tree-sitter-typescript/test/corpus/declarations.txt](https://github.com/tree-sitter/tree-sitter-typescript/blob/master/test/corpus/declarations.txt)
- [tree-sitter-typescript/common/define-grammar.js](https://github.com/tree-sitter/tree-sitter-typescript/blob/master/common/define-grammar.js)
- [web-tree-sitter npm package](https://www.npmjs.com/package/web-tree-sitter)
- [tree-sitter discussion #1636 — Node field name access in WASM](https://github.com/tree-sitter/tree-sitter/discussions/1636)
- [tree-sitter/tree-sitter-java — GitHub](https://github.com/tree-sitter/tree-sitter-java)
- [tree-sitter/tree-sitter-python — GitHub](https://github.com/tree-sitter/tree-sitter-python)
- [tree-sitter/tree-sitter-cpp — GitHub](https://github.com/tree-sitter/tree-sitter-cpp)
- [tree-sitter/tree-sitter-rust — GitHub](https://github.com/tree-sitter/tree-sitter-rust)
- [tree-sitter/tree-sitter-go — GitHub](https://github.com/tree-sitter/tree-sitter-go)
- [Agent IDE vendor-gotchas/tree-sitter.md](C:\Web App\AgentIDE\.claude\vendor-gotchas\tree-sitter.md) (Wave 93)
- [treeSitterParserDefs.ts](C:\Web App\AgentIDE\src\main\codebaseGraph\treeSitterParserDefs.ts) (existing extraction patterns)
