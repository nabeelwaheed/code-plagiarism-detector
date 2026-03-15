# C/C++ Similarity Engine Core (Rust)

Minimal Rust CLI implementing the C/C++ similarity pipeline described in the spec.

## Commands

- `engine ccpp rank --input req.json --output out.json`
- `engine ccpp compare --input req.json --a-id A --b-id B --output out.json`
- `engine ccpp concat --input concat.json --output out.concat.json`

## Exit Codes

- `0` success
- `2` invalid request/schema/validation error
- `3` unsupported language / parser initialization failure
- `4` internal error

## Schemas and Examples

- Schemas: `schemas/analysis-request.schema.json`, `schemas/analysis-result.schema.json`
- Examples: `examples/req.rank.json`, `examples/req.compare.json`, `examples/concat.in.json`