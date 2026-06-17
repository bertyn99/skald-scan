# CPU Profile

| Duration | Spans | Functions |
|----------|-------|-----------|
| 1279.9s | 122 | 85 |

**Top 10:** `visit_recv_wait` 100.0%, `parse_lockfile` 0.0%, `capture_scm_state` 0.0%, `resolve_lockfile` 0.0%, `populate_transitive_dependencies` 0.0%, `build_http_client` 0.0%, `compile_globs` 0.0%, `parse_package_jsons` 0.0%, `infer` 0.0%, `run` 0.0%

## Hot Functions (Self Time)

| Self% | Self | Total% | Total | Function | Location |
|------:|-----:|-------:|------:|----------|----------|
| 100.0% | 1279.8s | 100.0% | 1279.8s | `visit_recv_wait` | `crates/turborepo-lib/src/task_graph/visitor/mod.rs:358` |

## Call Tree (Total Time)

| Total% | Total | Self% | Self | Function | Location |
|-------:|------:|------:|-----:|----------|----------|
| 100.0% | 1279.8s | 0.0% | 8.6ms | `run` | `crates/turborepo-lib/src/run/mod.rs:857` |
| 100.0% | 1279.8s | 100.0% | 1279.8s | `visit_recv_wait` | `crates/turborepo-lib/src/task_graph/visitor/mod.rs:358` |

## Function Details

### `visit_recv_wait`
`crates/turborepo-lib/src/task_graph/visitor/mod.rs:358` | Self: 100.0% (1279.8s) | Total: 100.0% (1279.8s) | Calls: 2

**Called by:**
- `run` (2)

