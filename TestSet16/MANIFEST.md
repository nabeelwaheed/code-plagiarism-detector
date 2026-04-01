# MANIFEST - TestSet16

This manifest documents intended similarity relationships and validation details for all 12 submissions.

## Intentional Relationship Mapping

- Similar pair:
  - `submission_01` (`SIMILAR_PAIR_A`)
  - `submission_02` (`SIMILAR_PAIR_B`)
- Similar triple:
  - `submission_03` (`TRIPLE_A`)
  - `submission_04` (`TRIPLE_B`)
  - `submission_05` (`TRIPLE_C`)
- Obfuscated pair:
  - `submission_06` (`OBFUSCATED_PAIR_A`)
  - `submission_07` (`OBFUSCATED_PAIR_B`)
- Unique programs:
  - `submission_08`, `submission_09`, `submission_10`, `submission_11`, `submission_12`

## Submission Table

| Folder | submission_label | Theme | intended_relationship | uses_boilerplate | boilerplate_source | multi-file | rough code LOC (`.c`) | compile command |
|---|---|---|---|---|---|---|---:|---|
| `submission_01` | `student_alpha_submission` | linked-list inventory manager | `SIMILAR_PAIR_A` | yes | `boilerplate_02` | yes | 293 | `make -C submissions/submission_01` |
| `submission_02` | `student_beta_submission` | inventory manager variant | `SIMILAR_PAIR_B` | yes | `boilerplate_02` | yes | 258 | `make -C submissions/submission_02` |
| `submission_03` | `student_gamma_submission` | gradebook CSV processor | `TRIPLE_A` | yes | `boilerplate_01` | yes | 172 | `make -C submissions/submission_03` |
| `submission_04` | `student_delta_submission` | gradebook variant | `TRIPLE_B` | yes | `boilerplate_01` | yes | 177 | `make -C submissions/submission_04` |
| `submission_05` | `student_epsilon_submission` | gradebook variant (reordered helpers) | `TRIPLE_C` | yes | `boilerplate_01` | yes | 192 | `make -C submissions/submission_05` |
| `submission_06` | `student_zeta_submission` | graph traversal + components | `OBFUSCATED_PAIR_A` | no | `none` | yes | 228 | `make -C submissions/submission_06` |
| `submission_07` | `student_eta_submission` | graph reachability variant | `OBFUSCATED_PAIR_B` | no | `none` | yes | 228 | `make -C submissions/submission_07` |
| `submission_08` | `student_theta_submission` | text stats / word frequency | `UNIQUE` | yes | `boilerplate_01` | no | 121 | `make -C submissions/submission_08` |
| `submission_09` | `student_iota_submission` | file merge / diff-lite | `UNIQUE` | no | `none` | no | 133 | `make -C submissions/submission_09` |
| `submission_10` | `student_kappa_submission` | expression evaluator | `UNIQUE` | no | `none` | yes | 175 | `make -C submissions/submission_10` |
| `submission_11` | `student_lambda_submission` | maze/pathfinding solver | `UNIQUE` | no | `none` | yes | 242 | `make -C submissions/submission_11` |
| `submission_12` | `student_mu_submission` | spell-check dictionary lookup | `UNIQUE` | yes | `boilerplate_01` | yes | 262 | `make -C submissions/submission_12` |

## Boilerplate Packages

- `boilerplate/boilerplate_01`: argument parsing and file-loading starter helpers.
- `boilerplate/boilerplate_02`: menu framework and common record utilities.

## Packaging Targets

- `dist/TestSet16.zip`: zip-of-zipped student submissions.
- `dist/BoilerplateSet16.zip`: zipped boilerplate set artifact.
