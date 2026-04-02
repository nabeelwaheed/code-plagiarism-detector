# MANIFEST - TestSet16 Mixed-Language Submission Set

This manifest documents all 20 student submissions, intended relationships, boilerplate usage, and compile commands.

## Relationship Mapping

### C Similarity Structure
- Pair:
  - `c_submission_01` -> `C_PAIR_A`
  - `c_submission_02` -> `C_PAIR_B`
- Triple:
  - `c_submission_03` -> `C_TRIPLE_A`
  - `c_submission_04` -> `C_TRIPLE_B`
  - `c_submission_05` -> `C_TRIPLE_C`

### C++ Similarity Structure
- Pair:
  - `cpp_submission_01` -> `CPP_PAIR_A`
  - `cpp_submission_02` -> `CPP_PAIR_B`
- Triple:
  - `cpp_submission_03` -> `CPP_TRIPLE_A`
  - `cpp_submission_04` -> `CPP_TRIPLE_B`
  - `cpp_submission_05` -> `CPP_TRIPLE_C`

### Optional Harder Pair
- `cpp_submission_08` -> `OPTIONAL_OBFUSCATED_A`
- `cpp_submission_09` -> `OPTIONAL_OBFUSCATED_B`

## Submission Table

| Folder | language | Program theme | intended_relationship | uses_boilerplate | boilerplate_source | approx LOC (`.c/.cpp`) | compile command |
|---|---|---|---|---|---|---:|---|
| `c_submission_01` | C | inventory manager | `C_PAIR_A` | yes | `boilerplate_c_02` | 293 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_01.bin` |
| `c_submission_02` | C | inventory manager variant | `C_PAIR_B` | yes | `boilerplate_c_02` | 258 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_02.bin` |
| `c_submission_03` | C | gradebook processor | `C_TRIPLE_A` | yes | `boilerplate_c_01` | 172 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_03.bin` |
| `c_submission_04` | C | gradebook variant | `C_TRIPLE_B` | yes | `boilerplate_c_01` | 177 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_04.bin` |
| `c_submission_05` | C | gradebook variant (helper reshaping) | `C_TRIPLE_C` | yes | `boilerplate_c_01` | 192 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_05.bin` |
| `c_submission_06` | C | graph traversal | `UNIQUE` | no | `none` | 228 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_06.bin` |
| `c_submission_07` | C | maze/pathfinding | `UNIQUE` | no | `none` | 242 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_07.bin` |
| `c_submission_08` | C | text statistics | `UNIQUE` | yes | `boilerplate_c_01` | 121 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_08.bin` |
| `c_submission_09` | C | expression evaluator | `UNIQUE` | no | `none` | 175 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_09.bin` |
| `c_submission_10` | C | spell checker | `UNIQUE` | yes | `boilerplate_c_01` | 262 | `gcc -std=c11 -Wall -Wextra *.c -o /tmp/c_submission_10.bin` |
| `cpp_submission_01` | C++ | record management tool | `CPP_PAIR_A` | yes | `boilerplate_cpp_02` | 163 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_01.bin` |
| `cpp_submission_02` | C++ | record management variant | `CPP_PAIR_B` | yes | `boilerplate_cpp_02` | 168 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_02.bin` |
| `cpp_submission_03` | C++ | CSV analyzer | `CPP_TRIPLE_A` | yes | `boilerplate_cpp_01` | 107 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_03.bin` |
| `cpp_submission_04` | C++ | CSV analyzer variant | `CPP_TRIPLE_B` | yes | `boilerplate_cpp_01` | 105 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_04.bin` |
| `cpp_submission_05` | C++ | CSV analyzer variant (helper reshaping) | `CPP_TRIPLE_C` | yes | `boilerplate_cpp_01` | 111 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_05.bin` |
| `cpp_submission_06` | C++ | command parser | `UNIQUE` | yes | `boilerplate_cpp_02` | 109 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_06.bin` |
| `cpp_submission_07` | C++ | matrix toolkit | `UNIQUE` | no | `none` | 106 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_07.bin` |
| `cpp_submission_08` | C++ | graph traversal analyzer | `OPTIONAL_OBFUSCATED_A` | no | `none` | 123 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_08.bin` |
| `cpp_submission_09` | C++ | graph traversal variant (obfuscated) | `OPTIONAL_OBFUSCATED_B` | no | `none` | 121 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_09.bin` |
| `cpp_submission_10` | C++ | file merge / diff-lite | `UNIQUE` | no | `none` | 104 | `g++ -std=c++17 -Wall -Wextra *.cpp -o /tmp/cpp_submission_10.bin` |

## Boilerplate Packages

- `boilerplate/boilerplate_c_01`
- `boilerplate/boilerplate_c_02`
- `boilerplate/boilerplate_cpp_01`
- `boilerplate/boilerplate_cpp_02`
